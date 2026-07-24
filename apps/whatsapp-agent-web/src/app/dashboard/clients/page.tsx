'use client';

import { useEffect, useState } from 'react';

interface Client {
  id: string;
  name: string;
  whatsappNumber: string;
  whatsappPhoneNumberId: string;
  metaAccessToken: string;
  status: string;
  industry?: string | null;
  website?: string | null;
  timezone?: string | null;
  language?: string | null;
  businessDescription?: string | null;
  adminEmail?: string | null;
  adminPhone?: string | null;
  systemPrompt?: string | null;
  aiTemperature?: number | null;
  welcomeMessage?: string | null;
  fallbackMessage?: string | null;
  handoffKeywords?: string | null;
  operatingHoursStart?: string | null;
  operatingHoursEnd?: string | null;
  closedDays?: string | null;
  verifyToken?: string | null;
  webhookUrl?: string | null;
  metaWebhookStatus?: string | null;
  lastWebhookAt?: string | null;
  chatwootAccountId?: number | null;
  chatwootInboxId?: number | null;
  chatwootAdminUserId?: number | null;
  bookingsEnabled?: boolean;
  bookingApprovalMode?: string | null;
  bookingReminderHours?: number | null;
  bookingConfirmationTemplate?: string | null;
  ordersEnabled?: boolean;
  deliveryEnabled?: boolean;
  pickupEnabled?: boolean;
  paymentInstructions?: string | null;
  orderConfirmationTemplate?: string | null;
}

interface ChatwootStatus {
  connected: boolean;
  accountId?: number | null;
  accountName?: string | null;
}

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

const sectionStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 12,
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  background: '#f9fafb',
};

const sectionTitleStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 14,
  marginBottom: 8,
  color: '#374151',
};

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, ChatwootStatus>>({});
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Client | null>(null);
  const [metaGuideClient, setMetaGuideClient] = useState<Client | null>(null);
  const [form, setForm] = useState({
    name: '',
    industry: '',
    website: '',
    timezone: 'UTC',
    language: 'en',
    adminEmail: '',
    adminPhone: '',
    whatsappNumber: '',
    whatsappPhoneNumberId: '',
    metaAccessToken: '',
    businessDescription: '',
    welcomeMessage: 'Hello! How can we help you today?',
    fallbackMessage:
      "I'm sorry, I didn't understand that. Let me connect you with our team.",
    handoffKeywords: 'human,agent,person,manager,supervisor',
    operatingHoursStart: '09:00',
    operatingHoursEnd: '17:00',
    closedDays: 'Saturday,Sunday',
    autoSetup: true,
    bookingsEnabled: false,
    bookingApprovalMode: 'approval',
    bookingReminderHours: 24,
    bookingConfirmationTemplate: '',
    ordersEnabled: false,
    deliveryEnabled: false,
    pickupEnabled: false,
    paymentInstructions: '',
    orderConfirmationTemplate: '',
  });

  const token =
    (typeof window !== 'undefined' && localStorage.getItem('token')) || '';

  const showInfo = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchClients = async () => {
    if (!token) return [];
    const res = await fetch('/api/clients', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    setClients(list);
    return list;
  };

  const fetchStatus = async (clientId: string) => {
    const res = await fetch(`/api/clients/${clientId}/chatwoot-status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setStatusMap((prev) => ({ ...prev, [clientId]: data }));
  };

  useEffect(() => {
    if (!token) {
      window.location.href = '/login';
      return;
    }
    fetchClients().then((list) => {
      list.forEach((c) => fetchStatus(c.id));
    });
  }, []);

  const resetForm = () => {
    setForm({
      name: '',
      industry: '',
      website: '',
      timezone: 'UTC',
      language: 'en',
      adminEmail: '',
      adminPhone: '',
      whatsappNumber: '',
      whatsappPhoneNumberId: '',
      metaAccessToken: '',
      businessDescription: '',
      welcomeMessage: 'Hello! How can we help you today?',
      fallbackMessage:
        "I'm sorry, I didn't understand that. Let me connect you with our team.",
      handoffKeywords: 'human,agent,person,manager,supervisor',
      operatingHoursStart: '09:00',
      operatingHoursEnd: '17:00',
      closedDays: 'Saturday,Sunday',
      autoSetup: true,
      bookingsEnabled: false,
      bookingApprovalMode: 'approval',
      bookingReminderHours: 24,
      bookingConfirmationTemplate: '',
      ordersEnabled: false,
      deliveryEnabled: false,
      pickupEnabled: false,
      paymentInstructions: '',
      orderConfirmationTemplate: '',
    });
    setEditing(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(editing ? 'update' : 'create');

    const payload: Record<string, unknown> = {
      name: form.name,
      whatsappNumber: form.whatsappNumber,
      whatsappPhoneNumberId: form.whatsappPhoneNumberId,
      metaAccessToken: form.metaAccessToken,
      industry: form.industry || null,
      website: form.website || null,
      timezone: form.timezone || 'UTC',
      language: form.language || 'en',
      adminEmail: form.adminEmail || null,
      adminPhone: form.adminPhone || null,
      businessDescription: form.businessDescription || null,
      welcomeMessage: form.welcomeMessage || null,
      fallbackMessage: form.fallbackMessage || null,
      handoffKeywords: form.handoffKeywords || null,
      operatingHoursStart: form.operatingHoursStart || null,
      operatingHoursEnd: form.operatingHoursEnd || null,
      closedDays: form.closedDays || null,
      bookingsEnabled: form.bookingsEnabled,
      bookingApprovalMode: form.bookingApprovalMode || 'approval',
      bookingReminderHours: Number(form.bookingReminderHours),
      bookingConfirmationTemplate: form.bookingConfirmationTemplate || null,
      ordersEnabled: form.ordersEnabled,
      deliveryEnabled: form.ordersEnabled ? form.deliveryEnabled : false,
      pickupEnabled: form.ordersEnabled ? form.pickupEnabled : false,
      paymentInstructions:
        form.ordersEnabled && form.paymentInstructions
          ? form.paymentInstructions
          : null,
      orderConfirmationTemplate:
        form.ordersEnabled && form.orderConfirmationTemplate
          ? form.orderConfirmationTemplate
          : null,
    };

    const url = editing ? `/api/clients/${editing.id}` : '/api/clients';
    const method = editing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const client = await res.json();
      if (!res.ok) {
        showInfo(client.error || client.message || 'Failed to save client');
        return;
      }

      if (!editing && form.autoSetup) {
        const setupRes = await fetch(
          `/api/clients/${client.id}/chatwoot-setup`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const setupData = await setupRes.json();
        if (!setupRes.ok) {
          showInfo(setupData.error || 'Client saved but Chatwoot setup failed');
        } else {
          showInfo(
            `Client saved. Chatwoot account ${setupData.chatwootAccountId} connected.`,
          );
        }
      } else {
        showInfo(editing ? 'Client updated' : 'Client created');
      }

      resetForm();
      const list = await fetchClients();
      await Promise.all(list.map((c) => fetchStatus(c.id)));
    } finally {
      setLoading(null);
    }
  };

  const handleEdit = (client: Client) => {
    setEditing(client);
    setForm({
      name: client.name,
      industry: client.industry || '',
      website: client.website || '',
      timezone: client.timezone || 'UTC',
      language: client.language || 'en',
      adminEmail: client.adminEmail || '',
      adminPhone: client.adminPhone || '',
      whatsappNumber: client.whatsappNumber,
      whatsappPhoneNumberId: client.whatsappPhoneNumberId,
      metaAccessToken: client.metaAccessToken,
      businessDescription: client.businessDescription || '',
      welcomeMessage: client.welcomeMessage || '',
      fallbackMessage: client.fallbackMessage || '',
      handoffKeywords: client.handoffKeywords || '',
      operatingHoursStart: client.operatingHoursStart || '',
      operatingHoursEnd: client.operatingHoursEnd || '',
      closedDays: client.closedDays || '',
      autoSetup: false,
      bookingsEnabled: client.bookingsEnabled || false,
      bookingApprovalMode: client.bookingApprovalMode || 'approval',
      bookingReminderHours:
        client.bookingReminderHours === null ||
        client.bookingReminderHours === undefined
          ? 24
          : client.bookingReminderHours,
      bookingConfirmationTemplate: client.bookingConfirmationTemplate || '',
      ordersEnabled: client.ordersEnabled || false,
      deliveryEnabled: client.deliveryEnabled || false,
      pickupEnabled: client.pickupEnabled || false,
      paymentInstructions: client.paymentInstructions || '',
      orderConfirmationTemplate: client.orderConfirmationTemplate || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client?')) return;
    const res = await fetch(`/api/clients/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      showInfo('Client deleted');
      const list = await fetchClients();
      await Promise.all(list.map((c) => fetchStatus(c.id)));
    } else {
      showInfo('Failed to delete client');
    }
  };

  const toggleStatus = async (client: Client) => {
    const newStatus = client.status === 'active' ? 'paused' : 'active';
    const res = await fetch(`/api/clients/${client.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      showInfo(`Client ${newStatus === 'active' ? 'activated' : 'paused'}`);
      const list = await fetchClients();
      await Promise.all(list.map((c) => fetchStatus(c.id)));
    } else {
      showInfo('Failed to update status');
    }
  };

  const setupChatwoot = async (clientId: string) => {
    setLoading(`setup-${clientId}`);
    try {
      const res = await fetch(`/api/clients/${clientId}/chatwoot-setup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        showInfo(data.error || 'Chatwoot setup failed');
      } else {
        showInfo(
          `Chatwoot connected: account ${data.chatwootAccountId}, inbox ${data.chatwootInboxId}`,
        );
      }
      const list = await fetchClients();
      await Promise.all(list.map((c) => fetchStatus(c.id)));
    } finally {
      setLoading(null);
    }
  };

  const openChatwoot = (client: Client) => {
    if (!client.chatwootAccountId) return;
    window.open(
      `https://inbox.thereplyte.com/app/accounts/${client.chatwootAccountId}/dashboard`,
      '_blank',
    );
  };

  const callbackUrl = 'https://api.thereplyte.com/api/webhooks/whatsapp';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showInfo('Copied to clipboard');
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h1>Clients</h1>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          style={buttonStyle('#2563eb')}
        >
          Add Client
        </button>
      </div>

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

      {showForm && (
        <form
          onSubmit={handleSubmit}
          style={{
            marginTop: 16,
            background: 'white',
            padding: 16,
            borderRadius: 8,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>1. Business Information</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                placeholder="Company / brand name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                style={inputStyle}
              />
              <input
                placeholder="Industry / business type"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                style={inputStyle}
              />
              <input
                placeholder="Website"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                style={inputStyle}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  placeholder="Timezone (e.g. Asia/Colombo)"
                  value={form.timezone}
                  onChange={(e) =>
                    setForm({ ...form, timezone: e.target.value })
                  }
                  style={inputStyle}
                />
                <input
                  placeholder="Default language (e.g. en)"
                  value={form.language}
                  onChange={(e) =>
                    setForm({ ...form, language: e.target.value })
                  }
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>2. Contact & Access</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                placeholder="Primary admin email (Chatwoot login) *"
                type="email"
                value={form.adminEmail}
                onChange={(e) =>
                  setForm({ ...form, adminEmail: e.target.value })
                }
                required
                style={inputStyle}
              />
              <input
                placeholder="Primary admin phone"
                value={form.adminPhone}
                onChange={(e) =>
                  setForm({ ...form, adminPhone: e.target.value })
                }
                style={inputStyle}
              />
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>3. WhatsApp Configuration</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                placeholder="WhatsApp Business number (e.g. +94751234567) *"
                value={form.whatsappNumber}
                onChange={(e) =>
                  setForm({ ...form, whatsappNumber: e.target.value })
                }
                required
                style={inputStyle}
              />
              <input
                placeholder="WhatsApp Phone Number ID *"
                value={form.whatsappPhoneNumberId}
                onChange={(e) =>
                  setForm({ ...form, whatsappPhoneNumberId: e.target.value })
                }
                required
                style={inputStyle}
              />
              <input
                placeholder="Meta Access Token *"
                value={form.metaAccessToken}
                onChange={(e) =>
                  setForm({ ...form, metaAccessToken: e.target.value })
                }
                required
                style={inputStyle}
              />
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>4. AI Behavior (defaults, editable later)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                placeholder="Business description"
                value={form.businessDescription}
                onChange={(e) =>
                  setForm({ ...form, businessDescription: e.target.value })
                }
                rows={3}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
              <input
                placeholder="Welcome message"
                value={form.welcomeMessage}
                onChange={(e) =>
                  setForm({ ...form, welcomeMessage: e.target.value })
                }
                style={inputStyle}
              />
              <input
                placeholder="Fallback message"
                value={form.fallbackMessage}
                onChange={(e) =>
                  setForm({ ...form, fallbackMessage: e.target.value })
                }
                style={inputStyle}
              />
              <input
                placeholder="Handoff keywords (comma separated)"
                value={form.handoffKeywords}
                onChange={(e) =>
                  setForm({ ...form, handoffKeywords: e.target.value })
                }
                style={inputStyle}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  placeholder="Opens at (HH:MM)"
                  value={form.operatingHoursStart}
                  onChange={(e) =>
                    setForm({ ...form, operatingHoursStart: e.target.value })
                  }
                  style={inputStyle}
                />
                <input
                  placeholder="Closes at (HH:MM)"
                  value={form.operatingHoursEnd}
                  onChange={(e) =>
                    setForm({ ...form, operatingHoursEnd: e.target.value })
                  }
                  style={inputStyle}
                />
              </div>
              <input
                placeholder="Closed days (comma separated)"
                value={form.closedDays}
                onChange={(e) =>
                  setForm({ ...form, closedDays: e.target.value })
                }
                style={inputStyle}
              />
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>5. Modules</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                }}
              >
                <input
                  type="checkbox"
                  checked={form.bookingsEnabled}
                  onChange={(e) =>
                    setForm({ ...form, bookingsEnabled: e.target.checked })
                  }
                />
                Enable bookings module
              </label>
              {form.bookingsEnabled && (
                <>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600 }}>
                      Booking approval mode
                    </label>
                    <select
                      value={form.bookingApprovalMode}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          bookingApprovalMode: e.target.value,
                        })
                      }
                      style={{ ...inputStyle, marginTop: 4 }}
                    >
                      <option value="approval">
                        Require approval before confirming
                      </option>
                      <option value="auto">Auto-confirm bookings</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 600 }}>
                      Reminder hours before appointment (0 disables)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={form.bookingReminderHours}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          bookingReminderHours: Number(e.target.value),
                        })
                      }
                      style={{ ...inputStyle, marginTop: 4 }}
                    />
                  </div>
                  <textarea
                    placeholder="Booking confirmation message template (optional)"
                    value={form.bookingConfirmationTemplate}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        bookingConfirmationTemplate: e.target.value,
                      })
                    }
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical' }}
                  />
                </>
              )}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                }}
              >
                <input
                  type="checkbox"
                  checked={form.ordersEnabled}
                  onChange={(e) =>
                    setForm({ ...form, ordersEnabled: e.target.checked })
                  }
                />
                Enable orders module
              </label>
              {form.ordersEnabled && (
                <>
                  <div style={{ display: 'flex', gap: 16, fontSize: 14 }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={form.deliveryEnabled}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            deliveryEnabled: e.target.checked,
                          })
                        }
                      />
                      Delivery
                    </label>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={form.pickupEnabled}
                        onChange={(e) =>
                          setForm({ ...form, pickupEnabled: e.target.checked })
                        }
                      />
                      Pickup
                    </label>
                  </div>
                  <input
                    placeholder="Payment instructions (e.g. bank transfer details)"
                    value={form.paymentInstructions}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        paymentInstructions: e.target.value,
                      })
                    }
                    style={inputStyle}
                  />
                  <div>
                    <textarea
                      placeholder="Order confirmation message template (optional)"
                      value={form.orderConfirmationTemplate}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          orderConfirmationTemplate: e.target.value,
                        })
                      }
                      rows={3}
                      style={{ ...inputStyle, resize: 'vertical' }}
                    />
                    <div
                      style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}
                    >
                      Variables: {'{{customer_name}}'}, {'{{business_name}}'},{' '}
                      {'{{total}}'}, {'{{items}}'}, {'{{address}}'}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {!editing && (
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 14,
                marginTop: 4,
              }}
            >
              <input
                type="checkbox"
                checked={form.autoSetup}
                onChange={(e) =>
                  setForm({ ...form, autoSetup: e.target.checked })
                }
              />
              Auto-setup Chatwoot account, inbox, webhook and admin user
            </label>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="submit"
              disabled={loading === 'create' || loading === 'update'}
              style={buttonStyle('#16a34a')}
            >
              {loading === 'create' || loading === 'update'
                ? 'Saving...'
                : editing
                ? 'Update Client'
                : 'Create Client'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              style={buttonStyle('#6b7280')}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}
      >
        {clients.map((c) => {
          const status = statusMap[c.id];
          const isConnected = status?.connected || !!c.chatwootAccountId;
          const metaActive =
            c.metaWebhookStatus === 'active' &&
            c.lastWebhookAt &&
            Date.now() - new Date(c.lastWebhookAt).getTime() < 24 * 60 * 60 * 1000;
          return (
            <div
              key={c.id}
              style={{
                background: 'white',
                padding: 16,
                borderRadius: 8,
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <div>
                  <strong>{c.name}</strong>
                  <div style={{ color: '#6b7280', fontSize: 14 }}>
                    {c.whatsappNumber} •{' '}
                    <span
                      style={{
                        color: c.status === 'active' ? '#16a34a' : '#ef4444',
                        fontWeight: 600,
                      }}
                    >
                      {c.status}
                    </span>{' '}
                    •{' '}
                    <span
                      style={{
                        color: metaActive ? '#16a34a' : '#9ca3af',
                        fontWeight: 600,
                      }}
                    >
                      Meta {metaActive ? 'active' : 'pending'}
                    </span>
                  </div>
                  {c.adminEmail && (
                    <div style={{ color: '#6b7280', fontSize: 13 }}>
                      Admin: {c.adminEmail}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleEdit(c)} style={buttonStyle('#2563eb')}>
                    Edit
                  </button>
                  <button
                    onClick={() => toggleStatus(c)}
                    style={buttonStyle(c.status === 'active' ? '#f59e0b' : '#16a34a')}
                  >
                    {c.status === 'active' ? 'Pause' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    style={buttonStyle('#ef4444')}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  color: isConnected ? '#15803d' : '#b45309',
                  background: isConnected ? '#f0fdf4' : '#fffbeb',
                  padding: '8px 12px',
                  borderRadius: 6,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>
                  {status === undefined
                    ? 'Loading Chatwoot status...'
                    : isConnected
                    ? `Chatwoot connected • Account ${
                        status?.accountId ?? c.chatwootAccountId
                      }${status?.accountName ? ` (${status.accountName})` : ''}`
                    : 'Chatwoot not connected'}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {isConnected ? (
                    <>
                      <button
                        onClick={() => openChatwoot(c)}
                        style={buttonStyle('#2563eb')}
                      >
                        Open Chatwoot
                      </button>
                      <button
                        onClick={() => setMetaGuideClient(c)}
                        style={buttonStyle('#7c3aed')}
                      >
                        Meta Setup
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setupChatwoot(c.id)}
                      disabled={loading === `setup-${c.id}`}
                      style={{
                        ...buttonStyle('#2563eb'),
                        opacity: loading === `setup-${c.id}` ? 0.7 : 1,
                      }}
                    >
                      {loading === `setup-${c.id}` ? 'Setting up...' : 'Setup Chatwoot'}
                    </button>
                  )}
                  <button
                    onClick={() => fetchStatus(c.id)}
                    style={buttonStyle('#6b7280')}
                  >
                    Refresh Status
                  </button>
                </div>
              </div>

              {isConnected && (
                <div
                  style={{
                    marginTop: 12,
                    display: 'flex',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <a
                    href={`/dashboard/ai-settings?clientId=${c.id}`}
                    style={{
                      ...buttonStyle('#059669'),
                      textDecoration: 'none',
                      display: 'inline-block',
                    }}
                  >
                    Edit AI Settings
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {metaGuideClient && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            zIndex: 50,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setMetaGuideClient(null);
          }}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 8,
              padding: 24,
              maxWidth: 560,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <h2 style={{ margin: 0 }}>Meta Webhook Setup</h2>
              <button
                onClick={() => setMetaGuideClient(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 20,
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ margin: 0, fontSize: 14, color: '#4b5563' }}>
                Copy the values below into your Meta Developers app WhatsApp
                product configuration.
              </p>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Callback URL</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <input
                    readOnly
                    value={callbackUrl}
                    style={inputStyle}
                  />
                  <button
                    onClick={() => copyToClipboard(callbackUrl)}
                    style={buttonStyle('#2563eb')}
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600 }}>Verify Token</label>
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <input
                    readOnly
                    value={metaGuideClient.verifyToken || 'Not generated'}
                    style={inputStyle}
                  />
                  <button
                    onClick={() =>
                      metaGuideClient.verifyToken &&
                      copyToClipboard(metaGuideClient.verifyToken)
                    }
                    style={buttonStyle('#2563eb')}
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>Steps</div>
                <ol
                  style={{
                    margin: 0,
                    paddingLeft: 20,
                    fontSize: 14,
                    color: '#374151',
                    lineHeight: 1.6,
                  }}
                >
                  <li>Open{' '}
                    <a
                      href="https://developers.facebook.com/apps/"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: '#2563eb' }}
                    >
                      Meta Developers
                    </a>{' '}
                    and select your app.
                  </li>
                  <li>Go to WhatsApp → Configuration.</li>
                  <li>Paste the Callback URL above into the Callback URL field.</li>
                  <li>Paste the Verify Token above into the Verify Token field.</li>
                  <li>Click Verify and Save.</li>
                  <li>Subscribe to <strong>messages</strong> and{' '}
                    <strong>message_deliveries</strong> webhook fields.
                  </li>
                </ol>
              </div>

              <div
                style={{
                  marginTop: 8,
                  padding: 12,
                  borderRadius: 6,
                  background:
                    metaGuideClient.metaWebhookStatus === 'active' ? '#f0fdf4' : '#fffbeb',
                  color:
                    metaGuideClient.metaWebhookStatus === 'active'
                      ? '#15803d'
                      : '#b45309',
                  fontSize: 13,
                }}
              >
                Status:{' '}
                <strong>
                  {metaGuideClient.metaWebhookStatus === 'active'
                    ? 'Recent webhook received'
                    : 'Waiting for first webhook'}
                </strong>
                {metaGuideClient.lastWebhookAt && (
                  <div>
                    Last received: {new Date(metaGuideClient.lastWebhookAt).toLocaleString()}
                  </div>
                )}
              </div>

              <button
                onClick={() => setMetaGuideClient(null)}
                style={{ ...buttonStyle('#6b7280'), marginTop: 8 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
