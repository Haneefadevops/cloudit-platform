'use client';

import { useEffect, useState } from 'react';

interface Client {
  id: string;
  name: string;
  whatsappNumber: string;
  status: string;
  chatwootAccountId?: number | null;
  chatwootInboxId?: number | null;
}

interface ChatwootStatus {
  connected: boolean;
  accountId?: number | null;
  accountName?: string;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, ChatwootStatus>>({});
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const token =
    (typeof window !== 'undefined' && localStorage.getItem('token')) || '';

  const fetchClients = async () => {
    const res = await fetch('/api/clients', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setClients(data);
    return data as Client[];
  };

  const fetchStatus = async (clientId: string) => {
    const res = await fetch(`/api/clients/${clientId}/chatwoot-status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    setStatusMap((prev) => ({ ...prev, [clientId]: data }));
  };

  useEffect(() => {
    fetchClients().then((data) => {
      data.forEach((c) => fetchStatus(c.id));
    });
  }, []);

  const showInfo = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 4000);
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const payload = {
      name: formData.get('name') as string,
      whatsappNumber: formData.get('whatsappNumber') as string,
      whatsappPhoneNumberId: formData.get('whatsappPhoneNumberId') as string,
      metaAccessToken: formData.get('metaAccessToken') as string,
    };
    const autoSetup = formData.get('autoSetup') === 'on';

    setLoading('create');
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const client = await res.json();
      if (!res.ok) {
        showInfo(client.error || 'Failed to create client');
        return;
      }

      if (autoSetup) {
        const setupRes = await fetch(
          `/api/clients/${client.id}/chatwoot-setup`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const setupData = await setupRes.json();
        if (!setupRes.ok) {
          showInfo(setupData.error || 'Client created but Chatwoot setup failed');
        } else {
          showInfo(
            `Client created and Chatwoot account ${setupData.chatwootAccountId} connected`,
          );
        }
      } else {
        showInfo('Client created');
      }

      form.reset();
      setShowForm(false);
      await fetchClients();
      await fetchStatus(client.id);
    } finally {
      setLoading(null);
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
      await fetchClients();
      await fetchStatus(clientId);
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
          onClick={() => setShowForm((s) => !s)}
          style={{
            padding: '8px 16px',
            background: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          {showForm ? 'Cancel' : 'Add Client'}
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
          onSubmit={handleCreate}
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
          <input name="name" placeholder="Client name" required style={inputStyle} />
          <input
            name="whatsappNumber"
            placeholder="WhatsApp number (e.g. +94751234567)"
            required
            style={inputStyle}
          />
          <input
            name="whatsappPhoneNumberId"
            placeholder="WhatsApp Phone Number ID"
            required
            style={inputStyle}
          />
          <input
            name="metaAccessToken"
            placeholder="Meta Access Token"
            required
            style={inputStyle}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
            <input type="checkbox" name="autoSetup" defaultChecked />
            Auto-setup Chatwoot account
          </label>
          <button
            type="submit"
            disabled={loading === 'create'}
            style={{
              padding: '8px 16px',
              background: '#16a34a',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              opacity: loading === 'create' ? 0.7 : 1,
            }}
          >
            {loading === 'create' ? 'Creating...' : 'Create Client'}
          </button>
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
                    {c.whatsappNumber} • {c.status}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {isConnected ? (
                    <>
                      <button
                        onClick={() => syncAgents(c.id)}
                        disabled={loading === `sync-${c.id}`}
                        style={{
                          padding: '6px 12px',
                          background: '#2563eb',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 13,
                          opacity: loading === `sync-${c.id}` ? 0.7 : 1,
                        }}
                      >
                        {loading === `sync-${c.id}` ? 'Syncing...' : 'Sync Agents'}
                      </button>
                      <button
                        onClick={() => fetchStatus(c.id)}
                        style={{
                          padding: '6px 12px',
                          background: '#f3f4f6',
                          border: '1px solid #d1d5db',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 13,
                        }}
                      >
                        Refresh Status
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setupChatwoot(c.id)}
                      disabled={loading === `setup-${c.id}`}
                      style={{
                        padding: '6px 12px',
                        background: '#2563eb',
                        color: 'white',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 13,
                        opacity: loading === `setup-${c.id}` ? 0.7 : 1,
                      }}
                    >
                      {loading === `setup-${c.id}` ? 'Setting up...' : 'Setup Chatwoot'}
                    </button>
                  )}
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
                }}
              >
                {status === undefined
                  ? 'Loading Chatwoot status...'
                  : isConnected
                  ? `Chatwoot connected • Account ${
                      status?.accountId ?? c.chatwootAccountId
                    }${status?.accountName ? ` (${status.accountName})` : ''}`
                  : 'Chatwoot not connected'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
