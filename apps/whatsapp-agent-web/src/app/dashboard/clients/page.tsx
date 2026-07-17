'use client';

import { useEffect, useState } from 'react';

interface Client {
  id: string;
  name: string;
  whatsappNumber: string;
  whatsappPhoneNumberId: string;
  metaAccessToken: string;
  status: string;
  chatwootAccountId?: number | null;
  chatwootInboxId?: number | null;
}

interface ChatwootStatus {
  connected: boolean;
  accountId?: number | null;
  accountName?: string | null;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, ChatwootStatus>>({});
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState({
    name: '',
    whatsappNumber: '',
    whatsappPhoneNumberId: '',
    metaAccessToken: '',
    autoSetup: true,
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
      whatsappNumber: '',
      whatsappPhoneNumberId: '',
      metaAccessToken: '',
      autoSetup: true,
    });
    setEditing(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(editing ? 'update' : 'create');

    const payload = {
      name: form.name,
      whatsappNumber: form.whatsappNumber,
      whatsappPhoneNumberId: form.whatsappPhoneNumberId,
      metaAccessToken: form.metaAccessToken,
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
            `Client saved and Chatwoot account ${setupData.chatwootAccountId} connected`,
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
      whatsappNumber: client.whatsappNumber,
      whatsappPhoneNumberId: client.whatsappPhoneNumberId,
      metaAccessToken: client.metaAccessToken,
      autoSetup: false,
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

  const syncAgents = async (clientId: string) => {
    setLoading(`sync-${clientId}`);
    try {
      const res = await fetch(`/api/clients/${clientId}/chatwoot-agents`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        showInfo(data.error || 'Agent sync failed');
      } else {
        showInfo(`${data.synced} agent(s) synced to Chatwoot`);
      }
    } finally {
      setLoading(null);
    }
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
            gap: 12,
          }}
        >
          <input
            placeholder="Client name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            style={inputStyle}
          />
          <input
            placeholder="WhatsApp number (e.g. +94751234567)"
            value={form.whatsappNumber}
            onChange={(e) =>
              setForm({ ...form, whatsappNumber: e.target.value })
            }
            required
            style={inputStyle}
          />
          <input
            placeholder="WhatsApp Phone Number ID"
            value={form.whatsappPhoneNumberId}
            onChange={(e) =>
              setForm({ ...form, whatsappPhoneNumberId: e.target.value })
            }
            required
            style={inputStyle}
          />
          <input
            placeholder="Meta Access Token"
            value={form.metaAccessToken}
            onChange={(e) =>
              setForm({ ...form, metaAccessToken: e.target.value })
            }
            required
            style={inputStyle}
          />
          {!editing && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={form.autoSetup}
                onChange={(e) =>
                  setForm({ ...form, autoSetup: e.target.checked })
                }
              />
              Auto-setup Chatwoot account
            </label>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
        {clients.map((c) => {
          const status = statusMap[c.id];
          const isConnected = status?.connected || !!c.chatwootAccountId;
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
                    </span>
                  </div>
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
                  <button onClick={() => handleDelete(c.id)} style={buttonStyle('#ef4444')}>
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
                    <button
                      onClick={() => syncAgents(c.id)}
                      disabled={loading === `sync-${c.id}`}
                      style={{
                        ...buttonStyle('#2563eb'),
                        opacity: loading === `sync-${c.id}` ? 0.7 : 1,
                      }}
                    >
                      {loading === `sync-${c.id}` ? 'Syncing...' : 'Sync Agents'}
                    </button>
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
