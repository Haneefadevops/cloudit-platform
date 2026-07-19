'use client';

import { useEffect, useState } from 'react';

interface Client {
  id: string;
  name: string;
}

interface CannedResponse {
  id: string;
  shortcut: string;
  title: string;
  content: string;
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

export default function CannedResponsesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [responses, setResponses] = useState<CannedResponse[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ shortcut: '', title: '', content: '' });
  const [message, setMessage] = useState<string | null>(null);

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

  const fetchResponses = async (clientId: string) => {
    if (!clientId) return;
    const res = await fetch(`/api/canned-responses/${clientId}`, { headers });
    const list = await res.json();
    setResponses(Array.isArray(list) ? list : []);
  };

  useEffect(() => {
    if (!token) {
      window.location.href = '/login';
      return;
    }
    fetchClients();
  }, []);

  useEffect(() => {
    setEditingId(null);
    setForm({ shortcut: '', title: '', content: '' });
    fetchResponses(selectedId);
  }, [selectedId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;

    const url = editingId
      ? `/api/canned-responses/${selectedId}/${editingId}`
      : `/api/canned-responses/${selectedId}`;
    const res = await fetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers,
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      showInfo(data.message || 'Failed to save template');
      return;
    }
    showInfo(editingId ? 'Template updated' : 'Template created');
    setEditingId(null);
    setForm({ shortcut: '', title: '', content: '' });
    fetchResponses(selectedId);
  };

  const handleEdit = (r: CannedResponse) => {
    setEditingId(r.id);
    setForm({ shortcut: r.shortcut, title: r.title, content: r.content });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    await fetch(`/api/canned-responses/${selectedId}/${id}`, {
      method: 'DELETE',
      headers,
    });
    fetchResponses(selectedId);
  };

  return (
    <div>
      <h1>Canned Responses</h1>
      <p style={{ color: '#6b7280', fontSize: 14 }}>
        Message templates per client. Agents use them in Chatwoot by typing{' '}
        <code>/shortcut</code>. Supported variables:{' '}
        <code>{'{{customer_name}}'}</code>, <code>{'{{business_name}}'}</code>,{' '}
        <code>{'{{agent_name}}'}</code>.
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
            </option>
          ))}
        </select>
      </div>

      {selectedId && (
        <>
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
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder="Shortcut (e.g. greeting)"
                value={form.shortcut}
                onChange={(e) =>
                  setForm({ ...form, shortcut: e.target.value })
                }
                required
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                placeholder="Title (e.g. Welcome greeting)"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
                style={{ ...inputStyle, flex: 2 }}
              />
            </div>
            <textarea
              placeholder="Message content. Use {{customer_name}}, {{business_name}}, {{agent_name}} as variables."
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              required
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={buttonStyle('#16a34a')}>
                {editingId ? 'Update Template' : 'Add Template'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm({ shortcut: '', title: '', content: '' });
                  }}
                  style={buttonStyle('#6b7280')}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div
            style={{
              marginTop: 16,
              background: 'white',
              padding: 16,
              borderRadius: 8,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            {responses.length === 0 ? (
              <div style={{ color: '#6b7280' }}>No templates yet</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr
                    style={{ textAlign: 'left', color: '#6b7280', fontSize: 13 }}
                  >
                    <th style={{ paddingBottom: 8 }}>Shortcut</th>
                    <th style={{ paddingBottom: 8 }}>Title</th>
                    <th style={{ paddingBottom: 8 }}>Content</th>
                    <th style={{ paddingBottom: 8 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.map((r) => (
                    <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 0', fontFamily: 'monospace' }}>
                        /{r.shortcut}
                      </td>
                      <td style={{ padding: '10px 0' }}>{r.title}</td>
                      <td
                        style={{
                          padding: '10px 0',
                          maxWidth: 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {r.content}
                      </td>
                      <td style={{ padding: '10px 0' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => handleEdit(r)}
                            style={buttonStyle('#2563eb')}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(r.id)}
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
