'use client';

import { useEffect, useState } from 'react';
import { isPortalUser } from '../portal';
import {
  Button,
  Card,
  EmptyState,
  PageLoading,
  StatusBadge,
  Table,
  TD,
  TH,
  THead,
  TR,
  cx,
  useToast,
} from '@/components/ui';

type TopUpRequestStatus =
  | 'pending_payment'
  | 'slip_uploaded'
  | 'approved'
  | 'rejected'
  | 'expired';

interface TopUpRequest {
  id: string;
  reference: string;
  conversations: number;
  priceLkr: number;
  status: TopUpRequestStatus;
  staffNote?: string | null;
  createdAt: string;
  slipMimeType?: string | null;
  client: { id: string; name: string };
}

const STATUSES: TopUpRequestStatus[] = [
  'pending_payment',
  'slip_uploaded',
  'approved',
  'rejected',
  'expired',
];

const STATUS_LABELS: Record<TopUpRequestStatus, string> = {
  pending_payment: 'Pending payment',
  slip_uploaded: 'Slip uploaded',
  approved: 'Approved',
  rejected: 'Rejected',
  expired: 'Expired',
};

const formatLkr = (amount: number) => `LKR ${Number(amount).toLocaleString()}`;

export default function TopupsPage() {
  const [requests, setRequests] = useState<TopUpRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const token =
    (typeof window !== 'undefined' && localStorage.getItem('token')) || '';

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/usage/topup-requests', { headers });
      const list = await res.json();
      setRequests(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      window.location.href = '/login';
      return;
    }
    if (isPortalUser()) {
      window.location.href = '/dashboard/bookings';
      return;
    }
    fetchRequests();
  }, []);

  const viewSlip = async (request: TopUpRequest) => {
    const res = await fetch(`/api/usage/topup-requests/${request.id}/slip`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      toast('Failed to load slip', 'error');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const approve = async (request: TopUpRequest) => {
    if (
      !confirm(
        `Approve ${request.reference} and add ${request.conversations} credits to ${request.client?.name}?`,
      )
    )
      return;
    const res = await fetch(
      `/api/usage/topup-requests/${request.id}/approve`,
      { method: 'POST', headers },
    );
    const data = await res.json();
    if (!res.ok) {
      toast(data.message || 'Failed to approve request', 'error');
      return;
    }
    toast('Credits added', 'success');
    fetchRequests();
  };

  const reject = async (request: TopUpRequest) => {
    const note = prompt(`Rejection note for ${request.reference} (required):`);
    if (!note || !note.trim()) return;
    const res = await fetch(`/api/usage/topup-requests/${request.id}/reject`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ note: note.trim() }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.message || 'Failed to reject request', 'error');
      return;
    }
    toast('Request rejected', 'success');
    fetchRequests();
  };

  const visible =
    statusFilter === 'all'
      ? requests
      : requests.filter((r) => r.status === statusFilter);

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm text-muted">
        Review bank-transfer top-up requests. Verify the slip, then approve to
        add credits or reject with a note.
      </p>

      <div className="flex flex-wrap gap-2">
        {(['all', ...STATUSES] as string[]).map((s) => {
          const active = statusFilter === s;
          const label =
            s === 'all'
              ? 'All'
              : STATUS_LABELS[s as TopUpRequestStatus];
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cx(
                'rounded-full border px-3.5 py-1.5 text-[13px] transition-colors',
                active
                  ? 'border-brand-indigo bg-brand-indigo/10 font-semibold text-brand-indigo'
                  : 'border-line bg-white font-normal text-brand-navy hover:bg-page',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      <Card>
        {loading ? (
          <PageLoading />
        ) : visible.length === 0 ? (
          <EmptyState title="No top-up requests found" />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Client</TH>
                <TH>Reference</TH>
                <TH>Package</TH>
                <TH>Price</TH>
                <TH>Status</TH>
                <TH>Requested</TH>
                <TH>Actions</TH>
              </tr>
            </THead>
            <tbody>
              {visible.map((r) => (
                <TR key={r.id}>
                  <TD>{r.client?.name || '—'}</TD>
                  <TD className="font-mono font-semibold">{r.reference}</TD>
                  <TD>{r.conversations} conversations</TD>
                  <TD>{formatLkr(r.priceLkr)}</TD>
                  <TD>
                    <StatusBadge status={r.status} />
                    {r.status === 'rejected' && r.staffNote && (
                      <div className="mt-1 text-xs text-red-700">
                        {r.staffNote}
                      </div>
                    )}
                  </TD>
                  <TD className="text-[13px] text-muted">
                    {new Date(r.createdAt).toLocaleString()}
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1.5">
                      {r.slipMimeType && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => viewSlip(r)}
                        >
                          View slip
                        </Button>
                      )}
                      {r.status === 'slip_uploaded' && (
                        <>
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => approve(r)}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => reject(r)}
                          >
                            Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
