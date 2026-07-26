'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  EmptyState,
  Input,
  PageLoading,
  Select,
  StatusBadge,
  Table,
  TD,
  TH,
  THead,
  TR,
  statusTone,
  useToast,
  type BadgeTone,
} from '@/components/ui';

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

// Status-colored calendar blocks, keyed by the same tone StatusBadge uses.
const TONE_BLOCK_CLASSES: Record<BadgeTone, string> = {
  amber: 'border-amber-500 bg-amber-50',
  teal: 'border-teal-500 bg-teal-50',
  green: 'border-green-600 bg-green-50',
  gray: 'border-gray-400 bg-gray-50',
  red: 'border-red-500 bg-red-50',
  navy: 'border-brand-navy bg-page',
  indigo: 'border-indigo-500 bg-indigo-50',
  blue: 'border-blue-600 bg-blue-50',
};

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
  const toast = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [isPortalUser, setIsPortalUser] = useState(false);

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
      toast(data.message || 'Failed to update booking', 'error');
      return;
    }
    toast(`Booking ${STATUS_LABELS[status].toLowerCase()}`, 'success');
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
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            onClick={() => handleAction(booking, 'confirmed')}
          >
            Confirm
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleAction(booking, 'cancelled')}
          >
            Cancel
          </Button>
        </div>
      );
    }
    if (booking.status === 'confirmed') {
      return (
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            onClick={() => handleAction(booking, 'completed')}
          >
            Complete
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleAction(booking, 'no_show')}
          >
            No-show
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleAction(booking, 'cancelled')}
          >
            Cancel
          </Button>
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
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm text-muted">
        View and manage bookings per client. Confirming or cancelling a booking
        automatically messages the customer on WhatsApp. Times are shown in
        your browser&apos;s timezone.
      </p>

      <div className="flex flex-wrap items-end gap-4">
        {!isPortalUser && (
          <div className="w-full max-w-xs flex-1">
            <Select
              label="Client"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              <option value="">Select a client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.bookingsEnabled ? '' : ' (bookings disabled)'}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div>
          <span className="mb-1 block text-sm font-medium">View</span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={view === 'list' ? 'primary' : 'outline'}
              onClick={() => setView('list')}
            >
              List
            </Button>
            <Button
              size="sm"
              variant={view === 'calendar' ? 'primary' : 'outline'}
              onClick={() => setView('calendar')}
            >
              Calendar
            </Button>
          </div>
        </div>
      </div>

      {selectedId && view === 'list' && (
        <>
          <Card className="flex flex-wrap items-end gap-4">
            <div className="w-full sm:w-44">
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-full sm:w-40">
              <Input
                label="From"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-40">
              <Input
                label="To"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </Card>

          <Card>
            {loading ? (
              <PageLoading />
            ) : bookings.length === 0 ? (
              <EmptyState
                title="No bookings found"
                hint="Try adjusting the filters above."
              />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>When</TH>
                    <TH>Service</TH>
                    <TH>Staff</TH>
                    <TH>Customer</TH>
                    <TH>Status</TH>
                    <TH>Details</TH>
                    <TH>Actions</TH>
                  </TR>
                </THead>
                <tbody>
                  {bookings.map((b) => {
                    const answers = intakeEntries(b);
                    return (
                      <TR key={b.id}>
                        <TD>{formatStartAt(b.startAt)}</TD>
                        <TD>
                          {b.service?.name}
                          <div className="text-xs text-muted">
                            {b.service?.durationMinutes} min
                          </div>
                        </TD>
                        <TD>{b.staff?.name || '—'}</TD>
                        <TD>
                          {b.customer?.name}
                          <div className="text-xs text-muted">
                            {b.customer?.phoneNumber}
                          </div>
                        </TD>
                        <TD>
                          <StatusBadge status={b.status} />
                        </TD>
                        <TD className="text-xs text-gray-700">
                          {answers.length > 0 && (
                            <details>
                              <summary className="cursor-pointer text-brand-indigo">
                                {answers.length} intake answer
                                {answers.length === 1 ? '' : 's'}
                              </summary>
                              <div className="mt-1">
                                {answers.map(([q, a]) => (
                                  <div key={q}>
                                    <strong>{q}</strong>: {a}
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                          {b.notes && (
                            <div className={answers.length ? 'mt-1' : undefined}>
                              <strong>Notes:</strong> {b.notes}
                            </div>
                          )}
                          {answers.length === 0 && !b.notes && '—'}
                        </TD>
                        <TD>{renderActions(b)}</TD>
                      </TR>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      )}

      {selectedId && view === 'calendar' && (
        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
            >
              ‹ Prev week
            </Button>
            <Button
              size="sm"
              onClick={() => setWeekStart(startOfWeek(new Date()))}
            >
              Today
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
            >
              Next week ›
            </Button>
            <h2 className="m-0 ml-2 text-base font-semibold">
              {weekRangeLabel}
            </h2>
          </div>

          {calendarLoading ? (
            <PageLoading />
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
              {DAY_LABELS.map((label, i) => {
                const day = addDays(weekStart, i);
                const dayBookings = bookingsForDay(day);
                const isToday =
                  day.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={label}
                    className={`min-h-[120px] rounded-lg border ${
                      isToday
                        ? 'border-brand-teal bg-teal-50/40 ring-1 ring-brand-teal'
                        : 'border-line bg-white'
                    }`}
                  >
                    <div
                      className={`border-b px-2 py-1.5 text-xs font-semibold ${
                        isToday
                          ? 'border-brand-teal/40 text-teal-700'
                          : 'border-line text-muted'
                      }`}
                    >
                      {label}{' '}
                      {day.toLocaleDateString(undefined, {
                        month: 'numeric',
                        day: 'numeric',
                      })}
                    </div>
                    <div className="flex flex-col gap-1.5 p-1.5">
                      {dayBookings.map((b) => {
                        const expanded = expandedBookingId === b.id;
                        return (
                          <div
                            key={b.id}
                            onClick={() =>
                              setExpandedBookingId(expanded ? null : b.id)
                            }
                            className={`cursor-pointer rounded border-l-4 px-1.5 py-1 text-xs ${TONE_BLOCK_CLASSES[statusTone(b.status)]}`}
                          >
                            <div className="font-semibold">
                              {formatTime(b.startAt)} · {b.service?.name}
                            </div>
                            <div className="text-gray-700">
                              {b.customer?.name}
                              {b.staff?.name ? ` · ${b.staff.name}` : ''}
                            </div>
                            {expanded && (
                              <div className="mt-1.5">
                                <div className="mb-1.5">
                                  <StatusBadge status={b.status} />
                                </div>
                                <div className="mb-1.5 text-muted">
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
                        <div className="text-xs text-gray-300">—</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
