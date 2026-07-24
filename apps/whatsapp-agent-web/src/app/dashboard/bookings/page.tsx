'use client';

import { useEffect, useState } from 'react';

interface Client {
  id: string;
  name: string;
  bookingsEnabled?: boolean;
}

interface StoredUser {
  id: string;
  name: string;
  email: string;
  role: string;
  clientId?: string | null;
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

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

// Monday-first week helpers (viewer's local timezone)
const startOfWeek = (d: Date) => {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0 = Sunday
  date.setDate(date.getDate() - ((day + 6) % 7));
  return date;
};

const addDays = (d: Date, n: number) => {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function BookingsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [isPortalUser, setIsPortalUser] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [view, setView] = useState<'list' | 'calendar'>('list');

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [calendarBookings, setCalendarBookings] = useState<Booking[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(
    null,
  );

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

  // Calendar fetches the whole visible week with no status filter.
  const fetchCalendar = async (clientId: string, start: Date) => {
    if (!clientId) return;
    setCalendarLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('from', start.toISOString());
      // End of Sunday (inclusive) — backend applies `to` as lte.
      params.set('to', addDays(start, 7).toISOString());
      const res = await fetch(
        `/api/bookings/${clientId}/bookings?${params.toString()}`,
        { headers },
      );
      const list = await res.json();
      setCalendarBookings(Array.isArray(list) ? list : []);
    } finally {
      setCalendarLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      window.location.href = '/login';
      return;
    }
    // Portal users (client_admin/client_staff) are locked to their own client.
    let user: StoredUser | null = null;
    try {
      const raw = localStorage.getItem('user');
      if (raw) user = JSON.parse(raw);
    } catch {
      user = null;
    }
    if (
      user &&
      (user.role === 'client_admin' || user.role === 'client_staff') &&
      user.clientId
    ) {
      setIsPortalUser(true);
      setSelectedId(user.clientId);
      return;
    }
    fetchClients();
  }, []);

  useEffect(() => {
    if (view === 'list') fetchBookings(selectedId);
  }, [selectedId, statusFilter, fromDate, toDate, view]);

  useEffect(() => {
    if (view === 'calendar') fetchCalendar(selectedId, weekStart);
  }, [selectedId, weekStart, view]);

  const refreshCurrentView = () => {
    if (view === 'calendar') fetchCalendar(selectedId, weekStart);
    else fetchBookings(selectedId);
  };

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
    refreshCurrentView();
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

  const weekEnd = addDays(weekStart, 6);
  const weekRangeLabel = `${weekStart.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })} – ${weekEnd.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`;

  const bookingsForDay = (day: Date) => {
    const key = day.toDateString();
    return calendarBookings
      .filter((b) => new Date(b.startAt).toDateString() === key)
      .sort(
        (a, b) =>
          new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
      );
  };

  return (
    <div>
      <h1>Bookings</h1>
      <p style={{ color: '#6b7280', fontSize: 14 }}>
        View and manage bookings per client. Confirming or cancelling a booking
        automatically messages the customer on WhatsApp. Times are shown in
        your browser&apos;s timezone.
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
          gap: 16,
          alignItems: 'flex-end',
          flexWrap: 'wrap',
        }}
      >
        {!isPortalUser && (
          <div style={{ maxWidth: 320, flex: 1 }}>
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
        )}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600 }}>View</label>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <button
              onClick={() => setView('list')}
              style={buttonStyle(view === 'list' ? '#111827' : '#9ca3af')}
            >
              List
            </button>
            <button
              onClick={() => setView('calendar')}
              style={buttonStyle(view === 'calendar' ? '#111827' : '#9ca3af')}
            >
              Calendar
            </button>
          </div>
        </div>
      </div>

      {selectedId && view === 'list' && (
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

      {selectedId && view === 'calendar' && (
        <div style={cardStyle}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              style={buttonStyle('#6b7280')}
            >
              ‹ Prev week
            </button>
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              style={buttonStyle('#2563eb')}
            >
              Today
            </button>
            <button
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              style={buttonStyle('#6b7280')}
            >
              Next week ›
            </button>
            <h2 style={{ fontSize: 16, margin: 0, marginLeft: 8 }}>
              {weekRangeLabel}
            </h2>
          </div>

          {calendarLoading ? (
            <div style={{ marginTop: 16, color: '#6b7280' }}>Loading…</div>
          ) : (
            <div
              style={{
                marginTop: 16,
                display: 'grid',
                gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                gap: 8,
              }}
            >
              {DAY_LABELS.map((label, i) => {
                const day = addDays(weekStart, i);
                const dayBookings = bookingsForDay(day);
                const isToday =
                  day.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={label}
                    style={{
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      minHeight: 120,
                      background: isToday ? '#f0f9ff' : 'white',
                    }}
                  >
                    <div
                      style={{
                        padding: '6px 8px',
                        borderBottom: '1px solid #e5e7eb',
                        fontSize: 12,
                        fontWeight: 600,
                        color: isToday ? '#0369a1' : '#6b7280',
                      }}
                    >
                      {label}{' '}
                      {day.toLocaleDateString(undefined, {
                        month: 'numeric',
                        day: 'numeric',
                      })}
                    </div>
                    <div
                      style={{
                        padding: 6,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      {dayBookings.map((b) => {
                        const colors = STATUS_COLORS[b.status];
                        const expanded = expandedBookingId === b.id;
                        return (
                          <div
                            key={b.id}
                            onClick={() =>
                              setExpandedBookingId(expanded ? null : b.id)
                            }
                            style={{
                              borderLeft: `4px solid ${colors.color}`,
                              background: colors.bg,
                              borderRadius: 4,
                              padding: '4px 6px',
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>
                              {formatTime(b.startAt)} · {b.service?.name}
                            </div>
                            <div style={{ color: '#374151' }}>
                              {b.customer?.name}
                              {b.staff?.name ? ` · ${b.staff.name}` : ''}
                            </div>
                            {expanded && (
                              <div style={{ marginTop: 6 }}>
                                <div style={{ marginBottom: 6 }}>
                                  <span
                                    style={badgeStyle(colors.color, 'white')}
                                  >
                                    {STATUS_LABELS[b.status]}
                                  </span>
                                </div>
                                <div
                                  style={{
                                    color: '#6b7280',
                                    marginBottom: 6,
                                  }}
                                >
                                  {b.customer?.phoneNumber}
                                  {b.notes ? ` · ${b.notes}` : ''}
                                </div>
                                {renderActions(b)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {dayBookings.length === 0 && (
                        <div style={{ fontSize: 12, color: '#d1d5db' }}>—</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
