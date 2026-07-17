'use client';

import { useEffect, useState } from 'react';

interface Agent {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  clientId?: string | null;
}

interface Client {
  id: string;
  name: string;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'agent',
    status: 'active',
    clientId: '',
  });

  const token =
    (typeof window !== 'undefined' && localStorage.getItem('token')) || '';

  const showInfo = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchData = async () => {
    if (!token) return;
    const [agentsRes, clientsRes] = await Promise.all([
      fetch('/api/agents', { headers: { Authorization: `Bearer ${token}` } }),
      fetch('/api/clients', { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    const agentsData = await agentsRes.json();
    const clientsData = await clientsRes.json();
    setAgents(Array.isArray(agentsData) ? agentsData : []);
    setClients(Array.isArray(clientsData) ? clientsData : []);
  };

  useEffect(() => {
    if (!token) {
      window.location.href = '/login';
      return;
    }
    fetchData();
  }, []);

  const resetForm = () => {
    setForm({
      name: '',
      email: '',
      password: '',
      role: 'agent',
      status: 'active',
      clientId: '',
    });
    setEditing(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = { ...form };
    if (!payload.clientId) delete (payload as any).clientId;
    if (editing && !payload.password) delete (payload as any).password;

    const url = editing ? `/api/agents/${editing.id}` : '/api/agents';
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
      const data = await res.json();
      if (!res.ok) {
        showInfo(data.error || data.message || 'Failed to save agent');
      } else {
        showInfo(editing ? 'Agent updated' : 'Agent created');
        resetForm();
        await fetchData();
      }
    } catch (err) {
      showInfo('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (agent: Agent) => {
    setEditing(agent);
    setForm({
      name: agent.name,
      email: agent.email,
      password: '',
      role: agent.role,
      status: agent.status,
      clientId: agent.clientId || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this agent?')) return;
    const res = await fetch(`/api/agents/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      showInfo('Agent deleted');
      await fetchData();
    } else {
      showInfo('Failed to delete agent');
    }
  };

  const toggleStatus = async (agent: Agent) => {
    const newStatus = agent.status === 'active' ? 'inactive' : 'active';
    const res = await fetch(`/api/agents/${agent.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      showInfo(`Agent ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
      await fetchData();
    } else {
      showInfo('Failed to update status');
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
        <h1>Agents</h1>
        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          style={buttonStyle('#2563eb')}
        >
          Add Agent
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
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            style={inputStyle}
          />
          <input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
            style={inputStyle}
          />
          <input
            placeholder={editing ? 'Password (leave blank to keep)' : 'Password'}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required={!editing}
            style={inputStyle}
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            style={inputStyle}
          >
            <option value="agent">Agent</option>
            <option value="supervisor">Supervisor</option>
            <option value="admin">Admin</option>
          </select>
          <select
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
            style={inputStyle}
          >
            <option value="">No client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" disabled={loading} style={buttonStyle('#16a34a')}>
              {loading ? 'Saving...' : editing ? 'Update Agent' : 'Create Agent'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              style={{
                ...buttonStyle('#6b7280'),
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
        {agents.map((a) => (
          <div
            key={a.id}
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
                <strong>{a.name}</strong>
                <div style={{ color: '#6b7280', fontSize: 14 }}>
                  {a.email} • {a.role} •{' '}
                  <span
                    style={{
                      color: a.status === 'active' ? '#16a34a' : '#ef4444',
                      fontWeight: 600,
                    }}
                  >
                    {a.status}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleEdit(a)} style={buttonStyle('#2563eb')}>
                  Edit
                </button>
                <button
                  onClick={() => toggleStatus(a)}
                  style={buttonStyle(a.status === 'active' ? '#f59e0b' : '#16a34a')}
                >
                  {a.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
                <button onClick={() => handleDelete(a.id)} style={buttonStyle('#ef4444')}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
