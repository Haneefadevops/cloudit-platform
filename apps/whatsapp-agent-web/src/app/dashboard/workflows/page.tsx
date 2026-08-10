'use client';

import { useEffect, useState } from 'react';
import {
  Badge,
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
import { apiFetch } from '@/lib/api';

interface Client { id: string; name: string }
interface Category { id: string; name: string; color?: string | null }
interface Workflow {
  id: string; name: string; trigger: string; instructions: string; description?: string | null;
  collectFields?: string[] | null; endAction: string; categoryId?: string | null;
  category?: Category | null; isActive: boolean; priority: number;
}

const emptyForm = {
  name: '', trigger: '', instructions: '', description: '', collectFields: '',
  endAction: 'handoff', categoryId: '', priority: '0', isActive: 'true',
};

export default function WorkflowsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
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

  const fetchData = async (clientId: string) => {
    if (!clientId) return;
    const [workflowRes, categoryRes] = await Promise.all([
      apiFetch(`/api/workflows/${clientId}`, { headers }),
      apiFetch(`/api/categories/${clientId}`, { headers }),
    ]);
    const [workflowList, categoryList] = await Promise.all([workflowRes.json(), categoryRes.json()]);
    setWorkflows(Array.isArray(workflowList) ? workflowList : []);
    setCategories(Array.isArray(categoryList) ? categoryList : []);
  };

  useEffect(() => {
    if (!token) { window.location.href = '/login'; return; }
    if (isPortalUser()) { window.location.href = '/dashboard/bookings'; return; }
    fetchClients();
  }, []);

  useEffect(() => {
    setEditingId(null);
    setForm(emptyForm);
    fetchData(selectedId);
  }, [selectedId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    const payload = {
      name: form.name,
      trigger: form.trigger,
      instructions: form.instructions,
      description: form.description || undefined,
      collectFields: form.collectFields.split('\n').map((field) => field.trim()).filter(Boolean),
      endAction: form.endAction,
      categoryId: form.categoryId || undefined,
      priority: Number(form.priority) || 0,
      isActive: form.isActive === 'true',
    };
    const res = await apiFetch(
      editingId ? `/api/workflows/${selectedId}/${editingId}` : `/api/workflows/${selectedId}`,
      { method: editingId ? 'PUT' : 'POST', headers, body: JSON.stringify(payload) },
    );
    const data = await res.json();
    if (!res.ok) { toast(data.message || 'Failed to save workflow', 'error'); return; }
    toast(editingId ? 'Workflow updated' : 'Workflow created', 'success');
    setEditingId(null);
    setForm(emptyForm);
    fetchData(selectedId);
  };

  const handleEdit = (workflow: Workflow) => {
    setEditingId(workflow.id);
    setForm({
      name: workflow.name, trigger: workflow.trigger, instructions: workflow.instructions,
      description: workflow.description || '', collectFields: (workflow.collectFields || []).join('\n'),
      endAction: workflow.endAction, categoryId: workflow.categoryId || '',
      priority: String(workflow.priority), isActive: String(workflow.isActive),
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this workflow?')) return;
    const res = await apiFetch(`/api/workflows/${selectedId}/${id}`, { method: 'DELETE', headers });
    if (!res.ok) { toast('Failed to delete workflow', 'error'); return; }
    toast('Workflow deleted', 'success');
    fetchData(selectedId);
  };

  return <div className="flex flex-col gap-4">
    <Card className="max-w-sm">
      <Select label="Client" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
        <option value="">Select a client</option>
        {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
      </Select>
    </Card>

    {selectedId && <>
      <Card title={editingId ? 'Edit Workflow' : 'Add Workflow'}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input placeholder="Workflow name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Textarea placeholder="When should the AI start this workflow? e.g. Customer asks about visa services" value={form.trigger} onChange={(e) => setForm({ ...form, trigger: e.target.value })} required rows={3} className="resize-y" />
          <Textarea placeholder="Steps the AI should follow, in plain language" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} required rows={4} className="resize-y" />
          <Input placeholder="Description (optional)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Textarea placeholder="Fields to collect, one per line (optional)" value={form.collectFields} onChange={(e) => setForm({ ...form, collectFields: e.target.value })} rows={3} className="resize-y" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Select label="End action" value={form.endAction} onChange={(e) => setForm({ ...form, endAction: e.target.value })}>
              <option value="handoff">Handoff</option><option value="booking">Booking</option><option value="order">Order</option><option value="none">None</option>
            </Select>
            <Select label="Category" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">— none —</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </Select>
            <Input label="Priority" type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
            <Select label="Status" value={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.value })}>
              <option value="true">Active</option><option value="false">Inactive</option>
            </Select>
          </div>
          <div className="flex gap-2"><Button type="submit">{editingId ? 'Update Workflow' : 'Add Workflow'}</Button>
            {editingId && <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel</Button>}
          </div>
        </form>
      </Card>

      <Card title="Workflows">
        {workflows.length === 0 ? <EmptyState title="No workflows yet" hint="Add a workflow above to guide AI conversations." /> :
          <Table><THead><TR><TH>Name</TH><TH>Trigger</TH><TH>Category</TH><TH>End action</TH><TH>Priority</TH><TH>Status</TH><TH>Actions</TH></TR></THead>
            <tbody>{workflows.map((workflow) => <TR key={workflow.id}>
              <TD className="font-medium">{workflow.name}</TD><TD className="max-w-[260px] overflow-hidden text-ellipsis whitespace-nowrap">{workflow.trigger}</TD>
              <TD>{workflow.category ? <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: workflow.category.color || '#94a3b8' }} /><Badge>{workflow.category.name}</Badge></span> : '—'}</TD>
              <TD><Badge tone="navy">{workflow.endAction}</Badge></TD><TD>{workflow.priority}</TD><TD><Badge tone={workflow.isActive ? 'teal' : 'gray'}>{workflow.isActive ? 'Active' : 'Inactive'}</Badge></TD>
              <TD><div className="flex gap-1.5"><Button size="sm" variant="outline" onClick={() => handleEdit(workflow)}>Edit</Button><Button size="sm" variant="danger" onClick={() => handleDelete(workflow.id)}>Delete</Button></div></TD>
            </TR>)}</tbody>
          </Table>}
      </Card>
    </>}
  </div>;
}
