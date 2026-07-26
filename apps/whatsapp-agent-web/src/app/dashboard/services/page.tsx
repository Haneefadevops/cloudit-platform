'use client';

import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  StatusBadge,
  Table,
  TD,
  TH,
  THead,
  TR,
  Textarea,
  useToast,
} from '@/components/ui';
import { isPortalUser } from '../portal';

interface Client {
  id: string;
  name: string;
  bookingsEnabled?: boolean;
}

interface Service {
  id: string;
  name: string;
  description?: string | null;
  durationMinutes: number;
  price?: number | null;
  requiresConfirmation: boolean;
  intakeQuestions: string[];
  active: boolean;
}

interface DayHours {
  start: string;
  end: string;
}

interface Staff {
  id: string;
  name: string;
  weeklyHours: Record<string, DayHours>;
  daysOff: string[];
  active: boolean;
}

const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

type Weekday = (typeof WEEKDAYS)[number];

const emptyHours = (): Record<Weekday, { enabled: boolean; start: string; end: string }> =>
  Object.fromEntries(
    WEEKDAYS.map((d) => [d, { enabled: false, start: '09:00', end: '17:00' }]),
  ) as Record<Weekday, { enabled: boolean; start: string; end: string }>;

const timeInputClass =
  'w-28 rounded-lg border border-line bg-white px-3 py-2 text-sm text-brand-navy outline-none transition-colors focus:border-brand-indigo focus:ring-2 focus:ring-brand-indigo/20 disabled:bg-page disabled:text-muted';

export default function ServicesPage() {
  const toast = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');

  const [services, setServices] = useState<Service[]>([]);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState({
    name: '',
    description: '',
    durationMinutes: 60,
    price: '',
    requiresConfirmation: false,
    intakeQuestions: '',
    active: true,
  });

  const [staff, setStaff] = useState<Staff[]>([]);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState({
    name: '',
    hours: emptyHours(),
    daysOff: '',
    active: true,
  });

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

  const fetchServices = async (clientId: string) => {
    if (!clientId) return;
    const res = await fetch(`/api/bookings/${clientId}/services`, { headers });
    const list = await res.json();
    setServices(Array.isArray(list) ? list : []);
  };

  const fetchStaff = async (clientId: string) => {
    if (!clientId) return;
    const res = await fetch(`/api/bookings/${clientId}/staff`, { headers });
    const list = await res.json();
    setStaff(Array.isArray(list) ? list : []);
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
    fetchClients();
  }, []);

  useEffect(() => {
    setEditingServiceId(null);
    setServiceForm({
      name: '',
      description: '',
      durationMinutes: 60,
      price: '',
      requiresConfirmation: false,
      intakeQuestions: '',
      active: true,
    });
    setEditingStaffId(null);
    setStaffForm({ name: '', hours: emptyHours(), daysOff: '', active: true });
    fetchServices(selectedId);
    fetchStaff(selectedId);
  }, [selectedId]);

  // ---------- Services ----------

  const handleServiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;

    const payload = {
      name: serviceForm.name,
      description: serviceForm.description || null,
      durationMinutes: Number(serviceForm.durationMinutes) || 60,
      price: serviceForm.price === '' ? null : Number(serviceForm.price),
      requiresConfirmation: serviceForm.requiresConfirmation,
      intakeQuestions: serviceForm.intakeQuestions
        .split('\n')
        .map((q) => q.trim())
        .filter(Boolean),
      active: serviceForm.active,
    };

    const url = editingServiceId
      ? `/api/bookings/${selectedId}/services/${editingServiceId}`
      : `/api/bookings/${selectedId}/services`;
    const res = await fetch(url, {
      method: editingServiceId ? 'PUT' : 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.message || 'Failed to save service', 'error');
      return;
    }
    toast(editingServiceId ? 'Service updated' : 'Service created', 'success');
    setEditingServiceId(null);
    setServiceForm({
      name: '',
      description: '',
      durationMinutes: 60,
      price: '',
      requiresConfirmation: false,
      intakeQuestions: '',
      active: true,
    });
    fetchServices(selectedId);
  };

  const handleServiceEdit = (s: Service) => {
    setEditingServiceId(s.id);
    setServiceForm({
      name: s.name,
      description: s.description || '',
      durationMinutes: s.durationMinutes,
      price: s.price === null || s.price === undefined ? '' : String(s.price),
      requiresConfirmation: s.requiresConfirmation,
      intakeQuestions: (s.intakeQuestions || []).join('\n'),
      active: s.active,
    });
  };

  const handleServiceDelete = async (id: string) => {
    if (!confirm('Delete this service?')) return;
    await fetch(`/api/bookings/${selectedId}/services/${id}`, {
      method: 'DELETE',
      headers,
    });
    fetchServices(selectedId);
  };

  const toggleServiceActive = async (s: Service) => {
    await fetch(`/api/bookings/${selectedId}/services/${s.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ active: !s.active }),
    });
    fetchServices(selectedId);
  };

  // ---------- Staff ----------

  const hoursSummary = (weeklyHours: Record<string, DayHours>) => {
    const parts = WEEKDAYS.filter((d) => weeklyHours?.[d]).map(
      (d) => `${d.slice(0, 3)} ${weeklyHours[d].start}-${weeklyHours[d].end}`,
    );
    return parts.length > 0 ? parts.join(', ') : 'No hours set';
  };

  const handleStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;

    const weeklyHours: Record<string, DayHours> = {};
    for (const day of WEEKDAYS) {
      const h = staffForm.hours[day];
      if (h.enabled) weeklyHours[day] = { start: h.start, end: h.end };
    }

    const payload = {
      name: staffForm.name,
      weeklyHours,
      daysOff: staffForm.daysOff
        .split('\n')
        .map((d) => d.trim())
        .filter(Boolean),
      active: staffForm.active,
    };

    const url = editingStaffId
      ? `/api/bookings/${selectedId}/staff/${editingStaffId}`
      : `/api/bookings/${selectedId}/staff`;
    const res = await fetch(url, {
      method: editingStaffId ? 'PUT' : 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.message || 'Failed to save staff member', 'error');
      return;
    }
    toast(
      editingStaffId ? 'Staff member updated' : 'Staff member created',
      'success',
    );
    setEditingStaffId(null);
    setStaffForm({ name: '', hours: emptyHours(), daysOff: '', active: true });
    fetchStaff(selectedId);
  };

  const handleStaffEdit = (s: Staff) => {
    setEditingStaffId(s.id);
    const hours = emptyHours();
    for (const day of WEEKDAYS) {
      const h = s.weeklyHours?.[day];
      if (h) hours[day] = { enabled: true, start: h.start, end: h.end };
    }
    setStaffForm({
      name: s.name,
      hours,
      daysOff: (s.daysOff || []).join('\n'),
      active: s.active,
    });
  };

  const handleStaffDelete = async (id: string) => {
    if (!confirm('Delete this staff member?')) return;
    await fetch(`/api/bookings/${selectedId}/staff/${id}`, {
      method: 'DELETE',
      headers,
    });
    fetchStaff(selectedId);
  };

  const toggleStaffActive = async (s: Staff) => {
    await fetch(`/api/bookings/${selectedId}/staff/${s.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ active: !s.active }),
    });
    fetchStaff(selectedId);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm text-muted">
        Bookable services and staff schedules per client. These power the
        bookings module and the availability API.
      </p>

      <Card className="p-4">
        <div className="max-w-xs">
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
      </Card>

      {selectedId && (
        <>
          <Card title={editingServiceId ? 'Edit Service' : 'Add Service'}>
            <form
              onSubmit={handleServiceSubmit}
              className="flex flex-col gap-3"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                <Input
                  placeholder="Service name (e.g. Consultation)"
                  value={serviceForm.name}
                  onChange={(e) =>
                    setServiceForm({ ...serviceForm, name: e.target.value })
                  }
                  required
                />
                <Input
                  placeholder="Duration (minutes)"
                  type="number"
                  min={5}
                  value={serviceForm.durationMinutes}
                  onChange={(e) =>
                    setServiceForm({
                      ...serviceForm,
                      durationMinutes: Number(e.target.value),
                    })
                  }
                />
                <Input
                  placeholder="Price (optional)"
                  type="number"
                  min={0}
                  step="0.01"
                  value={serviceForm.price}
                  onChange={(e) =>
                    setServiceForm({ ...serviceForm, price: e.target.value })
                  }
                />
              </div>
              <Input
                placeholder="Description (optional)"
                value={serviceForm.description}
                onChange={(e) =>
                  setServiceForm({ ...serviceForm, description: e.target.value })
                }
              />
              <Textarea
                placeholder="Intake questions, one per line (optional)"
                value={serviceForm.intakeQuestions}
                onChange={(e) =>
                  setServiceForm({
                    ...serviceForm,
                    intakeQuestions: e.target.value,
                  })
                }
                rows={3}
              />
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="accent-brand-indigo"
                    checked={serviceForm.requiresConfirmation}
                    onChange={(e) =>
                      setServiceForm({
                        ...serviceForm,
                        requiresConfirmation: e.target.checked,
                      })
                    }
                  />
                  Requires confirmation
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="accent-brand-indigo"
                    checked={serviceForm.active}
                    onChange={(e) =>
                      setServiceForm({ ...serviceForm, active: e.target.checked })
                    }
                  />
                  Active
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit">
                  {editingServiceId ? 'Update Service' : 'Add Service'}
                </Button>
                {editingServiceId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingServiceId(null);
                      setServiceForm({
                        name: '',
                        description: '',
                        durationMinutes: 60,
                        price: '',
                        requiresConfirmation: false,
                        intakeQuestions: '',
                        active: true,
                      });
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Card>

          <Card title="Services">
            {services.length === 0 ? (
              <EmptyState
                title="No services yet"
                hint="Add your first bookable service using the form above."
              />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Duration</TH>
                    <TH>Price</TH>
                    <TH>Flags</TH>
                    <TH>Actions</TH>
                  </TR>
                </THead>
                <tbody>
                  {services.map((s) => (
                    <TR key={s.id}>
                      <TD>
                        {s.name}
                        {s.intakeQuestions?.length > 0 && (
                          <div className="text-xs text-muted">
                            {s.intakeQuestions.length} intake question
                            {s.intakeQuestions.length === 1 ? '' : 's'}
                          </div>
                        )}
                      </TD>
                      <TD>{s.durationMinutes} min</TD>
                      <TD>
                        {s.price === null || s.price === undefined
                          ? '—'
                          : `$${Number(s.price).toFixed(2)}`}
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-1.5">
                          {s.requiresConfirmation && (
                            <Badge tone="amber">confirmation</Badge>
                          )}
                          <StatusBadge
                            status={s.active ? 'active' : 'inactive'}
                          />
                        </div>
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleServiceEdit(s)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleServiceActive(s)}
                          >
                            {s.active ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleServiceDelete(s.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card title={editingStaffId ? 'Edit Staff Member' : 'Add Staff Member'}>
            <form onSubmit={handleStaffSubmit} className="flex flex-col gap-3">
              <Input
                placeholder="Staff member name (e.g. Dr. Silva)"
                value={staffForm.name}
                onChange={(e) =>
                  setStaffForm({ ...staffForm, name: e.target.value })
                }
                required
              />

              <div>
                <div className="mb-1 text-sm font-medium">Weekly hours</div>
                <div className="flex flex-col gap-1.5">
                  {WEEKDAYS.map((day) => {
                    const h = staffForm.hours[day];
                    return (
                      <div
                        key={day}
                        className="flex flex-wrap items-center gap-2 text-sm"
                      >
                        <label className="flex w-36 items-center gap-1.5 capitalize">
                          <input
                            type="checkbox"
                            className="accent-brand-indigo"
                            checked={h.enabled}
                            onChange={(e) =>
                              setStaffForm({
                                ...staffForm,
                                hours: {
                                  ...staffForm.hours,
                                  [day]: { ...h, enabled: e.target.checked },
                                },
                              })
                            }
                          />
                          {day}
                        </label>
                        <input
                          type="time"
                          value={h.start}
                          disabled={!h.enabled}
                          onChange={(e) =>
                            setStaffForm({
                              ...staffForm,
                              hours: {
                                ...staffForm.hours,
                                [day]: { ...h, start: e.target.value },
                              },
                            })
                          }
                          className={timeInputClass}
                        />
                        <span className="text-muted">to</span>
                        <input
                          type="time"
                          value={h.end}
                          disabled={!h.enabled}
                          onChange={(e) =>
                            setStaffForm({
                              ...staffForm,
                              hours: {
                                ...staffForm.hours,
                                [day]: { ...h, end: e.target.value },
                              },
                            })
                          }
                          className={timeInputClass}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <Textarea
                placeholder="Days off, one YYYY-MM-DD per line (optional)"
                value={staffForm.daysOff}
                onChange={(e) =>
                  setStaffForm({ ...staffForm, daysOff: e.target.value })
                }
                rows={3}
              />

              <label className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  className="accent-brand-indigo"
                  checked={staffForm.active}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, active: e.target.checked })
                  }
                />
                Active
              </label>

              <div className="flex flex-wrap gap-2">
                <Button type="submit">
                  {editingStaffId ? 'Update Staff Member' : 'Add Staff Member'}
                </Button>
                {editingStaffId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingStaffId(null);
                      setStaffForm({
                        name: '',
                        hours: emptyHours(),
                        daysOff: '',
                        active: true,
                      });
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Card>

          <Card title="Staff">
            {staff.length === 0 ? (
              <EmptyState
                title="No staff yet"
                hint="Add a staff member with weekly hours using the form above."
              />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Hours</TH>
                    <TH>Days Off</TH>
                    <TH>Status</TH>
                    <TH>Actions</TH>
                  </TR>
                </THead>
                <tbody>
                  {staff.map((s) => (
                    <TR key={s.id}>
                      <TD>{s.name}</TD>
                      <TD className="text-[13px] text-gray-700">
                        {hoursSummary(s.weeklyHours)}
                      </TD>
                      <TD className="text-[13px]">
                        {s.daysOff?.length > 0 ? s.daysOff.length : '—'}
                      </TD>
                      <TD>
                        <StatusBadge status={s.active ? 'active' : 'inactive'} />
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleStaffEdit(s)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleStaffActive(s)}
                          >
                            {s.active ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleStaffDelete(s.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
