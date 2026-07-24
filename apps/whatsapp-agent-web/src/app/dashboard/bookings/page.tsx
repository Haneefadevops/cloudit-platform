'use client';

import { useEffect, useState } from 'react';

interface Client {
  id: string;
  name: string;
  bookingsEnabled?: boolean;
}

type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show';

interface Booking {
  id: string;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  notes?: string | null;
  intakeAnswers?: Record<string, string> | null;
  reminderSentAt?: string | null;
  service: { name: string; durationMinutes: number; price?: number | null };
  staff?: { name: string } | null;
  customer: { name: string; phoneNumber: string };
}

const STATUSES: BookingStatus[] = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
];

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
};

const STATUS_COLORS: Record<BookingStatus, { color: string; bg: string }> = {
  pending: { color: '#92400e', bg: '#fef3c7' },
  confirmed: { color: '#15803d', bg: '#f0fdf4' },
  completed: { color: '#1d4ed8', bg: '#eff6ff' },
  cancelled: { color: '#b91c1c', bg: '#fef2f2' },
  no_show: { color: '#4b5563', bg: '#f3f4f6' },
};

const inputStyle: React.CSSProperties = {
  padding: 8,
  borderRadius: 4,
  border: '1px solid #d1d5db',
  fontSize: 14,
  width: '100%',
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

const formatStartAt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export default function BookingsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [loading, setLoading] = useState(false);

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

  const fetchClients = async () => {
    const res = await fetch('/api/clients', { headers });
    const list = await res.json();
    const arr = Array.isArray(list) ? list : [];
    setClients(arr);
    if (!selectedId && arr.length > 0) setSelectedId(arr[0].id);
  };

  const fetchBookings = async (clientId: string) => {
    if (!clientId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      const qs = params.toString();
      const res = await fetch(
        `/api/bookings/${clientId}/bookings${qs ? `?${qs}` : ''}`,
        { headers },
      );
      const list = await res.json();
      setBookings(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      window.location.href = '/login';
      return;
    }
    fetchClients();
  }, []);

  useEffect(() => {
    fetchBookings(selectedId);
  }, [selectedId, statusFilter, fromDate, toDate]);

  const updateStatus = async (booking: Booking, status: BookingStatus) => {
    if (!selectedId) return;
    const res = await fetch(
      `/api/bookings/${selectedId}/bookings/${booking.id}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status }),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      showInfo(data.message || 'Failed to update booking');
      return;
    }
    showInfo(`Booking ${STATUS_LABELS[status].toLowerCase()}`);
    fetchBookings(selectedId);
  };

  const handleAction = (booking: Booking, status: BookingStatus) => {
    if (status === 'cancelled') {
      if (!confirm('Cancel this booking? The customer will be notified on WhatsApp.'))
        return;
    }
    updateStatus(booking, status);
  };

  const intakeEntries = (booking: Booking): [string, string][] =>
    Object.entries(booking.intakeAnswers || {}).filter(
      ([, v]) => v !== null && v !== undefined && String(v).trim() !== '',
    );

  const renderActions = (booking: Booking) => {
    if (booking.status === 'pending') {
      return (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => handleAction(booking, 'confirmed')}
            style={buttonStyle('#16a34a')}
          >
            Confirm
          </button>
          <button
            onClick={() => handleAction(booking, 'cancelled')}
            style={buttonStyle('#dc2626')}
          >
            Cancel
          </button>
        </div>
      );
    }
    if (booking.status === 'confirmed') {
      return (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => handleAction(booking, 'completed')}
            style={buttonStyle('#2563eb')}
          >
            Complete
          </button>
          <button
            onClick={() => handleAction(booking, 'no_show')}
            style={buttonStyle('#6b7280')}
          >
            No-show
          </button>
          <button
            onClick={() => handleAction(booking, 'cancelled')}
            style={buttonStyle('#dc2626')}
          >
            Cancel
          </button>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      <h1>Bookings</h1>
      <p style={{ color: '#6b7280', fontSize: 14 }}>
        View and manage bookings per client. Confirming or cancelling a booking
        automatically messages the customer on WhatsApp.
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

      <div style={{ marginTop: 16, maxWidth: 320 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Client</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{ ...inputStyle, marginTop: 4 }}
        >
          <option value="">Select a client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.bookingsEnabled ? '' : ' (bookings disabled)'}
            </option>
          ))}
        </select>
      </div>

      {selectedId && (
        <>
          <div
            style={{
              ...cardStyle,
              display: 'flex',
              gap: 16,
              alignItems: 'flex-end',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ width: 180 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ ...inputStyle, marginTop: 4 }}
              >
                <option value="all">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ width: 160 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{ ...inputStyle, marginTop: 4 }}
              />
            </div>
            <div style={{ width: 160 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{ ...inputStyle, marginTop: 4 }}
              />
            </div>
          </div>

          <div style={cardStyle}>
            {loading ? (
              <div style={{ color: '#6b7280' }}>Loading…</div>
            ) : bookings.length === 0 ? (
              <div style={{ color: '#6b7280' }}>No bookings found</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr
                    style={{ textAlign: 'left', color: '#6b7280', fontSize: 13 }}
                  >
                    <th style={{ paddingBottom: 8 }}>When</th>
                    <th style={{ paddingBottom: 8 }}>Service</th>
                    <th style={{ paddingBottom: 8 }}>Staff</th>
                    <th style={{ paddingBottom: 8 }}>Customer</th>
                    <th style={{ paddingBottom: 8 }}>Status</th>
                    <th style={{ paddingBottom: 8 }}>Details</th>
                    <th style={{ paddingBottom: 8 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => {
                    const answers = intakeEntries(b);
                    return (
                      <tr key={b.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px 8px 10px 0' }}>
                          {formatStartAt(b.startAt)}
                        </td>
                        <td style={{ padding: '10px 8px 10px 0' }}>
                          {b.service?.name}
                          <div style={{ fontSize: 12, color: '#6b7280' }}>
                            {b.service?.durationMinutes} min
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px 10px 0' }}>
                          {b.staff?.name || '—'}
                        </td>
                        <td style={{ padding: '10px 8px 10px 0' }}>
                          {b.customer?.name}
                          <div style={{ fontSize: 12, color: '#6b7280' }}>
                            {b.customer?.phoneNumber}
                          </div>
                        </td>
                        <td style={{ padding: '10px 8px 10px 0' }}>
                          <span
                            style={badgeStyle(
                              STATUS_COLORS[b.status].color,
                              STATUS_COLORS[b.status].bg,
                            )}
                          >
                            {STATUS_LABELS[b.status]}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: '10px 8px 10px 0',
                            fontSize: 12,
                            color: '#374151',
                          }}
                        >
                          {answers.length > 0 && (
                            <details>
                              <summary
                                style={{ cursor: 'pointer', color: '#2563eb' }}
                              >
                                {answers.length} intake answer
                                {answers.length === 1 ? '' : 's'}
                              </summary>
                              <div style={{ marginTop: 4 }}>
                                {answers.map(([q, a]) => (
                                  <div key={q}>
                                    <strong>{q}</strong>: {a}
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                          {b.notes && (
                            <div style={{ marginTop: answers.length ? 4 : 0 }}>
                              <strong>Notes:</strong> {b.notes}
                            </div>
                          )}
                          {answers.length === 0 && !b.notes && '—'}
                        </td>
                        <td style={{ padding: '10px 0' }}>
                          {renderActions(b)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
