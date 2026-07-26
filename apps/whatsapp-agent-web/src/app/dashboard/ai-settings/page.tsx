'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { isPortalUser } from '../portal';
import {
  Button,
  Card,
  Input,
  PageLoading,
  Select,
  Textarea,
  useToast,
} from '@/components/ui';

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

function AiSettingsForm() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const initialClientId = searchParams.get('clientId') || '';

  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState<string>(initialClientId);
  const [loading, setLoading] = useState(false);
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
    if (isPortalUser()) {
      window.location.href = '/dashboard/bookings';
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
        toast(data.error || data.message || 'Failed to save AI settings', 'error');
      } else {
        toast('AI settings saved', 'success');
        await fetchClients();
      }
    } catch {
      toast('Network error', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm text-muted">
        Configure AI behaviour per client. These settings are used by the
        WhatsApp message handler.
      </p>

      <Card title="Client">
        <Select
          label="Client"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">Select a client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Card>

      {selectedId && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Card title="General">
            <label className="flex items-center gap-2 text-sm text-brand-navy">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-indigo"
                checked={form.aiEnabled}
                onChange={(e) =>
                  setForm({ ...form, aiEnabled: e.target.checked })
                }
              />
              AI enabled
            </label>
          </Card>

          <Card title="System Prompt">
            <Textarea
              placeholder="Defines AI personality, tone, and business rules"
              value={form.systemPrompt}
              onChange={(e) =>
                setForm({ ...form, systemPrompt: e.target.value })
              }
              rows={8}
              className="resize-y"
            />
          </Card>

          <Card title="Model & Generation">
            <div className="flex flex-col gap-3">
              <Input
                placeholder="AI model (e.g. kimi-latest)"
                value={form.aiModel}
                onChange={(e) => setForm({ ...form, aiModel: e.target.value })}
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <span className="mb-1 block text-xs text-muted">
                    Temperature ({form.aiTemperature})
                  </span>
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
                    className="w-full accent-brand-indigo"
                  />
                </div>
                <Input
                  label="Max tokens"
                  type="number"
                  value={form.maxTokens}
                  onChange={(e) =>
                    setForm({ ...form, maxTokens: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <span className="mb-1 block text-xs text-muted">
                  Confidence threshold ({form.confidenceThreshold})
                </span>
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
                  className="w-full accent-brand-indigo"
                />
              </div>
            </div>
          </Card>

          <Card title="Messages">
            <div className="flex flex-col gap-3">
              <Input
                placeholder="Welcome message (first message to new customers)"
                value={form.welcomeMessage}
                onChange={(e) =>
                  setForm({ ...form, welcomeMessage: e.target.value })
                }
              />
              <Input
                placeholder="Fallback message (when AI cannot answer)"
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
              <Input
                placeholder="Outside-hours message (sent when closed)"
                value={form.outsideHoursMessage}
                onChange={(e) =>
                  setForm({ ...form, outsideHoursMessage: e.target.value })
                }
              />
            </div>
          </Card>

          <Card title="Operating Hours">
            <div className="flex flex-col gap-3">
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
              <p className="m-0 text-xs text-muted">
                Outside operating hours, customers receive the outside-hours
                message and the conversation is queued for a human agent.
              </p>
            </div>
          </Card>

          <Card title="Customer Satisfaction (CSAT)">
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 text-sm text-brand-navy">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-brand-indigo"
                  checked={form.csatEnabled}
                  onChange={(e) =>
                    setForm({ ...form, csatEnabled: e.target.checked })
                  }
                />
                Send a rating request after a conversation is resolved
              </label>
              {form.csatEnabled && (
                <Input
                  placeholder="CSAT message (ask for a 1-5 rating)"
                  value={form.csatMessage}
                  onChange={(e) =>
                    setForm({ ...form, csatMessage: e.target.value })
                  }
                />
              )}
            </div>
          </Card>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : 'Save AI Settings'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export default function AiSettingsPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading AI Settings…" />}>
      <AiSettingsForm />
    </Suspense>
  );
}
