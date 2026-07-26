'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  Table,
  TD,
  TH,
  THead,
  TR,
  Textarea,
  useToast,
} from '@/components/ui';
import { isPortalUser } from '../portal';

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

export default function CannedResponsesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [responses, setResponses] = useState<CannedResponse[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ shortcut: '', title: '', content: '' });
  const toast = useToast();

  const token =
    (typeof window !== 'undefined' && localStorage.getItem('token')) || '';

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
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
    if (isPortalUser()) {
      window.location.href = '/dashboard/bookings';
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
      toast(data.message || 'Failed to save template', 'error');
      return;
    }
    toast(editingId ? 'Template updated' : 'Template created', 'success');
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
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Message templates per client. Agents use them in Chatwoot by typing{' '}
        <code className="rounded bg-page px-1 py-0.5 font-mono text-xs">
          /shortcut
        </code>
        . Supported variables:{' '}
        <code className="rounded bg-page px-1 py-0.5 font-mono text-xs">
          {'{{customer_name}}'}
        </code>
        ,{' '}
        <code className="rounded bg-page px-1 py-0.5 font-mono text-xs">
          {'{{business_name}}'}
        </code>
        ,{' '}
        <code className="rounded bg-page px-1 py-0.5 font-mono text-xs">
          {'{{agent_name}}'}
        </code>
        .
      </p>

      <Card className="max-w-sm">
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
        <>
          <Card title={editingId ? 'Edit Template' : 'Add Template'}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="sm:flex-1">
                  <Input
                    placeholder="Shortcut (e.g. greeting)"
                    value={form.shortcut}
                    onChange={(e) =>
                      setForm({ ...form, shortcut: e.target.value })
                    }
                    required
                  />
                </div>
                <div className="sm:flex-[2]">
                  <Input
                    placeholder="Title (e.g. Welcome greeting)"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    required
                  />
                </div>
              </div>
              <Textarea
                placeholder="Message content. Use {{customer_name}}, {{business_name}}, {{agent_name}} as variables."
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                required
                rows={4}
                className="resize-y"
              />
              <div className="flex gap-2">
                <Button type="submit">
                  {editingId ? 'Update Template' : 'Add Template'}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setForm({ shortcut: '', title: '', content: '' });
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Card>

          <Card title="Templates">
            {responses.length === 0 ? (
              <EmptyState
                title="No templates yet"
                hint="Add a template above so agents can use it in Chatwoot."
              />
            ) : (
              <Table>
                <THead>
                  <TR>
                    <TH>Shortcut</TH>
                    <TH>Title</TH>
                    <TH>Content</TH>
                    <TH>Actions</TH>
                  </TR>
                </THead>
                <tbody>
                  {responses.map((r) => (
                    <TR key={r.id}>
                      <TD className="font-mono">/{r.shortcut}</TD>
                      <TD>{r.title}</TD>
                      <TD className="max-w-[400px] overflow-hidden text-ellipsis whitespace-nowrap">
                        {r.content}
                      </TD>
                      <TD>
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(r)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDelete(r.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
