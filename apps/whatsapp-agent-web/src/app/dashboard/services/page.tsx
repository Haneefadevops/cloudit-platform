'use client';

import { useEffect, useState } from 'react';

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

export default function ServicesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);

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
      showInfo(data.message || 'Failed to save service');
      return;
    }
    showInfo(editingServiceId ? 'Service updated' : 'Service created');
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
      showInfo(data.message || 'Failed to save staff member');
      return;
    }
    showInfo(editingStaffId ? 'Staff member updated' : 'Staff member created');
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
    <div>
      <h1>Services & Availability</h1>
      <p style={{ color: '#6b7280', fontSize: 14 }}>
        Bookable services and staff schedules per client. These power the
        bookings module and the availability API.
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
          <h2 style={{ marginTop: 24, fontSize: 18 }}>Services</h2>

          <form
            onSubmit={handleServiceSubmit}
            style={{
              ...cardStyle,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder="Service name (e.g. Consultation)"
                value={serviceForm.name}
                onChange={(e) =>
                  setServiceForm({ ...serviceForm, name: e.target.value })
                }
                required
                style={{ ...inputStyle, flex: 2 }}
              />
              <input
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
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                placeholder="Price (optional)"
                type="number"
                min={0}
                step="0.01"
                value={serviceForm.price}
                onChange={(e) =>
                  setServiceForm({ ...serviceForm, price: e.target.value })
                }
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>
            <input
              placeholder="Description (optional)"
              value={serviceForm.description}
              onChange={(e) =>
                setServiceForm({ ...serviceForm, description: e.target.value })
              }
              style={inputStyle}
            />
            <textarea
              placeholder="Intake questions, one per line (optional)"
              value={serviceForm.intakeQuestions}
              onChange={(e) =>
                setServiceForm({
                  ...serviceForm,
                  intakeQuestions: e.target.value,
                })
              }
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 16, fontSize: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
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
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={serviceForm.active}
                  onChange={(e) =>
                    setServiceForm({ ...serviceForm, active: e.target.checked })
                  }
                />
                Active
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={buttonStyle('#16a34a')}>
                {editingServiceId ? 'Update Service' : 'Add Service'}
              </button>
              {editingServiceId && (
                <button
                  type="button"
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
                  style={buttonStyle('#6b7280')}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div style={cardStyle}>
            {services.length === 0 ? (
              <div style={{ color: '#6b7280' }}>No services yet</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr
                    style={{ textAlign: 'left', color: '#6b7280', fontSize: 13 }}
                  >
                    <th style={{ paddingBottom: 8 }}>Name</th>
                    <th style={{ paddingBottom: 8 }}>Duration</th>
                    <th style={{ paddingBottom: 8 }}>Price</th>
                    <th style={{ paddingBottom: 8 }}>Flags</th>
                    <th style={{ paddingBottom: 8 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s) => (
                    <tr key={s.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 0' }}>
                        {s.name}
                        {s.intakeQuestions?.length > 0 && (
                          <div style={{ fontSize: 12, color: '#6b7280' }}>
                            {s.intakeQuestions.length} intake question
                            {s.intakeQuestions.length === 1 ? '' : 's'}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 0' }}>{s.durationMinutes} min</td>
                      <td style={{ padding: '10px 0' }}>
                        {s.price === null || s.price === undefined
                          ? '—'
                          : `$${Number(s.price).toFixed(2)}`}
                      </td>
                      <td style={{ padding: '10px 0' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {s.requiresConfirmation && (
                            <span style={badgeStyle('#92400e', '#fef3c7')}>
                              confirmation
                            </span>
                          )}
                          <span
                            style={badgeStyle(
                              s.active ? '#15803d' : '#6b7280',
                              s.active ? '#f0fdf4' : '#f3f4f6',
                            )}
                          >
                            {s.active ? 'active' : 'inactive'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 0' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => handleServiceEdit(s)}
                            style={buttonStyle('#2563eb')}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleServiceActive(s)}
                            style={buttonStyle(s.active ? '#f59e0b' : '#16a34a')}
                          >
                            {s.active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleServiceDelete(s.id)}
                            style={buttonStyle('#dc2626')}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <h2 style={{ marginTop: 24, fontSize: 18 }}>Staff</h2>

          <form
            onSubmit={handleStaffSubmit}
            style={{
              ...cardStyle,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <input
              placeholder="Staff member name (e.g. Dr. Silva)"
              value={staffForm.name}
              onChange={(e) =>
                setStaffForm({ ...staffForm, name: e.target.value })
              }
              required
              style={inputStyle}
            />

            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                Weekly hours
              </div>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
              >
                {WEEKDAYS.map((day) => {
                  const h = staffForm.hours[day];
                  return (
                    <div
                      key={day}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 14,
                      }}
                    >
                      <label
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          width: 140,
                          textTransform: 'capitalize',
                        }}
                      >
                        <input
                          type="checkbox"
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
                        style={{ ...inputStyle, width: 110 }}
                      />
                      <span style={{ color: '#6b7280' }}>to</span>
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
                        style={{ ...inputStyle, width: 110 }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <textarea
              placeholder="Days off, one YYYY-MM-DD per line (optional)"
              value={staffForm.daysOff}
              onChange={(e) =>
                setStaffForm({ ...staffForm, daysOff: e.target.value })
              }
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />

            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 14,
              }}
            >
              <input
                type="checkbox"
                checked={staffForm.active}
                onChange={(e) =>
                  setStaffForm({ ...staffForm, active: e.target.checked })
                }
              />
              Active
            </label>

            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={buttonStyle('#16a34a')}>
                {editingStaffId ? 'Update Staff Member' : 'Add Staff Member'}
              </button>
              {editingStaffId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingStaffId(null);
                    setStaffForm({
                      name: '',
                      hours: emptyHours(),
                      daysOff: '',
                      active: true,
                    });
                  }}
                  style={buttonStyle('#6b7280')}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div style={cardStyle}>
            {staff.length === 0 ? (
              <div style={{ color: '#6b7280' }}>No staff yet</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr
                    style={{ textAlign: 'left', color: '#6b7280', fontSize: 13 }}
                  >
                    <th style={{ paddingBottom: 8 }}>Name</th>
                    <th style={{ paddingBottom: 8 }}>Hours</th>
                    <th style={{ paddingBottom: 8 }}>Days Off</th>
                    <th style={{ paddingBottom: 8 }}>Status</th>
                    <th style={{ paddingBottom: 8 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((s) => (
                    <tr key={s.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 0' }}>{s.name}</td>
                      <td
                        style={{
                          padding: '10px 0',
                          fontSize: 13,
                          color: '#374151',
                        }}
                      >
                        {hoursSummary(s.weeklyHours)}
                      </td>
                      <td style={{ padding: '10px 0', fontSize: 13 }}>
                        {s.daysOff?.length > 0 ? s.daysOff.length : '—'}
                      </td>
                      <td style={{ padding: '10px 0' }}>
                        <span
                          style={badgeStyle(
                            s.active ? '#15803d' : '#6b7280',
                            s.active ? '#f0fdf4' : '#f3f4f6',
                          )}
                        >
                          {s.active ? 'active' : 'inactive'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 0' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => handleStaffEdit(s)}
                            style={buttonStyle('#2563eb')}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleStaffActive(s)}
                            style={buttonStyle(s.active ? '#f59e0b' : '#16a34a')}
                          >
                            {s.active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => handleStaffDelete(s.id)}
                            style={buttonStyle('#dc2626')}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
