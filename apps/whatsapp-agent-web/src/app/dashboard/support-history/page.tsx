'use client';

import { useEffect, useState } from 'react';
import { getStoredUser, isPortalUser } from '../portal';
import { apiFetch } from '@/lib/api';
import {
  Badge,
  Card,
  EmptyState,
  Input,
  Modal,
  PageLoading,
  Select,
  StatusBadge,
  Table,
  TD,
  TH,
  THead,
  TR,
  cx,
} from '@/components/ui';

interface Client {
  id: string;
  name: string;
}

interface HandoffLog {
  triggeredBy: string;
  reason: string | null;
  createdAt: string;
  resolvedAt: string | null;
  responseTimeSeconds: number | null;
  customerSatisfaction: number | null;
}

interface Ticket {
  id: string;
  status: string;
  channel: string | null;
  ticketRef: string | null;
  handoffReason: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  csatRating: number | null;
  csatFeedback: string | null;
  customer: { name: string | null; phoneNumber?: string | null; channel?: string | null; channelSourceId?: string | null } | null;
  assignedTo: { id: string; name: string } | null;
  handoffLogs: HandoffLog[];
  _count: { messages: number };
}

interface TicketMessage {
  id: string;
  senderType: 'customer' | 'bot' | 'agent' | string;
  content: string;
  createdAt: string;
}

interface TicketDetail extends Ticket {
  messages: TicketMessage[];
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'resolved', label: 'Resolved' },
];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

const formatDuration = (from: string, to: string | null) => {
  if (!to) return '—';
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (ms < 0) return '—';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return '<1m';
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);
  return parts.join(' ');
};

const formatCsat = (rating: number | null) => {
  if (!rating) return '—';
  return `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} ${rating}`;
};

const statusLabel = (status: string) =>
  status === 'human' ? 'Open' : status === 'resolved' ? 'Resolved' : status;

export default function SupportHistoryPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [portal, setPortal] = useState(false);

  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const token =
    (typeof window !== 'undefined' && localStorage.getItem('token')) || '';

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const fetchClients = async () => {
    const res = await apiFetch('/api/clients', { headers });
    const list = await res.json();
    const arr = Array.isArray(list) ? list : [];
    setClients(arr);
    if (!selectedId && arr.length > 0) setSelectedId(arr[0].id);
  };

  const fetchTickets = async (clientId: string) => {
    if (!clientId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      const qs = params.toString();
      const res = await apiFetch(
        `/api/conversations/client/${clientId}/tickets${qs ? `?${qs}` : ''}`,
        { headers },
      );
      const list = await res.json();
      setTickets(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      window.location.href = '/login';
      return;
    }
    const user = getStoredUser();
    if (isPortalUser(user)) {
      setPortal(true);
      if (user?.clientId) setSelectedId(user.clientId);
      return;
    }
    fetchClients();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    fetchTickets(selectedId);
  }, [selectedId, statusFilter, debouncedSearch]);

  const openDetail = async (ticket: Ticket) => {
    if (!selectedId) return;
    setDetail({ ...ticket, messages: [] });
    setDetailLoading(true);
    try {
      const res = await apiFetch(
        `/api/conversations/client/${selectedId}/tickets/${ticket.id}`,
        { headers },
      );
      if (!res.ok) {
        setDetail(null);
        return;
      }
      const data = await res.json();
      setDetail(data);
    } finally {
      setDetailLoading(false);
    }
  };

  const renderBubble = (msg: TicketMessage) => {
    const isCustomer = msg.senderType === 'customer';
    const isAgent = msg.senderType === 'agent';
    const label = isCustomer
      ? detail?.customer?.name || 'Customer'
      : isAgent
        ? detail?.assignedTo?.name || 'Agent'
        : 'AI';
    return (
      <div
        key={msg.id}
        className={cx('flex', isCustomer ? 'justify-end' : 'justify-start')}
      >
        <div className={cx('max-w-[80%]', isCustomer ? 'text-right' : '')}>
          <div className="mb-0.5 text-[11px] text-muted">
            {label} • {formatTime(msg.createdAt)}
          </div>
          <div
            className={cx(
              'inline-block whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-left text-[13px]',
              isCustomer
                ? 'bg-brand-gradient text-white'
                : isAgent
                  ? 'border border-brand-indigo/30 bg-indigo-50 text-brand-navy'
                  : 'bg-page text-brand-navy',
            )}
          >
            {msg.content}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm text-muted">
        Every conversation that was handed to a human, with its full history.
      </p>

      {!portal && (
        <div className="w-full max-w-xs">
          <Select
            label="Client"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">Select a client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {selectedId && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setStatusFilter(f.value)}
                  className={cx(
                    'rounded-full border px-3.5 py-1.5 text-[13px] transition-colors',
                    active
                      ? 'border-brand-indigo bg-indigo-50 font-semibold text-brand-indigo'
                      : 'border-line bg-white text-brand-navy hover:bg-page',
                  )}
                >
                  {f.label}
                </button>
              );
            })}
            <div className="w-full sm:ml-auto sm:w-64">
              <Input
                placeholder="Search ref, customer, or phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <Card>
            {loading ? (
              <PageLoading />
            ) : tickets.length === 0 ? (
              <EmptyState title="No support tickets yet" />
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Ticket</TH>
                    <TH>Customer</TH>
                    <TH>Channel</TH>
                    <TH>Reason</TH>
                    <TH>Opened</TH>
                    <TH>Resolved</TH>
                    <TH>Duration</TH>
                    <TH>CSAT</TH>
                    <TH>Status</TH>
                  </tr>
                </THead>
                <tbody>
                  {tickets.map((t) => (
                    <TR key={t.id} onClick={() => openDetail(t)}>
                      <TD className="font-mono font-semibold">
                        {t.ticketRef || '—'}
                      </TD>
                      <TD>
                        <div className="text-brand-navy">
                          {t.customer?.name || '—'}
                        </div>
                        <div className="text-xs text-muted">
                          {t.customer?.phoneNumber || '—'}
                          {t.customer?.channelSourceId ? ` • ${t.customer.channelSourceId}` : ''}
                        </div>
                      </TD>
                      <TD>
                        {t.channel ? (
                          <Badge tone={t.channel === 'whatsapp' ? 'teal' : t.channel === 'messenger' ? 'blue' : 'amber'}>
                            {t.channel}
                          </Badge>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </TD>
                      <TD className="max-w-[220px]">
                        <span className="block truncate text-[13px]">
                          {t.handoffReason || '—'}
                        </span>
                      </TD>
                      <TD className="text-[13px] text-muted">
                        {formatDate(t.createdAt)}
                      </TD>
                      <TD className="text-[13px] text-muted">
                        {t.resolvedAt ? formatDate(t.resolvedAt) : '—'}
                      </TD>
                      <TD className="text-[13px]">
                        {formatDuration(t.createdAt, t.resolvedAt)}
                      </TD>
                      <TD className="text-[13px] text-amber-500">
                        {formatCsat(t.csatRating)}
                      </TD>
                      <TD>
                        <StatusBadge status={statusLabel(t.status)} />
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      )}

      <Modal
        open={detail !== null}
        onClose={() => setDetail(null)}
        title={detail?.ticketRef || 'Ticket'}
        wide
      >
        {detail && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
              <span className="font-medium text-brand-navy">
                {detail.customer?.name || '—'}
                {detail.customer?.phoneNumber
                  ? ` • ${detail.customer.phoneNumber}`
                  : detail.customer?.channelSourceId
                    ? ` • ${detail.customer.channelSourceId}`
                    : ''}
              </span>
              {detail.customer?.channel && (
                <Badge tone={detail.customer.channel === 'whatsapp' ? 'teal' : detail.customer.channel === 'messenger' ? 'blue' : 'amber'}>
                  {detail.customer.channel}
                </Badge>
              )}
              <StatusBadge status={statusLabel(detail.status)} />
              {detail.csatRating && (
                <span className="text-amber-500">
                  {formatCsat(detail.csatRating)}
                </span>
              )}
              <span>Opened {formatDate(detail.createdAt)}</span>
              <span>
                Resolved{' '}
                {detail.resolvedAt ? formatDate(detail.resolvedAt) : '—'}
              </span>
              {detail.assignedTo && <span>Agent: {detail.assignedTo.name}</span>}
            </div>

            {detail.csatFeedback && (
              <div className="rounded-lg border border-line bg-page px-3 py-2 text-[13px] text-brand-navy">
                <strong>Customer feedback:</strong> {detail.csatFeedback}
              </div>
            )}

            {detail.summary && (
              <div className="rounded-lg border border-line bg-page px-3 py-2 text-[13px] text-brand-navy">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                  AI Summary
                </div>
                {detail.summary}
              </div>
            )}

            {detailLoading ? (
              <PageLoading />
            ) : detail.messages.length === 0 ? (
              <EmptyState title="No messages in this conversation" />
            ) : (
              <div className="flex max-h-[50vh] flex-col gap-2.5 overflow-y-auto rounded-lg border border-line p-3">
                {detail.messages.map(renderBubble)}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
