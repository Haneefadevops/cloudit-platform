'use client';

import { useEffect, useState } from 'react';
import { getStoredUser, isPortalUser } from '../portal';

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
  const [message, setMessage] = useState<string | null>(null);
  const token =
    (typeof window !== 'undefined' && localStorage.getItem('token')) || '';

  const showInfo = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 4000);
  };

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
      showInfo(data.message || 'Failed to create top-up request');
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
      showInfo('Choose a slip image or PDF first');
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
      showInfo(data?.message || 'Failed to upload slip');
      return;
    }
    showInfo('Slip uploaded');
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
    return <div>Loading analytics...</div>;
  }

  const statCard = (
    label: string,
    value: number | string,
    sub?: React.ReactNode,
  ) => (
    <div
      key={label}
      style={{
        background: 'white',
        padding: 20,
        borderRadius: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        minWidth: 160,
        flex: 1,
      }}
    >
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>{sub}</div>
      )}
    </div>
  );

  const rangeButton = (key: RangeKey, label: string) => (
    <button
      key={key}
      onClick={() => setRange(key)}
      style={{
        padding: '6px 14px',
        borderRadius: 16,
        border: range === key ? '1px solid #2563eb' : '1px solid #d1d5db',
        background: range === key ? '#eff6ff' : 'white',
        color: range === key ? '#1d4ed8' : '#374151',
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: range === key ? 600 : 400,
      }}
    >
      {label}
    </button>
  );

  const conversationsLeft = usage
    ? (usage.allowanceRemaining ?? 0) + (usage.topUpRemaining ?? 0)
    : 0;
  const usageColor = !usage
    ? '#16a34a'
    : usage.remainingPct <= 0
    ? '#dc2626'
    : usage.remainingPct <= 0.2
    ? '#d97706'
    : '#16a34a';

  const requestStatusStyle = (
    status: TopUpRequest['status'],
  ): { color: string; bg: string; label: string } => {
    switch (status) {
      case 'pending_payment':
        return { color: '#92400e', bg: '#fef3c7', label: 'Pending payment' };
      case 'slip_uploaded':
        return { color: '#1d4ed8', bg: '#eff6ff', label: 'Slip uploaded' };
      case 'approved':
        return { color: '#15803d', bg: '#f0fdf4', label: 'Approved' };
      case 'rejected':
        return { color: '#b91c1c', bg: '#fef2f2', label: 'Rejected' };
      case 'expired':
        return { color: '#4b5563', bg: '#f3f4f6', label: 'Expired' };
    }
  };

  return (
    <div>
      <h1>Analytics</h1>

      {message && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 6,
            color: '#1e40af',
          }}
        >
          {message}
        </div>
      )}

      {!portal && (
        <div style={{ marginTop: 12, maxWidth: 320 }}>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            style={{
              padding: 8,
              borderRadius: 4,
              border: '1px solid #d1d5db',
              fontSize: 14,
              width: '100%',
            }}
          >
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div
        style={{
          marginTop: 16,
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {rangeButton('today', 'Today')}
        {rangeButton('7d', '7 days')}
        {rangeButton('30d', '30 days')}
        {rangeButton('custom', 'Custom')}
        {range === 'custom' && (
          <>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              style={{
                padding: 6,
                borderRadius: 4,
                border: '1px solid #d1d5db',
                fontSize: 13,
              }}
            />
            <span style={{ color: '#6b7280', fontSize: 13 }}>to</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              style={{
                padding: 6,
                borderRadius: 4,
                border: '1px solid #d1d5db',
                fontSize: 13,
              }}
            />
            <button
              onClick={() =>
                setAppliedCustom({ from: customFrom, to: customTo })
              }
              style={{
                padding: '6px 14px',
                background: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Apply
            </button>
          </>
        )}
      </div>

      {usage && (
        <div
          style={{
            marginTop: 24,
            background: 'white',
            padding: 20,
            borderRadius: 8,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          {usage.remainingPct <= 0 && (
            <div
              style={{
                marginBottom: 12,
                padding: 12,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 6,
                color: '#b91c1c',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              AI paused — contact us to top up and resume instantly.
            </div>
          )}
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: usageColor,
            }}
          >
            {conversationsLeft} conversations left this month
          </div>
          <div
            style={{
              marginTop: 10,
              height: 10,
              background: '#f3f4f6',
              borderRadius: 5,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: `${Math.max(0, Math.min(1, usage.remainingPct)) * 100}%`,
                height: '100%',
                background: usageColor,
                borderRadius: 5,
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
            {usage.allowanceRemaining} of {usage.planAllowance} plan allowance
            remaining
            {usage.topUpRemaining > 0 &&
              ` • ${usage.topUpRemaining} top-up credits remaining`}
          </div>

          {confirmedRequest && (
            <div
              style={{
                marginTop: 12,
                padding: 16,
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 6,
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: '#15803d' }}>
                Top-up request created
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 24,
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  letterSpacing: 1,
                  color: '#111827',
                }}
              >
                {confirmedRequest.reference}
              </div>
              <div style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>
                Use this code as the transfer narration •{' '}
                {confirmedRequest.conversations} conversations •{' '}
                {formatLkr(confirmedRequest.priceLkr)}
              </div>
              {confirmedRequest.bankDetails && (
                <pre
                  style={{
                    marginTop: 8,
                    padding: 12,
                    background: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: 6,
                    fontSize: 13,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit',
                    color: '#374151',
                  }}
                >
                  {confirmedRequest.bankDetails}
                </pre>
              )}
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <button
              onClick={() => setShowPackages(!showPackages)}
              style={{
                padding: '8px 16px',
                background:
                  usage.remainingPct <= 0
                    ? '#dc2626'
                    : usage.remainingPct <= 0.2
                    ? '#d97706'
                    : '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {showPackages ? 'Close package picker' : 'Request top-up'}
            </button>
          </div>

          {showPackages && (
            <div
              style={{
                marginTop: 12,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
              }}
            >
              {packages.length === 0 ? (
                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  Loading packages...
                </div>
              ) : (
                packages.map((p) => (
                  <button
                    key={p.conversations}
                    onClick={() => requestTopUp(p)}
                    style={{
                      padding: '10px 14px',
                      background: 'white',
                      border: '1px solid #d1d5db',
                      borderRadius: 8,
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 16, fontWeight: 700 }}>
                      {p.conversations}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      conversations
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: '#2563eb',
                        marginTop: 4,
                      }}
                    >
                      {formatLkr(p.priceLkr)}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {requests.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                Top-up requests
              </div>
              {requests.map((r) => {
                const st = requestStatusStyle(r.status);
                return (
                  <div
                    key={r.id}
                    style={{
                      fontSize: 13,
                      color: '#374151',
                      padding: '8px 0',
                      borderTop: '1px solid #f3f4f6',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {r.reference}
                      </span>
                      <span>
                        {r.conversations} conversations •{' '}
                        {formatLkr(r.priceLkr)}
                      </span>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: 10,
                          fontSize: 12,
                          fontWeight: 600,
                          color: st.color,
                          background: st.bg,
                        }}
                      >
                        {st.label}
                      </span>
                      <span style={{ color: '#9ca3af', fontSize: 12 }}>
                        {new Date(r.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {r.status === 'rejected' && r.staffNote && (
                      <div
                        style={{ marginTop: 4, fontSize: 12, color: '#b91c1c' }}
                      >
                        Reason: {r.staffNote}
                      </div>
                    )}
                    {r.status === 'pending_payment' && (
                      <div
                        style={{
                          marginTop: 6,
                          display: 'flex',
                          gap: 8,
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        <input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) =>
                            setSlipFiles((prev) => ({
                              ...prev,
                              [r.id]: e.target.files?.[0] || null,
                            }))
                          }
                          style={{ fontSize: 12 }}
                        />
                        <button
                          onClick={() => uploadSlip(r.id)}
                          style={{
                            padding: '6px 12px',
                            background: '#2563eb',
                            color: 'white',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 13,
                          }}
                        >
                          Upload slip
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {usage.topUps && usage.topUps.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                Top-up history
              </div>
              {usage.topUps.map((t) => (
                <div
                  key={t.id}
                  style={{
                    fontSize: 13,
                    color: '#374151',
                    padding: '4px 0',
                    borderTop: '1px solid #f3f4f6',
                  }}
                >
                  {new Date(t.createdAt).toLocaleDateString()} • +
                  {t.credits} credits • {formatLkr(t.priceLkr)}
                  {t.note ? ` • ${t.note}` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          marginTop: 24,
        }}
      >
        {statCard(
          'AI Resolution Rate',
          formatPct(data.aiResolutionRate),
          `${data.aiResolvedWithoutHandoff} resolved without handoff`,
        )}
        {statCard('Total Conversations', data.totalConversations)}
        {statCard('Active', data.activeConversations)}
        {statCard('Resolved', data.resolvedConversations)}
        {statCard(
          'Handoff Rate',
          formatPct(data.handoffRate),
          `${data.humanHandoffs} handoffs`,
        )}
        {statCard('Total Messages', data.totalMessages)}
        {statCard(
          'Avg Resolution Time',
          formatDuration(data.avgResolutionTimeMinutes),
        )}
        {statCard(
          'Avg Handoff Response',
          data.avgHandoffResponseSeconds == null
            ? '-'
            : `${data.avgHandoffResponseSeconds}s`,
        )}
        {statCard(
          'CSAT Average',
          data.csat.average == null ? '-' : `${data.csat.average} / 5`,
          `${data.csat.responses} responses`,
        )}
        {data.bookings &&
          statCard(
            'Bookings',
            data.bookings.total,
            <>
              {data.bookings.confirmed} confirmed • no-show{' '}
              {formatPct(data.bookings.noShowRate)}
              <br />
              {data.bookings.upcomingThisWeek} upcoming this week
            </>,
          )}
        {data.orders &&
          statCard(
            'Orders',
            data.orders.total,
            <>
              Revenue {formatLkr(data.orders.revenue)}
              <br />
              {Object.entries(data.orders.byStatus || {})
                .map(([s, n]) => `${s.replace(/_/g, ' ')}: ${n}`)
                .join(' • ')}
            </>,
          )}
        {data.tokens && (
          <>
            {statCard('Tokens (prompt)', data.tokens.prompt)}
            {statCard('Tokens (completion)', data.tokens.completion)}
            {statCard('Tokens (total)', data.tokens.total)}
            {statCard(
              'Estimated cost',
              `$${(data.estimatedCostUsd ?? 0) < 0.01 && (data.estimatedCostUsd ?? 0) > 0 ? (data.estimatedCostUsd ?? 0).toFixed(4) : (data.estimatedCostUsd ?? 0).toFixed(2)}`,
            )}
          </>
        )}
      </div>

      <div style={{ marginTop: 32 }}>
        <h2>Top Handoff Reasons</h2>
        <div
          style={{
            marginTop: 12,
            background: 'white',
            padding: 16,
            borderRadius: 8,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          }}
        >
          {data.topHandoffReasons.length === 0 ? (
            <div style={{ color: '#6b7280' }}>No handoffs yet</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6b7280', fontSize: 13 }}>
                  <th style={{ paddingBottom: 8 }}>Reason</th>
                  <th style={{ paddingBottom: 8 }}>Count</th>
                </tr>
              </thead>
              <tbody>
                {data.topHandoffReasons.map((r, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 0' }}>{r.reason}</td>
                    <td style={{ padding: '10px 0' }}>{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ marginTop: 32 }}>
        <h2>Daily Conversation Volume</h2>
        <div
          style={{
            marginTop: 12,
            background: 'white',
            padding: 16,
            borderRadius: 8,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'flex-end',
            gap: 12,
            height: 200,
          }}
        >
          {data.dailyVolume.map((d) => (
            <div
              key={d.date}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <div
                style={{
                  width: '100%',
                  background: '#2563eb',
                  borderRadius: 4,
                  minHeight: 4,
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
              <div style={{ fontSize: 11, color: '#6b7280' }}>
                {new Date(d.date).toLocaleDateString(undefined, {
                  weekday: 'short',
                })}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{d.count}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
