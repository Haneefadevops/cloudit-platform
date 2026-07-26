'use client';

import { useEffect, useState } from 'react';
import { isPortalUser } from '../portal';

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

const STATUS_STYLES: Record<
  TopUpRequestStatus,
  { color: string; bg: string; label: string }
> = {
  pending_payment: { color: '#92400e', bg: '#fef3c7', label: 'Pending payment' },
  slip_uploaded: { color: '#1d4ed8', bg: '#eff6ff', label: 'Slip uploaded' },
  approved: { color: '#15803d', bg: '#f0fdf4', label: 'Approved' },
  rejected: { color: '#b91c1c', bg: '#fef2f2', label: 'Rejected' },
  expired: { color: '#4b5563', bg: '#f3f4f6', label: 'Expired' },
};

const buttonStyle = (color: string): React.CSSProperties => ({
  padding: '6px 12px',
  background: color,
  color: 'white',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
});

const cardStyle: React.CSSProperties = {
  marginTop: 16,
  background: 'white',
  padding: 16,
  borderRadius: 8,
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
};

const badgeStyle = (color: string, bg: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 600,
  color,
  background: bg,
});

const formatLkr = (amount: number) => `LKR ${Number(amount).toLocaleString()}`;

export default function TopupsPage() {
  const [requests, setRequests] = useState<TopUpRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const token =
    (typeof window !== 'undefined' && localStorage.getItem('token')) || '';

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const showInfo = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 4000);
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
      showInfo('Failed to load slip');
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
      showInfo(data.message || 'Failed to approve request');
      return;
    }
    showInfo('Credits added');
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
      showInfo(data.message || 'Failed to reject request');
      return;
    }
    showInfo('Request rejected');
    fetchRequests();
  };

  const visible =
    statusFilter === 'all'
      ? requests
      : requests.filter((r) => r.status === statusFilter);

  return (
    <div>
      <h1>Top-up Requests</h1>
      <p style={{ color: '#6b7280', fontSize: 14 }}>
        Review bank-transfer top-up requests. Verify the slip, then approve to
        add credits or reject with a note.
      </p>

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

      <div
        style={{
          marginTop: 16,
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {(['all', ...STATUSES] as string[]).map((s) => {
          const active = statusFilter === s;
          const label =
            s === 'all'
              ? 'All'
              : STATUS_STYLES[s as TopUpRequestStatus].label;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: '6px 14px',
                borderRadius: 16,
                border: active ? '1px solid #2563eb' : '1px solid #d1d5db',
                background: active ? '#eff6ff' : 'white',
                color: active ? '#1d4ed8' : '#374151',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: active ? 600 : 400,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div style={cardStyle}>
        {loading ? (
          <div style={{ color: '#6b7280' }}>Loading…</div>
        ) : visible.length === 0 ? (
          <div style={{ color: '#6b7280' }}>No top-up requests found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr
                style={{ textAlign: 'left', color: '#6b7280', fontSize: 13 }}
              >
                <th style={{ paddingBottom: 8 }}>Client</th>
                <th style={{ paddingBottom: 8 }}>Reference</th>
                <th style={{ paddingBottom: 8 }}>Package</th>
                <th style={{ paddingBottom: 8 }}>Price</th>
                <th style={{ paddingBottom: 8 }}>Status</th>
                <th style={{ paddingBottom: 8 }}>Requested</th>
                <th style={{ paddingBottom: 8 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => {
                const st = STATUS_STYLES[r.status];
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '10px 8px 10px 0' }}>
                      {r.client?.name || '—'}
                    </td>
                    <td
                      style={{
                        padding: '10px 8px 10px 0',
                        fontFamily: 'monospace',
                        fontWeight: 600,
                      }}
                    >
                      {r.reference}
                    </td>
                    <td style={{ padding: '10px 8px 10px 0' }}>
                      {r.conversations} conversations
                    </td>
                    <td style={{ padding: '10px 8px 10px 0' }}>
                      {formatLkr(r.priceLkr)}
                    </td>
                    <td style={{ padding: '10px 8px 10px 0' }}>
                      <span style={badgeStyle(st.color, st.bg)}>{st.label}</span>
                      {r.status === 'rejected' && r.staffNote && (
                        <div
                          style={{
                            fontSize: 12,
                            color: '#b91c1c',
                            marginTop: 4,
                          }}
                        >
                          {r.staffNote}
                        </div>
                      )}
                    </td>
                    <td
                      style={{
                        padding: '10px 8px 10px 0',
                        fontSize: 13,
                        color: '#6b7280',
                      }}
                    >
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '10px 0' }}>
                      <div
                        style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
                      >
                        {r.slipMimeType && (
                          <button
                            onClick={() => viewSlip(r)}
                            style={buttonStyle('#6b7280')}
                          >
                            View slip
                          </button>
                        )}
                        {r.status === 'slip_uploaded' && (
                          <>
                            <button
                              onClick={() => approve(r)}
                              style={buttonStyle('#16a34a')}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => reject(r)}
                              style={buttonStyle('#dc2626')}
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
