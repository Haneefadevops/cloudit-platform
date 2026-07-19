'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface Client {
  id: string;
  name: string;
  systemPrompt?: string | null;
  aiTemperature?: number | null;
  aiModel?: string | null;
  maxTokens?: number | null;
  confidenceThreshold?: number | null;
  aiEnabled?: boolean | null;
  welcomeMessage?: string | null;
  fallbackMessage?: string | null;
  handoffKeywords?: string | null;
  operatingHoursStart?: string | null;
  operatingHoursEnd?: string | null;
  closedDays?: string | null;
  outsideHoursMessage?: string | null;
  csatEnabled?: boolean | null;
  csatMessage?: string | null;
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

function AiSettingsForm() {
  const searchParams = useSearchParams();
  const initialClientId = searchParams.get('clientId') || '';

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState<string>(initialClientId);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    systemPrompt: '',
    aiTemperature: 1.0,
    aiModel: 'kimi-latest',
    maxTokens: 1024,
    confidenceThreshold: 0.7,
    aiEnabled: true,
    welcomeMessage: '',
    fallbackMessage: '',
    handoffKeywords: '',
    operatingHoursStart: '',
    operatingHoursEnd: '',
    closedDays: '',
    outsideHoursMessage: '',
    csatEnabled: true,
    csatMessage: '',
  });

  const token =
    (typeof window !== 'undefined' && localStorage.getItem('token')) || '';

  const showInfo = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 4000);
  };

  const fetchClients = async () => {
    if (!token) return;
    const res = await fetch('/api/clients', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    setClients(list);
    if (!selectedId && list.length > 0) {
      setSelectedId(list[0].id);
    }
  };

  useEffect(() => {
    if (!token) {
      window.location.href = '/login';
      return;
    }
    fetchClients();
  }, []);

  useEffect(() => {
    const client = clients.find((c) => c.id === selectedId);
    if (!client) return;
    setForm({
      systemPrompt: client.systemPrompt || '',
      aiTemperature: client.aiTemperature ?? 1.0,
      aiModel: client.aiModel || 'kimi-latest',
      maxTokens: client.maxTokens ?? 1024,
      confidenceThreshold: client.confidenceThreshold ?? 0.7,
      aiEnabled: client.aiEnabled ?? true,
      welcomeMessage: client.welcomeMessage || '',
      fallbackMessage: client.fallbackMessage || '',
      handoffKeywords: client.handoffKeywords || '',
      operatingHoursStart: client.operatingHoursStart || '',
      operatingHoursEnd: client.operatingHoursEnd || '',
      closedDays: client.closedDays || '',
      outsideHoursMessage: client.outsideHoursMessage || '',
      csatEnabled: client.csatEnabled ?? true,
      csatMessage: client.csatMessage || '',
    });
  }, [selectedId, clients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    setLoading(true);

    const payload = {
      systemPrompt: form.systemPrompt || null,
      aiTemperature: Number(form.aiTemperature),
      aiModel: form.aiModel || null,
      maxTokens: Number(form.maxTokens),
      confidenceThreshold: Number(form.confidenceThreshold),
      aiEnabled: form.aiEnabled,
      welcomeMessage: form.welcomeMessage || null,
      fallbackMessage: form.fallbackMessage || null,
      handoffKeywords: form.handoffKeywords || null,
      operatingHoursStart: form.operatingHoursStart || null,
      operatingHoursEnd: form.operatingHoursEnd || null,
      closedDays: form.closedDays || null,
      outsideHoursMessage: form.outsideHoursMessage || null,
      csatEnabled: form.csatEnabled,
      csatMessage: form.csatMessage || null,
    };

    try {
      const res = await fetch(`/api/clients/${selectedId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        showInfo(data.error || data.message || 'Failed to save AI settings');
      } else {
        showInfo('AI settings saved');
        await fetchClients();
      }
    } catch {
      showInfo('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>AI Settings</h1>
      <p style={{ color: '#6b7280', fontSize: 14 }}>
        Configure AI behaviour per client. These settings are used by the
        WhatsApp message handler.
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

      <div style={{ marginTop: 16 }}>
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
            <div style={sectionTitleStyle}>General</div>
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
                checked={form.aiEnabled}
                onChange={(e) =>
                  setForm({ ...form, aiEnabled: e.target.checked })
                }
              />
              AI enabled
            </label>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>System Prompt</div>
            <textarea
              placeholder="Defines AI personality, tone, and business rules"
              value={form.systemPrompt}
              onChange={(e) =>
                setForm({ ...form, systemPrompt: e.target.value })
              }
              rows={8}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Model & Generation</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                placeholder="AI model (e.g. kimi-latest)"
                value={form.aiModel}
                onChange={(e) => setForm({ ...form, aiModel: e.target.value })}
                style={inputStyle}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: '#6b7280' }}>
                    Temperature ({form.aiTemperature})
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={form.aiTemperature}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        aiTemperature: Number(e.target.value),
                      })
                    }
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, color: '#6b7280' }}>
                    Max tokens
                  </label>
                  <input
                    type="number"
                    value={form.maxTokens}
                    onChange={(e) =>
                      setForm({ ...form, maxTokens: Number(e.target.value) })
                    }
                    style={inputStyle}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, color: '#6b7280' }}>
                  Confidence threshold ({form.confidenceThreshold})
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={form.confidenceThreshold}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      confidenceThreshold: Number(e.target.value),
                    })
                  }
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Messages</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                placeholder="Welcome message (first message to new customers)"
                value={form.welcomeMessage}
                onChange={(e) =>
                  setForm({ ...form, welcomeMessage: e.target.value })
                }
                style={inputStyle}
              />
              <input
                placeholder="Fallback message (when AI cannot answer)"
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
              <input
                placeholder="Outside-hours message (sent when closed)"
                value={form.outsideHoursMessage}
                onChange={(e) =>
                  setForm({ ...form, outsideHoursMessage: e.target.value })
                }
                style={inputStyle}
              />
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Operating Hours</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
              <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
                Outside operating hours, customers receive the outside-hours
                message and the conversation is queued for a human agent.
              </p>
            </div>
          </div>

          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Customer Satisfaction (CSAT)</div>
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
                  checked={form.csatEnabled}
                  onChange={(e) =>
                    setForm({ ...form, csatEnabled: e.target.checked })
                  }
                />
                Send a rating request after a conversation is resolved
              </label>
              {form.csatEnabled && (
                <input
                  placeholder="CSAT message (ask for a 1-5 rating)"
                  value={form.csatMessage}
                  onChange={(e) =>
                    setForm({ ...form, csatMessage: e.target.value })
                  }
                  style={inputStyle}
                />
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="submit"
              disabled={loading}
              style={buttonStyle('#16a34a')}
            >
              {loading ? 'Saving...' : 'Save AI Settings'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function AiSettingsPage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: 24, color: '#6b7280' }}>Loading AI Settings...</div>
      }
    >
      <AiSettingsForm />
    </Suspense>
  );
}
