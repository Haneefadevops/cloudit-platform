'use client';

import { useEffect, useState } from 'react';
import { getStoredUser, isPortalUser } from '../portal';
import { apiFetch } from '@/lib/api';
import {
  Badge,
  Card,
  EmptyState,
  PageLoading,
  Table,
  TD,
  TH,
  THead,
  TR,
  cx,
} from '@/components/ui';

interface ProviderRef {
  model: string;
  provider: string;
  isOverride?: boolean;
}

interface ChatStatus {
  primary: ProviderRef;
  fallback: ProviderRef | null;
  failoverConfigured: boolean;
  serving: 'primary' | 'fallback';
}

interface FailoverEvent {
  id: string;
  source: string;
  fromModel: string;
  toModel: string;
  error: string;
  createdAt: string;
}

interface ProviderStatus {
  chat: ChatStatus;
  vision: ProviderRef;
  whisper: ProviderRef;
  embeddings: ProviderRef;
  lastFailover: FailoverEvent | null;
  recentEvents: FailoverEvent[];
}

interface ModelUsage {
  model: string;
  requests: number;
  prompt: number;
  completion: number;
  total: number;
}

interface ClientMargin {
  clientId: string;
  clientName: string;
  conversations: number;
  requests: number;
  prompt: number;
  completion: number;
  estimatedCostUsd: number;
}

const RANGES: { value: string; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '', label: 'All time' },
];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const formatCost = (usd: number) => `$${usd.toFixed(4)}`;

export default function AiModelsPage() {
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<string>('7d');
  const [usage, setUsage] = useState<ModelUsage[] | null>(null);
  const [margins, setMargins] = useState<ClientMargin[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const token =
    (typeof window !== 'undefined' && localStorage.getItem('token')) || '';

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    if (!token) {
      window.location.href = '/login';
      return;
    }
    const user = getStoredUser();
    if (isPortalUser(user)) {
      window.location.href = '/dashboard/bookings';
      return;
    }
    setIsAdmin(user?.role === 'admin');

    const load = async () => {
      try {
        const res = await apiFetch('/api/ai/providers/status', { headers });
        if (res.ok) setStatus(await res.json());
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (loading || !status) return;
    const qs = range ? `?range=${range}` : '';
    const load = async () => {
      const usageRes = await apiFetch(`/api/ai/providers/usage${qs}`, {
        headers,
      });
      if (usageRes.ok) {
        const list = await usageRes.json();
        setUsage(Array.isArray(list) ? list : []);
      }
      if (isAdmin) {
        const marginsRes = await apiFetch(`/api/ai/providers/margins${qs}`, {
          headers,
        });
        // 403 for non-owners: keep the block hidden
        if (marginsRes.ok) {
          const list = await marginsRes.json();
          setMargins(Array.isArray(list) ? list : []);
        }
      }
    };
    load();
  }, [range, loading, status, isAdmin]);

  const rangePills = (
    <div className="flex flex-wrap items-center gap-2">
      {RANGES.map((r) => {
        const active = range === r.value;
        return (
          <button
            key={r.value || 'all'}
            onClick={() => setRange(r.value)}
            className={cx(
              'rounded-full border px-3.5 py-1.5 text-[13px] transition-colors',
              active
                ? 'border-brand-indigo bg-indigo-50 font-semibold text-brand-indigo'
                : 'border-line bg-white text-brand-navy hover:bg-page',
            )}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );

  const modelLine = (ref: ProviderRef) => (
    <>
      <div className="font-mono text-[13px] font-semibold text-brand-navy">
        {ref.model}
      </div>
      <div className="text-xs text-muted">{ref.provider}</div>
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm text-muted">
        Which AI providers and models power the platform, and what they cost.
      </p>

      {loading ? (
        <Card>
          <PageLoading />
        </Card>
      ) : !status ? (
        <EmptyState title="Provider status unavailable" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Chat AI
                </div>
                {status.chat.serving === 'primary' ? (
                  <Badge tone="green">Serving: primary</Badge>
                ) : (
                  <Badge tone="amber">Serving: fallback (degraded)</Badge>
                )}
              </div>
              {modelLine(status.chat.primary)}
              {status.chat.primary.isOverride && (
                <div className="mt-1 text-[11px] text-muted">
                  Manual override active
                </div>
              )}
              <div className="mt-2 border-t border-line pt-2 text-[13px] text-muted">
                Fallback:{' '}
                <span className="font-mono text-brand-navy">
                  {status.chat.fallback
                    ? status.chat.fallback.model
                    : 'not configured'}
                </span>
              </div>
            </Card>
            <Card>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Vision
              </div>
              {modelLine(status.vision)}
            </Card>
            <Card>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Voice notes (Whisper)
              </div>
              {modelLine(status.whisper)}
            </Card>
            <Card>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Knowledge base (Embeddings)
              </div>
              {modelLine(status.embeddings)}
            </Card>
          </div>

          <Card title="Failover events">
            {status.recentEvents.length === 0 ? (
              <EmptyState title="No failovers recorded — primary provider is healthy" />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Time</TH>
                    <TH>Source</TH>
                    <TH>From → To</TH>
                    <TH>Error</TH>
                  </tr>
                </THead>
                <tbody>
                  {status.recentEvents.map((e) => (
                    <TR key={e.id}>
                      <TD className="whitespace-nowrap text-[13px] text-muted">
                        {formatDate(e.createdAt)}
                      </TD>
                      <TD className="text-[13px]">{e.source}</TD>
                      <TD className="whitespace-nowrap font-mono text-[13px]">
                        {e.fromModel} → {e.toModel}
                      </TD>
                      <TD className="max-w-[280px]">
                        <span className="block truncate text-[13px] text-muted">
                          {e.error}
                        </span>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <div className="flex flex-col gap-4">
            {rangePills}

            <Card title="Token usage per model">
              {usage === null ? (
                <PageLoading />
              ) : usage.length === 0 ? (
                <EmptyState title="No usage recorded for this range" />
              ) : (
                <Table>
                  <THead>
                    <tr>
                      <TH>Model</TH>
                      <TH>Requests</TH>
                      <TH>Input tokens</TH>
                      <TH>Output tokens</TH>
                      <TH>Total tokens</TH>
                    </tr>
                  </THead>
                  <tbody>
                    {usage.map((u) => (
                      <TR key={u.model}>
                        <TD className="font-mono text-[13px] font-semibold">
                          {u.model}
                        </TD>
                        <TD className="text-[13px]">
                          {u.requests.toLocaleString()}
                        </TD>
                        <TD className="text-[13px]">
                          {u.prompt.toLocaleString()}
                        </TD>
                        <TD className="text-[13px]">
                          {u.completion.toLocaleString()}
                        </TD>
                        <TD className="text-[13px]">
                          {u.total.toLocaleString()}
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card>

            {isAdmin && (
              <Card title="Cost & margins (owner only)">
                <p className="m-0 mb-3 text-xs text-muted">
                  Estimated from per-model prices (AI_MODEL_PRICES) — revenue
                  per conversation is your pricing minus this cost.
                </p>
                {margins === null ? (
                  <PageLoading />
                ) : margins.length === 0 ? (
                  <EmptyState title="No usage recorded for this range" />
                ) : (
                  <Table>
                    <THead>
                      <tr>
                        <TH>Client</TH>
                        <TH>Conversations</TH>
                        <TH>Requests</TH>
                        <TH>Tokens</TH>
                        <TH>Est. cost</TH>
                      </tr>
                    </THead>
                    <tbody>
                      {margins.map((m) => (
                        <TR key={m.clientId}>
                          <TD className="text-[13px] text-brand-navy">
                            {m.clientName}
                          </TD>
                          <TD className="text-[13px]">
                            {m.conversations.toLocaleString()}
                          </TD>
                          <TD className="text-[13px]">
                            {m.requests.toLocaleString()}
                          </TD>
                          <TD className="text-[13px]">
                            {(m.prompt + m.completion).toLocaleString()}
                          </TD>
                          <TD className="text-[13px]">
                            {formatCost(m.estimatedCostUsd)}
                          </TD>
                        </TR>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
