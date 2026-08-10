'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, Card, EmptyState, Input, Select, Table, TD, TH, THead, TR, useToast } from '@/components/ui';
import { isPortalUser } from '../portal';
import { apiFetch } from '@/lib/api';

interface Client { id: string; name: string }
interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

export default function ApiKeysPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [name, setName] = useState('');
  const [newKey, setNewKey] = useState('');
  const toast = useToast();
  const token = (typeof window !== 'undefined' && localStorage.getItem('token')) || '';
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const fetchClients = async () => {
    const res = await apiFetch('/api/clients', { headers });
    const list = await res.json();
    const arr = Array.isArray(list) ? list : [];
    setClients(arr);
    if (!selectedId && arr.length > 0) setSelectedId(arr[0].id);
  };

  const fetchKeys = async (clientId: string) => {
    if (!clientId) return;
    const res = await apiFetch(`/api/clients/${clientId}/api-keys`, { headers });
    const list = await res.json();
    setKeys(Array.isArray(list) ? list : []);
  };

  useEffect(() => {
    if (!token) { window.location.href = '/login'; return; }
    if (isPortalUser()) { window.location.href = '/dashboard/bookings'; return; }
    fetchClients();
  }, []);

  useEffect(() => {
    setNewKey('');
    setKeys([]);
    fetchKeys(selectedId);
  }, [selectedId]);

  const createKey = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedId || !name.trim()) return;
    const res = await apiFetch(`/api/clients/${selectedId}/api-keys`, {
      method: 'POST', headers, body: JSON.stringify({ name: name.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { toast(data.message || 'Failed to create API key', 'error'); return; }
    setName('');
    setNewKey(data.key);
  };

  const copyKey = async () => {
    try {
      await navigator.clipboard.writeText(newKey);
      toast('Copied', 'success');
    } catch {
      toast('Failed to copy key', 'error');
    }
  };

  const done = () => {
    setNewKey('');
    fetchKeys(selectedId);
  };

  const revoke = async (key: ApiKey) => {
    if (!confirm(`Revoke API key "${key.name}"?`)) return;
    const res = await apiFetch(`/api/clients/${selectedId}/api-keys/${key.id}`, {
      method: 'DELETE', headers,
    });
    const data = await res.json();
    if (!res.ok) { toast(data.message || 'Failed to revoke API key', 'error'); return; }
    toast('API key revoked', 'success');
    fetchKeys(selectedId);
  };

  return <div className="flex flex-col gap-4">
    <Card className="max-w-sm">
      <Select label="Client" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
        <option value="">Select a client</option>
        {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
      </Select>
    </Card>

    {selectedId && <>
      <Card title="Create API key">
        <form onSubmit={createKey} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input label="Key name" placeholder="Production ERP" value={name} onChange={(event) => setName(event.target.value)} />
          <Button type="submit" disabled={!name.trim()}>Create key</Button>
        </form>
      </Card>

      {newKey && <Card title="Your new API key" className="border-brand-indigo">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input value={newKey} readOnly aria-label="New API key" className="font-mono" />
            <Button type="button" variant="outline" onClick={copyKey}>Copy</Button>
          </div>
          <p className="m-0 text-sm text-amber-700">This is the only time the full key is shown — store it securely.</p>
          <div><Button type="button" onClick={done}>Done</Button></div>
        </div>
      </Card>}

      <Card title="API keys">
        {keys.length === 0 ? <EmptyState title="No API keys" hint="Create an API key to send transactional WhatsApp templates." /> :
          <Table><THead><TR><TH>Name</TH><TH>Prefix</TH><TH>Last used</TH><TH>Created</TH><TH>Status</TH><TH /></TR></THead>
            <tbody>{keys.map((key) => <TR key={key.id} className={key.revokedAt ? 'opacity-50' : undefined}>
              <TD>{key.name}</TD>
              <TD><code className="text-xs">{key.prefix}…</code></TD>
              <TD>{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleDateString() : 'Never'}</TD>
              <TD>{new Date(key.createdAt).toLocaleDateString()}</TD>
              <TD><Badge tone={key.revokedAt ? 'gray' : 'teal'}>{key.revokedAt ? 'Revoked' : 'Active'}</Badge></TD>
              <TD>{!key.revokedAt && <Button variant="danger" size="sm" onClick={() => revoke(key)}>Revoke</Button>}</TD>
            </TR>)}</tbody>
          </Table>}
      </Card>
    </>}
  </div>;
}
