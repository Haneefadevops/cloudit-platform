'use client';

import { useEffect, useState } from 'react';
import { isPortalUser } from '../portal';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Select,
  Spinner,
  StatusBadge,
  Textarea,
  UsageBar,
  useToast,
} from '@/components/ui';

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
  planAllowance?: number;
  usageResetAt?: string | null;
}

interface ChatwootStatus {
  connected: boolean;
  accountId?: number | null;
  accountName?: string | null;
}

interface PortalUser {
  id: string;
  email: string;
  name?: string | null;
  createdAt?: string;
}

interface UsageInfo {
  balance: number;
  used: number;
  planAllowance: number;
  topUpCredits: number;
  allowanceRemaining: number;
  topUpRemaining: number;
  remainingPct: number;
  periodStart: string;
  periodEnd: string;
}

const sectionClass = 'rounded-xl border border-line bg-page/60 p-4';
const sectionTitleClass = 'mb-3 text-sm font-semibold text-brand-navy';

export default function ClientsPage() {
  const toast = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, ChatwootStatus>>({});
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [editing, setEditing] = useState<Client | null>(null);
  const [metaGuideClient, setMetaGuideClient] = useState<Client | null>(null);
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);
  const [portalForm, setPortalForm] = useState({
    email: '',
    password: '',
    name: '',
  });
  const [usageMap, setUsageMap] = useState<Record<string, UsageInfo | null>>(
    {},
  );
  const [topUpClientId, setTopUpClientId] = useState<string | null>(null);
  const [topUpForm, setTopUpForm] = useState({
    credits: 500,
    priceLkr: 3000,
    note: '',
  });
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
    planAllowance: 500,
    usageResetAt: '',
  });

  const token =
    (typeof window !== 'undefined' && localStorage.getItem('token')) || '';

  const fetchClients = async () => {
    if (!token) return [];
    const res = await fetch('/api/clients', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    setClients(list);
    list.forEach((c) => fetchUsage(c.id));
    return list;
  };

  const fetchUsage = async (clientId: string) => {
    try {
      const res = await fetch(`/api/usage/${clientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = res.ok ? await res.json() : null;
      setUsageMap((prev) => ({ ...prev, [clientId]: data }));
    } catch {
      setUsageMap((prev) => ({ ...prev, [clientId]: null }));
    }
  };

  const handleTopUp = async (clientId: string) => {
    const res = await fetch(`/api/usage/${clientId}/topups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        credits: Number(topUpForm.credits),
        priceLkr: Number(topUpForm.priceLkr),
        note: topUpForm.note || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.message || 'Failed to record top-up', 'error');
      return;
    }
    toast(
      `Topped up ${Number(topUpForm.credits)} credits (LKR ${Number(
        topUpForm.priceLkr,
      ).toLocaleString()})`,
      'success',
    );
    setTopUpClientId(null);
    setTopUpForm({ credits: 500, priceLkr: 3000, note: '' });
    fetchUsage(clientId);
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
    if (isPortalUser()) {
      window.location.href = '/dashboard/bookings';
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
      planAllowance: 500,
      usageResetAt: '',
    });
    setEditing(null);
    setPortalUsers([]);
    setPortalForm({ email: '', password: '', name: '' });
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
      planAllowance: Number(form.planAllowance) || 500,
      // Only sent when set: on create the server default (now) applies,
      // on update an empty input leaves the current anchor untouched.
      ...(form.usageResetAt
        ? { usageResetAt: new Date(`${form.usageResetAt}T00:00:00`).toISOString() }
        : {}),
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
        toast(client.error || client.message || 'Failed to save client', 'error');
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
          toast(setupData.error || 'Client saved but Chatwoot setup failed', 'error');
        } else {
          toast(
            `Client saved. Chatwoot account ${setupData.chatwootAccountId} connected.`,
            'success',
          );
        }
      } else {
        toast(editing ? 'Client updated' : 'Client created', 'success');
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
      planAllowance: client.planAllowance ?? 500,
      usageResetAt: client.usageResetAt
        ? client.usageResetAt.slice(0, 10)
        : '',
    });
    setPortalUsers([]);
    setPortalForm({ email: '', password: '', name: '' });
    fetchPortalUsers(client.id);
    setShowForm(true);
  };

  const fetchPortalUsers = async (clientId: string) => {
    const res = await fetch(`/api/clients/${clientId}/portal-users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setPortalUsers(Array.isArray(data) ? data : []);
  };

  const createPortalUser = async () => {
    if (!editing) return;
    if (!portalForm.email || !portalForm.password) {
      toast('Email and temporary password are required', 'error');
      return;
    }
    const res = await fetch(`/api/clients/${editing.id}/portal-users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        email: portalForm.email,
        password: portalForm.password,
        name: portalForm.name || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.message || 'Failed to create portal user', 'error');
      return;
    }
    toast(`Portal login created for ${data.email || portalForm.email}`, 'success');
    setPortalForm({ email: '', password: '', name: '' });
    fetchPortalUsers(editing.id);
  };

  const resetPortalPassword = async (user: PortalUser) => {
    if (!editing) return;
    const password = prompt(`New password for ${user.email}:`);
    if (!password) return;
    const res = await fetch(
      `/api/clients/${editing.id}/portal-users/${user.id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      toast(data.message || 'Failed to reset password', 'error');
      return;
    }
    alert(
      `Password for ${user.email} reset to:\n\n${password}\n\nCopy it now and share it with the client — there is no email reset.`,
    );
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this client?')) return;
    const res = await fetch(`/api/clients/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      toast('Client deleted', 'success');
      const list = await fetchClients();
      await Promise.all(list.map((c) => fetchStatus(c.id)));
    } else {
      toast('Failed to delete client', 'error');
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
      toast(`Client ${newStatus === 'active' ? 'activated' : 'paused'}`, 'success');
      const list = await fetchClients();
      await Promise.all(list.map((c) => fetchStatus(c.id)));
    } else {
      toast('Failed to update status', 'error');
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
        toast(data.error || 'Chatwoot setup failed', 'error');
      } else {
        toast(
          `Chatwoot connected: account ${data.chatwootAccountId}, inbox ${data.chatwootInboxId}`,
          'success',
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
    toast('Copied to clipboard', 'info');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm text-muted">
          {clients.length} client{clients.length === 1 ? '' : 's'}
        </p>
        <Button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
        >
          Add Client
        </Button>
      </div>

      {/* Add / Edit client form */}
      <Modal
        open={showForm}
        onClose={resetForm}
        title={editing ? 'Edit Client' : 'Add Client'}
        wide
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <fieldset className={sectionClass}>
            <div className={sectionTitleClass}>1. Business Information</div>
            <div className="flex flex-col gap-3">
              <Input
                placeholder="Company / brand name *"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <Input
                placeholder="Industry / business type"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
              />
              <Input
                placeholder="Website"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Timezone (e.g. Asia/Colombo)"
                  value={form.timezone}
                  onChange={(e) =>
                    setForm({ ...form, timezone: e.target.value })
                  }
                />
                <Input
                  placeholder="Default language (e.g. en)"
                  value={form.language}
                  onChange={(e) =>
                    setForm({ ...form, language: e.target.value })
                  }
                />
              </div>
            </div>
          </fieldset>

          <fieldset className={sectionClass}>
            <div className={sectionTitleClass}>2. Contact & Access</div>
            <div className="flex flex-col gap-3">
              <Input
                placeholder="Primary admin email (Chatwoot login) *"
                type="email"
                value={form.adminEmail}
                onChange={(e) =>
                  setForm({ ...form, adminEmail: e.target.value })
                }
                required
              />
              <Input
                placeholder="Primary admin phone"
                value={form.adminPhone}
                onChange={(e) =>
                  setForm({ ...form, adminPhone: e.target.value })
                }
              />
            </div>
          </fieldset>

          <fieldset className={sectionClass}>
            <div className={sectionTitleClass}>3. WhatsApp Configuration</div>
            <div className="flex flex-col gap-3">
              <Input
                placeholder="WhatsApp Business number (e.g. +94751234567) *"
                value={form.whatsappNumber}
                onChange={(e) =>
                  setForm({ ...form, whatsappNumber: e.target.value })
                }
                required
              />
              <Input
                placeholder="WhatsApp Phone Number ID *"
                value={form.whatsappPhoneNumberId}
                onChange={(e) =>
                  setForm({ ...form, whatsappPhoneNumberId: e.target.value })
                }
                required
              />
              <Input
                placeholder="Meta Access Token *"
                value={form.metaAccessToken}
                onChange={(e) =>
                  setForm({ ...form, metaAccessToken: e.target.value })
                }
                required
              />
            </div>
          </fieldset>

          <fieldset className={sectionClass}>
            <div className={sectionTitleClass}>4. AI Behavior (defaults, editable later)</div>
            <div className="flex flex-col gap-3">
              <Textarea
                placeholder="Business description"
                value={form.businessDescription}
                onChange={(e) =>
                  setForm({ ...form, businessDescription: e.target.value })
                }
                rows={3}
              />
              <Input
                placeholder="Welcome message"
                value={form.welcomeMessage}
                onChange={(e) =>
                  setForm({ ...form, welcomeMessage: e.target.value })
                }
              />
              <Input
                placeholder="Fallback message"
                value={form.fallbackMessage}
                onChange={(e) =>
                  setForm({ ...form, fallbackMessage: e.target.value })
                }
              />
              <Input
                placeholder="Handoff keywords (comma separated)"
                value={form.handoffKeywords}
                onChange={(e) =>
                  setForm({ ...form, handoffKeywords: e.target.value })
                }
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Opens at (HH:MM)"
                  value={form.operatingHoursStart}
                  onChange={(e) =>
                    setForm({ ...form, operatingHoursStart: e.target.value })
                  }
                />
                <Input
                  placeholder="Closes at (HH:MM)"
                  value={form.operatingHoursEnd}
                  onChange={(e) =>
                    setForm({ ...form, operatingHoursEnd: e.target.value })
                  }
                />
              </div>
              <Input
                placeholder="Closed days (comma separated)"
                value={form.closedDays}
                onChange={(e) =>
                  setForm({ ...form, closedDays: e.target.value })
                }
              />
            </div>
          </fieldset>

          <fieldset className={sectionClass}>
            <div className={sectionTitleClass}>5. Modules</div>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 text-sm">
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
                  <Select
                    label="Booking approval mode"
                    value={form.bookingApprovalMode}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        bookingApprovalMode: e.target.value,
                      })
                    }
                  >
                    <option value="approval">
                      Require approval before confirming
                    </option>
                    <option value="auto">Auto-confirm bookings</option>
                  </Select>
                  <Input
                    label="Reminder hours before appointment (0 disables)"
                    type="number"
                    min={0}
                    value={form.bookingReminderHours}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        bookingReminderHours: Number(e.target.value),
                      })
                    }
                  />
                  <Textarea
                    placeholder="Booking confirmation message template (optional)"
                    value={form.bookingConfirmationTemplate}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        bookingConfirmationTemplate: e.target.value,
                      })
                    }
                    rows={3}
                  />
                </>
              )}
              <label className="flex items-center gap-2 text-sm">
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
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-1.5">
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
                    <label className="flex items-center gap-1.5">
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
                  <Input
                    placeholder="Payment instructions (e.g. bank transfer details)"
                    value={form.paymentInstructions}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        paymentInstructions: e.target.value,
                      })
                    }
                  />
                  <div>
                    <Textarea
                      placeholder="Order confirmation message template (optional)"
                      value={form.orderConfirmationTemplate}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          orderConfirmationTemplate: e.target.value,
                        })
                      }
                      rows={3}
                    />
                    <div className="mt-1 text-xs text-muted">
                      Variables: {'{{customer_name}}'}, {'{{business_name}}'},{' '}
                      {'{{total}}'}, {'{{items}}'}, {'{{address}}'}
                    </div>
                  </div>
                </>
              )}
              <div className="grid grid-cols-1 gap-3 border-t border-line pt-3 sm:grid-cols-2">
                <Input
                  label="Plan allowance (conversations/month)"
                  type="number"
                  min={0}
                  value={form.planAllowance}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      planAllowance: Number(e.target.value),
                    })
                  }
                />
                <div>
                  <Input
                    label="Usage period start (monthly reset anchor)"
                    type="date"
                    value={form.usageResetAt}
                    onChange={(e) =>
                      setForm({ ...form, usageResetAt: e.target.value })
                    }
                  />
                  <div className="mt-1 text-xs text-muted">
                    {form.usageResetAt
                      ? `Current period started ${form.usageResetAt}. Set it back a month to test the reset (top-up credits are kept).`
                      : 'Leave empty to keep the current anchor.'}
                  </div>
                </div>
              </div>
            </div>
          </fieldset>

          {editing && (
            <fieldset className={sectionClass}>
              <div className={sectionTitleClass}>6. Portal access</div>
              <div className="flex flex-col gap-3">
                {portalUsers.length === 0 ? (
                  <div className="text-sm text-muted">No portal logins yet</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {portalUsers.map((u) => (
                      <div
                        key={u.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm"
                      >
                        <span>
                          <strong>{u.email}</strong>
                          {u.name ? ` — ${u.name}` : ''}
                          {u.createdAt && (
                            <span className="text-xs text-muted">
                              {' '}
                              • created{' '}
                              {new Date(u.createdAt).toLocaleDateString()}
                            </span>
                          )}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => resetPortalPassword(u)}
                        >
                          Reset password
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Input
                    placeholder="Portal login email *"
                    type="email"
                    value={portalForm.email}
                    onChange={(e) =>
                      setPortalForm({ ...portalForm, email: e.target.value })
                    }
                    className="min-w-[200px] flex-[2]"
                  />
                  <Input
                    placeholder="Temporary password *"
                    type="text"
                    value={portalForm.password}
                    onChange={(e) =>
                      setPortalForm({ ...portalForm, password: e.target.value })
                    }
                    className="min-w-[140px] flex-1"
                  />
                  <Input
                    placeholder="Name (optional)"
                    value={portalForm.name}
                    onChange={(e) =>
                      setPortalForm({ ...portalForm, name: e.target.value })
                    }
                    className="min-w-[120px] flex-1"
                  />
                  <Button type="button" size="sm" onClick={createPortalUser}>
                    Create portal login
                  </Button>
                </div>
                <div className="text-xs text-muted">
                  Portal users sign in with this email/password and only see
                  their own bookings, orders and analytics. There is no email
                  reset — share the password with the client directly.
                </div>
              </div>
            </fieldset>
          )}

          {!editing && (
            <label className="flex items-center gap-2 text-sm">
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

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={loading === 'create' || loading === 'update'}
            >
              {loading === 'create' || loading === 'update'
                ? 'Saving...'
                : editing
                ? 'Update Client'
                : 'Create Client'}
            </Button>
            <Button type="button" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>

      {/* Client list */}
      {clients.length === 0 ? (
        <div>
          <EmptyState
            title="No clients yet"
            hint="Add your first client to connect WhatsApp, Chatwoot and the AI agent."
            action={
              <Button
                onClick={() => {
                  resetForm();
                  setShowForm(true);
                }}
              >
                Add Client
              </Button>
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {clients.map((c) => {
            const status = statusMap[c.id];
            const isConnected = status?.connected || !!c.chatwootAccountId;
            const metaActive =
              c.metaWebhookStatus === 'active' &&
              c.lastWebhookAt &&
              Date.now() - new Date(c.lastWebhookAt).getTime() < 24 * 60 * 60 * 1000;
            return (
              <Card key={c.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-brand-navy">{c.name}</strong>
                      <StatusBadge status={c.status} />
                      <Badge tone={metaActive ? 'teal' : 'gray'}>
                        Meta {metaActive ? 'active' : 'pending'}
                      </Badge>
                      <Badge tone={isConnected ? 'teal' : 'gray'}>
                        Chatwoot {isConnected ? 'connected' : 'not connected'}
                      </Badge>
                    </div>
                    <div className="mt-1 text-sm text-muted">
                      {c.whatsappNumber}
                    </div>
                    {c.adminEmail && (
                      <div className="mt-0.5 text-xs text-muted">
                        Admin: {c.adminEmail}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleEdit(c)}>
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleStatus(c)}
                    >
                      {c.status === 'active' ? 'Pause' : 'Activate'}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleDelete(c.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                <div
                  className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm ${
                    status === undefined
                      ? 'bg-page text-muted'
                      : isConnected
                      ? 'bg-green-50 text-green-800'
                      : 'bg-amber-50 text-amber-800'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    {status === undefined && <Spinner className="h-4 w-4" />}
                    {status === undefined
                      ? 'Loading Chatwoot status...'
                      : isConnected
                      ? `Chatwoot connected • Account ${
                          status?.accountId ?? c.chatwootAccountId
                        }${status?.accountName ? ` (${status.accountName})` : ''}`
                      : 'Chatwoot not connected'}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {isConnected ? (
                      <>
                        <Button size="sm" onClick={() => openChatwoot(c)}>
                          Open Chatwoot
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setMetaGuideClient(c)}
                        >
                          Meta Setup
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => setupChatwoot(c.id)}
                        disabled={loading === `setup-${c.id}`}
                      >
                        {loading === `setup-${c.id}`
                          ? 'Setting up...'
                          : 'Setup Chatwoot'}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => fetchStatus(c.id)}
                    >
                      Refresh Status
                    </Button>
                  </div>
                </div>

                {(() => {
                  const usage = usageMap[c.id];
                  if (usage === undefined) {
                    return (
                      <div className="mt-3 inline-flex items-center gap-2 text-sm text-muted">
                        <Spinner className="h-4 w-4" />
                        Loading usage...
                      </div>
                    );
                  }
                  if (usage === null) return null;
                  const left =
                    (usage.allowanceRemaining ?? 0) + (usage.topUpRemaining ?? 0);
                  const low = usage.remainingPct <= 0.2;
                  const empty = usage.remainingPct <= 0;
                  const usageLimit =
                    (usage.planAllowance ?? 0) + (usage.topUpCredits ?? 0);
                  return (
                    <div
                      className={`mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm ${
                        empty
                          ? 'border-red-200 bg-red-50 text-red-700'
                          : low
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : 'border-green-200 bg-green-50 text-green-800'
                      }`}
                    >
                      <div className="min-w-[220px] flex-1">
                        <UsageBar
                          used={usage.used ?? 0}
                          limit={usageLimit}
                          label="Conversations"
                        />
                        <div className="mt-1.5">
                          <strong>{left}</strong> conversations left
                          {empty
                            ? ' — AI paused'
                            : low
                            ? ' — running low'
                            : ''}
                          <span className="text-muted">
                            {' '}
                            ({usage.allowanceRemaining}/{usage.planAllowance} plan
                            {usage.topUpRemaining > 0 &&
                              ` + ${usage.topUpRemaining} top-up`}
                            )
                          </span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTopUpClientId(
                            topUpClientId === c.id ? null : c.id,
                          );
                          setTopUpForm({ credits: 500, priceLkr: 3000, note: '' });
                        }}
                      >
                        Top up
                      </Button>
                    </div>
                  );
                })()}

                {topUpClientId === c.id && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-page/60 px-3 py-2">
                    <Input
                      type="number"
                      min={1}
                      value={topUpForm.credits}
                      onChange={(e) =>
                        setTopUpForm({
                          ...topUpForm,
                          credits: Number(e.target.value),
                        })
                      }
                      placeholder="Credits"
                      className="w-[110px]"
                    />
                    <Input
                      type="number"
                      min={0}
                      value={topUpForm.priceLkr}
                      onChange={(e) =>
                        setTopUpForm({
                          ...topUpForm,
                          priceLkr: Number(e.target.value),
                        })
                      }
                      placeholder="Price (LKR)"
                      className="w-[130px]"
                    />
                    <Input
                      value={topUpForm.note}
                      onChange={(e) =>
                        setTopUpForm({ ...topUpForm, note: e.target.value })
                      }
                      placeholder="Note (optional)"
                      className="min-w-[160px] flex-1"
                    />
                    <Button size="sm" onClick={() => handleTopUp(c.id)}>
                      Confirm top-up
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTopUpClientId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                )}

                {isConnected && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={`/dashboard/ai-settings?clientId=${c.id}`}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs font-medium text-brand-navy transition-colors hover:bg-page"
                    >
                      Edit AI Settings
                    </a>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Meta webhook setup guide */}
      {metaGuideClient && (
        <Modal
          open
          onClose={() => setMetaGuideClient(null)}
          title="Meta Webhook Setup"
        >
          <div className="flex flex-col gap-3">
            <p className="m-0 text-sm text-muted">
              Copy the values below into your Meta Developers app WhatsApp
              product configuration.
            </p>

            <div>
              <span className="mb-1 block text-sm font-medium">Callback URL</span>
              <div className="flex gap-2">
                <Input readOnly value={callbackUrl} />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(callbackUrl)}
                >
                  Copy
                </Button>
              </div>
            </div>

            <div>
              <span className="mb-1 block text-sm font-medium">Verify Token</span>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={metaGuideClient.verifyToken || 'Not generated'}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    metaGuideClient.verifyToken &&
                    copyToClipboard(metaGuideClient.verifyToken)
                  }
                >
                  Copy
                </Button>
              </div>
            </div>

            <div className={sectionClass}>
              <div className={sectionTitleClass}>Steps</div>
              <ol className="m-0 list-decimal pl-5 text-sm leading-relaxed text-brand-navy">
                <li>
                  Open{' '}
                  <a
                    href="https://developers.facebook.com/apps/"
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-indigo underline"
                  >
                    Meta Developers
                  </a>{' '}
                  and select your app.
                </li>
                <li>Go to WhatsApp → Configuration.</li>
                <li>Paste the Callback URL above into the Callback URL field.</li>
                <li>Paste the Verify Token above into the Verify Token field.</li>
                <li>Click Verify and Save.</li>
                <li>
                  Subscribe to <strong>messages</strong> and{' '}
                  <strong>message_deliveries</strong> webhook fields.
                </li>
              </ol>
            </div>

            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                metaGuideClient.metaWebhookStatus === 'active'
                  ? 'bg-green-50 text-green-800'
                  : 'bg-amber-50 text-amber-800'
              }`}
            >
              Status:{' '}
              <strong>
                {metaGuideClient.metaWebhookStatus === 'active'
                  ? 'Recent webhook received'
                  : 'Waiting for first webhook'}
              </strong>
              {metaGuideClient.lastWebhookAt && (
                <div>
                  Last received:{' '}
                  {new Date(metaGuideClient.lastWebhookAt).toLocaleString()}
                </div>
              )}
            </div>

            <div>
              <Button variant="outline" onClick={() => setMetaGuideClient(null)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
