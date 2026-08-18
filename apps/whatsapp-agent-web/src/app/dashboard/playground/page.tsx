'use client';

import { useEffect, useState } from 'react';
import { isPortalUser } from '../portal';
import { apiFetch } from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Select,
  Spinner,
  Textarea,
  useToast,
} from '@/components/ui';

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

interface UsageWallet {
  balance: number;
  used: number;
  planAllowance: number;
  topUpCredits: number;
  allowanceRemaining: number;
  topUpRemaining: number;
  remainingPct: number;
  periodStart: string;
  periodEnd: string;
  topUps: {
    id: string;
    credits: number;
    priceLkr: number;
    note?: string | null;
    createdAt: string;
  }[];
}

interface PlaygroundResponse {
  reply: string;
  handoffRecommended: boolean;
  handoffReason: string;
  action: { type: string; [key: string]: unknown } | null;
  actionResult: string | null;
  sources: Source[];
  usage: Usage;
  paused: boolean;
  wallet: UsageWallet | null;
}

export default function PlaygroundPage() {
  const toast = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [channel, setChannel] = useState<'whatsapp' | 'messenger' | 'instagram'>('whatsapp');
  const [message, setMessage] = useState('');
  const [historyJson, setHistoryJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PlaygroundResponse | null>(null);

  const token =
    (typeof window !== 'undefined' && localStorage.getItem('token')) || '';

  const showError = (text: string) => {
    toast(text, 'error');
  };

  const fetchClients = async () => {
    if (!token) return;
    const res = await apiFetch('/api/clients', {
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
    if (isPortalUser()) {
      window.location.href = '/dashboard/bookings';
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

    try {
      const res = await apiFetch(`/api/playground/${selectedId}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: message.trim(), channel, history }),
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
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm text-muted">
        Send a test message to the AI and inspect the reply, handoff decision,
        token usage, and knowledge sources.
      </p>

      <Card className="max-w-md">
        <Select
          label="Client"
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value);
            setResult(null);
          }}
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
        <Card className="max-w-md">
          <Select
            label="Channel"
            value={channel}
            onChange={(e) =>
              setChannel(e.target.value as 'whatsapp' | 'messenger' | 'instagram')
            }
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="messenger">Messenger</option>
            <option value="instagram">Instagram</option>
          </Select>
        </Card>
      )}

      <Card title="Test message" className="max-w-2xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Textarea
            label="Customer message"
            placeholder="Type a customer question..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            required
            className="resize-y"
          />

          <div>
            <Textarea
              label="Conversation history (optional JSON)"
              placeholder={`[{ "role": "user", "content": "Hello" }, { "role": "assistant", "content": "Hi!" }]`}
              value={historyJson}
              onChange={(e) => setHistoryJson(e.target.value)}
              rows={3}
              className="resize-y font-mono"
            />
            <p className="m-0 mt-1 text-xs text-muted">
              Optional JSON array of previous messages.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? 'Testing...' : 'Test'}
            </Button>
            {loading && <Spinner className="h-[18px] w-[18px]" />}
          </div>
        </form>
      </Card>

      {result && (
        <Card className="flex max-w-3xl flex-col gap-4">
          <div>
            <h3 className="m-0 mb-3 text-base font-semibold">AI Reply</h3>
            {result.paused && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                AI paused — allowance exhausted (this is what customers
                experience at 0 balance)
              </div>
            )}
            <div className="whitespace-pre-wrap rounded-lg border border-line bg-page p-3 text-sm leading-normal">
              {result.reply}
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="rounded-lg border border-line bg-page p-3">
              <div className="text-xs text-muted">Handoff</div>
              <div className="mt-1 flex items-center gap-2">
                <Badge tone={result.handoffRecommended ? 'red' : 'green'}>
                  {result.handoffRecommended ? 'Recommended' : 'Not recommended'}
                </Badge>
              </div>
              {result.handoffRecommended && result.handoffReason && (
                <div className="mt-1.5 text-[13px] text-gray-700">
                  {result.handoffReason}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-line bg-page p-3">
              <div className="text-xs text-muted">Token usage</div>
              <div className="text-sm font-semibold">
                {result.usage.total_tokens} total
              </div>
              <div className="text-xs text-muted">
                prompt {result.usage.prompt_tokens} • completion{' '}
                {result.usage.completion_tokens}
              </div>
            </div>
          </div>

          {result.action && (
            <div className="rounded-lg border border-line bg-page p-3">
              <div className="text-xs text-muted">
                Booking action (executed by the backend)
              </div>
              <pre className="mt-2 overflow-auto rounded-lg bg-brand-navy p-3 text-xs text-brand-teal">
                {JSON.stringify(result.action, null, 2)}
              </pre>
              {result.actionResult && (
                <div className="mt-2 text-[13px] text-gray-700">
                  {result.actionResult}
                </div>
              )}
            </div>
          )}

          <div>
            <h3 className="m-0 mb-3 text-base font-semibold">
              Knowledge Sources
            </h3>
            {result.sources.length === 0 ? (
              <EmptyState title="No sources used." />
            ) : (
              <div className="flex flex-col gap-2">
                {result.sources.map((s, i) => (
                  <div
                    key={i}
                    className="rounded-lg border border-line bg-page p-3"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs text-muted">
                        Document {s.documentId}
                      </span>
                      <span className="text-xs font-semibold text-brand-indigo">
                        {(s.score * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-[13px] text-gray-700">{s.preview}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
