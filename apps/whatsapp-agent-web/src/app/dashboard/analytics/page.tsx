'use client';

import { useEffect, useState } from 'react';
import { getStoredUser, isPortalUser } from '../portal';
import {
  Button,
  Card,
  EmptyState,
  Input,
  PageLoading,
  Select,
  StatCard,
  StatusBadge,
  Table,
  THead,
  TR,
  TH,
  TD,
  UsageBar,
  useToast,
} from '@/components/ui';

interface Analytics {
  period?: { since: string; until: string };
  totalConversations: number;
  activeConversations: number;
  resolvedConversations: number;
  humanHandoffs: number;
  handoffRate: number | null;
  aiResolutionRate: number | null;
  aiResolvedWithoutHandoff: number;
  totalMessages: number;
  topHandoffReasons: { reason: string; count: number }[];
  dailyVolume: { date: string; count: number }[];
  avgResolutionTimeMinutes: number | null;
  avgHandoffResponseSeconds: number | null;
  csat: { average: number | null; responses: number };
  bookings?: {
    total: number;
    confirmed: number;
    noShowRate: number | null;
    upcomingThisWeek: number;
  };
  orders?: {
    total: number;
    byStatus: Record<string, number>;
    revenue: number;
  };
  // Staff only — absent for portal users
  tokens?: { prompt: number; completion: number; total: number };
  estimatedCostUsd?: number;
}

interface UsageInfo {
  balance: number;
  used: number;
  planAllowance: number;
  topUpCredits: number;
  allowanceRemaining: number;
  topUpRemaining: number;
  remainingPct: number;
  periodStart: string;
  periodEnd: string;
  topUps: { id: string; credits: number; priceLkr: number; note?: string | null; createdAt: string }[];
}

interface TopUpRequest {
  id: string;
  reference: string;
  conversations: number;
  priceLkr: number;
  status:
    | 'pending_payment'
    | 'slip_uploaded'
    | 'approved'
    | 'rejected'
    | 'expired';
  staffNote?: string | null;
  createdAt: string;
  slipMimeType?: string | null;
}

interface TopUpPackage {
  conversations: number;
  priceLkr: number;
}

interface ClientOption {
  id: string;
  name: string;
}

type RangeKey = 'today' | '7d' | '30d' | 'custom';

const formatDuration = (minutes: number | null) => {
  if (minutes == null) return '-';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h ${mins}m`;
};

const formatPct = (rate: number | null | undefined) =>
  rate == null ? '-' : `${Math.round(rate * 100)}%`;

const formatLkr = (amount: number) => `LKR ${Number(amount).toLocaleString()}`;

export default function AnalyticsPage() {
  const toast = useToast();
  const [data, setData] = useState<Analytics | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [portal, setPortal] = useState(false);
  const [range, setRange] = useState<RangeKey>('7d');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [appliedCustom, setAppliedCustom] = useState<{ from: string; to: string } | null>(null);
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [packages, setPackages] = useState<TopUpPackage[]>([]);
  const [bankDetails, setBankDetails] = useState('');
  const [requests, setRequests] = useState<TopUpRequest[]>([]);
  const [showPackages, setShowPackages] = useState(false);
  const [confirmedRequest, setConfirmedRequest] = useState<{
    reference: string;
    conversations: number;
    priceLkr: number;
    bankDetails: string;
  } | null>(null);
  const [slipFiles, setSlipFiles] = useState<Record<string, File | null>>({});
  const token =
    (typeof window !== 'undefined' && localStorage.getItem('token')) || '';

  useEffect(() => {
    const user = getStoredUser();
    if (isPortalUser(user)) {
      setPortal(true);
      if (user?.clientId) setSelectedClientId(user.clientId);
      return;
    }
    fetch('/api/clients', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((list) => setClients(Array.isArray(list) ? list : []))
      .catch(() => setClients([]));
  }, []);

  useEffect(() => {
    fetch('/api/usage/packages', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setPackages(Array.isArray(data.packages) ? data.packages : []);
        setBankDetails(data.bankDetails || '');
      })
      .catch(() => {});
  }, []);

  const fetchRequests = async (clientId: string) => {
    try {
      const res = await fetch(`/api/usage/${clientId}/topup-requests`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = res.ok ? await res.json() : [];
      setRequests(Array.isArray(list) ? list : []);
    } catch {
      setRequests([]);
    }
  };

  const requestTopUp = async (pkg: TopUpPackage) => {
    if (!selectedClientId) return;
    if (
      !confirm(
        `Request top-up of ${pkg.conversations} conversations for ${formatLkr(pkg.priceLkr)}?`,
      )
    )
      return;
    const res = await fetch(`/api/usage/${selectedClientId}/topup-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ conversations: pkg.conversations }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.message || 'Failed to create top-up request', 'error');
      return;
    }
    setShowPackages(false);
    setConfirmedRequest({
      reference: data.request.reference,
      conversations: data.request.conversations,
      priceLkr: data.request.priceLkr,
      bankDetails: data.bankDetails || bankDetails,
    });
    fetchRequests(selectedClientId);
  };

  const uploadSlip = async (requestId: string) => {
    const file = slipFiles[requestId];
    if (!file) {
      toast('Choose a slip image or PDF first', 'info');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(
      `/api/usage/${selectedClientId}/topup-requests/${requestId}/slip`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast(data?.message || 'Failed to upload slip', 'error');
      return;
    }
    toast('Slip uploaded', 'success');
    setSlipFiles((prev) => ({ ...prev, [requestId]: null }));
    fetchRequests(selectedClientId);
  };

  useEffect(() => {
    setData(null);
    const params = new URLSearchParams();
    if (selectedClientId) params.set('clientId', selectedClientId);
    if (range === 'custom') {
      if (appliedCustom?.from) params.set('from', appliedCustom.from);
      if (appliedCustom?.to) params.set('to', appliedCustom.to);
    } else {
      params.set('range', range);
    }
    const qs = params.toString();
    fetch(`/api/analytics/overview${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setData);
  }, [selectedClientId, range, appliedCustom]);

  useEffect(() => {
    setUsage(null);
    setRequests([]);
    setShowPackages(false);
    setConfirmedRequest(null);
    if (!selectedClientId) return;
    fetch(`/api/usage/${selectedClientId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(setUsage)
      .catch(() => setUsage(null));
    fetchRequests(selectedClientId);
  }, [selectedClientId]);

  if (!data) {
    return <PageLoading label="Loading analytics…" />;
  }

  const rangeButton = (key: RangeKey, label: string) => (
    <Button
      key={key}
      size="sm"
      variant={range === key ? 'primary' : 'outline'}
      className="rounded-full"
      onClick={() => setRange(key)}
    >
      {label}
    </Button>
  );

  const conversationsLeft = usage
    ? (usage.allowanceRemaining ?? 0) + (usage.topUpRemaining ?? 0)
    : 0;
  const usageToneClass = !usage
    ? 'text-green-600'
    : usage.remainingPct <= 0
    ? 'text-red-600'
    : usage.remainingPct <= 0.2
    ? 'text-amber-600'
    : 'text-green-600';

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar: client selector + date range */}
      <div className="flex flex-wrap items-center gap-2">
        {!portal && (
          <Select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="w-full sm:w-64"
          >
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
        {rangeButton('today', 'Today')}
        {rangeButton('7d', '7 days')}
        {rangeButton('30d', '30 days')}
        {rangeButton('custom', 'Custom')}
        {range === 'custom' && (
          <>
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="w-auto"
            />
            <span className="text-sm text-muted">to</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="w-auto"
            />
            <Button
              size="sm"
              onClick={() =>
                setAppliedCustom({ from: customFrom, to: customTo })
              }
            >
              Apply
            </Button>
          </>
        )}
      </div>

      {usage && (
        <Card title="Portal usage">
          {usage.remainingPct <= 0 && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">
              AI paused — contact us to top up and resume instantly.
            </div>
          )}
          <div className={`text-lg font-bold ${usageToneClass}`}>
            {conversationsLeft} conversations left this month
          </div>
          <UsageBar
            className="mt-3"
            used={usage.used}
            limit={usage.planAllowance + usage.topUpCredits}
            label="Conversations used"
          />
          <div className="mt-2 text-xs text-muted">
            {usage.allowanceRemaining} of {usage.planAllowance} plan allowance
            remaining
            {usage.topUpRemaining > 0 &&
              ` • ${usage.topUpRemaining} top-up credits remaining`}
          </div>

          {confirmedRequest && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="text-sm font-semibold text-green-700">
                Top-up request created
              </div>
              <div className="mt-2 font-mono text-2xl font-bold tracking-wider text-brand-navy">
                {confirmedRequest.reference}
              </div>
              <div className="mt-1 text-sm text-brand-navy">
                Use this code as the transfer narration •{' '}
                {confirmedRequest.conversations} conversations •{' '}
                {formatLkr(confirmedRequest.priceLkr)}
              </div>
              {confirmedRequest.bankDetails && (
                <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-line bg-white p-3 font-sans text-sm text-brand-navy">
                  {confirmedRequest.bankDetails}
                </pre>
              )}
            </div>
          )}

          <div className="mt-4">
            <Button
              size="sm"
              variant={usage.remainingPct <= 0 ? 'danger' : 'primary'}
              onClick={() => setShowPackages(!showPackages)}
            >
              {showPackages ? 'Close package picker' : 'Request top-up'}
            </Button>
          </div>

          {showPackages && (
            <div className="mt-3 flex flex-wrap gap-2">
              {packages.length === 0 ? (
                <div className="text-sm text-muted">Loading packages...</div>
              ) : (
                packages.map((p) => (
                  <button
                    key={p.conversations}
                    onClick={() => requestTopUp(p)}
                    className="rounded-lg border border-line bg-white px-3.5 py-2.5 text-center transition-colors hover:border-brand-indigo hover:bg-page"
                  >
                    <div className="text-base font-bold text-brand-navy">
                      {p.conversations}
                    </div>
                    <div className="text-xs text-muted">conversations</div>
                    <div className="mt-1 text-sm font-semibold text-brand-indigo">
                      {formatLkr(p.priceLkr)}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {requests.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 text-sm font-semibold">Top-up requests</div>
              <div className="divide-y divide-line">
                {requests.map((r) => (
                  <div key={r.id} className="py-2.5 text-sm text-brand-navy">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold">
                        {r.reference}
                      </span>
                      <span>
                        {r.conversations} conversations •{' '}
                        {formatLkr(r.priceLkr)}
                      </span>
                      <StatusBadge status={r.status} />
                      <span className="text-xs text-muted">
                        {new Date(r.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {r.status === 'rejected' && r.staffNote && (
                      <div className="mt-1 text-xs text-red-700">
                        Reason: {r.staffNote}
                      </div>
                    )}
                    {r.status === 'pending_payment' && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) =>
                            setSlipFiles((prev) => ({
                              ...prev,
                              [r.id]: e.target.files?.[0] || null,
                            }))
                          }
                          className="text-xs text-muted file:mr-2 file:rounded-md file:border-0 file:bg-page file:px-2.5 file:py-1.5 file:text-xs file:font-medium file:text-brand-navy"
                        />
                        <Button size="sm" onClick={() => uploadSlip(r.id)}>
                          Upload slip
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {usage.topUps && usage.topUps.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 text-sm font-semibold">Top-up history</div>
              <div className="divide-y divide-line">
                {usage.topUps.map((t) => (
                  <div key={t.id} className="py-1.5 text-sm text-brand-navy">
                    {new Date(t.createdAt).toLocaleDateString()} • +
                    {t.credits} credits • {formatLkr(t.priceLkr)}
                    {t.note ? ` • ${t.note}` : ''}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard
          label="AI Resolution Rate"
          value={formatPct(data.aiResolutionRate)}
          hint={`${data.aiResolvedWithoutHandoff} resolved without handoff`}
        />
        <StatCard label="Total Conversations" value={data.totalConversations} />
        <StatCard label="Active" value={data.activeConversations} />
        <StatCard label="Resolved" value={data.resolvedConversations} />
        <StatCard
          label="Handoff Rate"
          value={formatPct(data.handoffRate)}
          hint={`${data.humanHandoffs} handoffs`}
        />
        <StatCard label="Total Messages" value={data.totalMessages} />
        <StatCard
          label="Avg Resolution Time"
          value={formatDuration(data.avgResolutionTimeMinutes)}
        />
        <StatCard
          label="Avg Handoff Response"
          value={
            data.avgHandoffResponseSeconds == null
              ? '-'
              : `${data.avgHandoffResponseSeconds}s`
          }
        />
        <StatCard
          label="CSAT Average"
          value={data.csat.average == null ? '-' : `${data.csat.average} / 5`}
          hint={`${data.csat.responses} responses`}
        />
        {data.bookings && (
          <StatCard
            label="Bookings"
            value={data.bookings.total}
            hint={`${data.bookings.confirmed} confirmed • no-show ${formatPct(data.bookings.noShowRate)} • ${data.bookings.upcomingThisWeek} upcoming this week`}
          />
        )}
        {data.orders && (
          <StatCard
            label="Orders"
            value={data.orders.total}
            hint={`Revenue ${formatLkr(data.orders.revenue)} • ${Object.entries(data.orders.byStatus || {})
              .map(([s, n]) => `${s.replace(/_/g, ' ')}: ${n}`)
              .join(' • ')}`}
          />
        )}
        {data.tokens && (
          <>
            <StatCard label="Tokens (prompt)" value={data.tokens.prompt} />
            <StatCard
              label="Tokens (completion)"
              value={data.tokens.completion}
            />
            <StatCard label="Tokens (total)" value={data.tokens.total} />
            <StatCard
              label="Estimated cost"
              value={`$${(data.estimatedCostUsd ?? 0) < 0.01 && (data.estimatedCostUsd ?? 0) > 0 ? (data.estimatedCostUsd ?? 0).toFixed(4) : (data.estimatedCostUsd ?? 0).toFixed(2)}`}
            />
          </>
        )}
      </div>

      <Card title="Top Handoff Reasons">
        {data.topHandoffReasons.length === 0 ? (
          <EmptyState title="No handoffs yet" />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Reason</TH>
                <TH>Count</TH>
              </TR>
            </THead>
            <tbody>
              {data.topHandoffReasons.map((r, i) => (
                <TR key={i}>
                  <TD>{r.reason}</TD>
                  <TD>{r.count}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card title="Daily Conversation Volume">
        {data.dailyVolume.length === 0 ? (
          <EmptyState title="No conversations in this period" />
        ) : (
          <div className="flex h-[200px] items-end gap-3">
            {data.dailyVolume.map((d) => (
              <div
                key={d.date}
                className="flex flex-1 flex-col items-center gap-1.5"
              >
                <div
                  className="w-full rounded bg-brand-indigo"
                  style={{
                    height: `${Math.max(
                      4,
                      (d.count /
                        Math.max(
                          1,
                          ...data.dailyVolume.map((x) => x.count),
                        )) *
                        140,
                    )}px`,
                  }}
                />
                <div className="text-[11px] text-muted">
                  {new Date(d.date).toLocaleDateString(undefined, {
                    weekday: 'short',
                  })}
                </div>
                <div className="text-xs font-semibold">{d.count}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
