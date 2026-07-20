'use client';

import { useEffect, useState } from 'react';

interface Client {
  id: string;
  name: string;
}

interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Source {
  documentId: string;
  preview: string;
  score: number;
}

interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface PlaygroundResponse {
  reply: string;
  handoffRecommended: boolean;
  handoffReason: string;
  sources: Source[];
  usage: Usage;
}

const inputStyle: React.CSSProperties = {
  padding: 8,
  borderRadius: 4,
  border: '1px solid #d1d5db',
  fontSize: 14,
  width: '100%',
};

const buttonStyle = (color: string): React.CSSProperties => ({
  padding: '8px 16px',
  background: color,
  color: 'white',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: 600,
});

const sectionStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 12,
  border: '1px solid #e5e7eb',
  borderRadius: 6,
  background: '#f9fafb',
};

export default function PlaygroundPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [historyJson, setHistoryJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PlaygroundResponse | null>(null);

  const token =
    (typeof window !== 'undefined' && localStorage.getItem('token')) || '';

  const showError = (text: string) => {
    setError(text);
    setTimeout(() => setError(null), 5000);
  };

  const fetchClients = async () => {
    if (!token) return;
    const res = await fetch('/api/clients', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    setClients(list);
  };

  useEffect(() => {
    if (!token) {
      window.location.href = '/login';
      return;
    }
    fetchClients();
  }, []);

  const parseHistory = (): HistoryMessage[] | null => {
    if (!historyJson.trim()) return [];
    try {
      const parsed = JSON.parse(historyJson);
      if (!Array.isArray(parsed)) return null;
      return parsed.map((m) => ({
        role: m.role,
        content: String(m.content),
      }));
    } catch {
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) {
      showError('Please select a client');
      return;
    }
    if (!message.trim()) {
      showError('Please enter a message');
      return;
    }

    const history = parseHistory();
    if (history === null) {
      showError('History must be a valid JSON array');
      return;
    }

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch(`/api/playground/${selectedId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: message.trim(), history }),
      });
      const data = await res.json();
      if (!res.ok) {
        showError(data.error || data.message || 'Request failed');
      } else {
        setResult(data as PlaygroundResponse);
      }
    } catch {
      showError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>AI Testing Playground</h1>
      <p style={{ color: '#6b7280', fontSize: 14 }}>
        Send a test message to the AI and inspect the reply, handoff decision,
        token usage, and knowledge sources.
      </p>

      {error && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 6,
            color: '#b91c1c',
          }}
        >
          {error}
        </div>
      )}

      <div style={{ marginTop: 16, maxWidth: 400 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>Client</label>
        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setResult(null);
          }}
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

      <form
        onSubmit={handleSubmit}
        style={{
          marginTop: 24,
          maxWidth: 640,
          background: 'white',
          padding: 16,
          borderRadius: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div>
          <label style={{ fontSize: 13, fontWeight: 600 }}>
            Customer message
          </label>
          <textarea
            placeholder="Type a customer question..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            required
            style={{
              ...inputStyle,
              marginTop: 4,
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600 }}>
            Conversation history (optional JSON)
          </label>
          <textarea
            placeholder={`[{ "role": "user", "content": "Hello" }, { "role": "assistant", "content": "Hi!" }]`}
            value={historyJson}
            onChange={(e) => setHistoryJson(e.target.value)}
            rows={3}
            style={{
              ...inputStyle,
              marginTop: 4,
              resize: 'vertical',
              fontFamily: 'monospace',
            }}
          />
          <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>
            Optional JSON array of previous messages.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            type="submit"
            disabled={loading}
            style={buttonStyle('#2563eb')}
          >
            {loading ? 'Testing...' : 'Test'}
          </button>
          {loading && (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              style={{ animation: 'spin 1s linear infinite' }}
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="#d1d5db"
                strokeWidth="3"
                fill="none"
              />
              <path
                d="M12 2a10 10 0 0 1 10 10"
                stroke="#2563eb"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
              <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
              `}</style>
            </svg>
          )}
        </div>
      </form>

      {result && (
        <div
          style={{
            marginTop: 24,
            maxWidth: 720,
            background: 'white',
            padding: 16,
            borderRadius: 8,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div>
            <h3 style={{ marginTop: 0, fontSize: 16 }}>AI Reply</h3>
            <div
              style={{
                padding: 12,
                background: '#f9fafb',
                borderRadius: 6,
                border: '1px solid #e5e7eb',
                fontSize: 14,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}
            >
              {result.reply}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={sectionStyle}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Handoff</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'white',
                    background: result.handoffRecommended ? '#ef4444' : '#16a34a',
                  }}
                >
                  {result.handoffRecommended ? 'Recommended' : 'Not recommended'}
                </span>
              </div>
              {result.handoffRecommended && result.handoffReason && (
                <div style={{ fontSize: 13, marginTop: 6, color: '#374151' }}>
                  {result.handoffReason}
                </div>
              )}
            </div>

            <div style={sectionStyle}>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Token usage</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>
                {result.usage.total_tokens} total
              </div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>
                prompt {result.usage.prompt_tokens} • completion{' '}
                {result.usage.completion_tokens}
              </div>
            </div>
          </div>

          <div>
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Knowledge Sources</h3>
            {result.sources.length === 0 ? (
              <p style={{ color: '#6b7280', fontSize: 14 }}>No sources used.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.sources.map((s, i) => (
                  <div
                    key={i}
                    style={{
                      padding: 12,
                      border: '1px solid #e5e7eb',
                      borderRadius: 6,
                      background: '#f9fafb',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 4,
                      }}
                    >
                      <span style={{ fontSize: 12, color: '#6b7280' }}>
                        Document {s.documentId}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#2563eb',
                        }}
                      >
                        {(s.score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#374151' }}>
                      {s.preview}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
