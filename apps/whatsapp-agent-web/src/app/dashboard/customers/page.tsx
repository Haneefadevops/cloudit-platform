'use client';

import { useEffect, useState } from 'react';
import { Badge, Button, Card, EmptyState, Input, Select, Table, TD, TH, THead, TR, useToast } from '@/components/ui';
import { isPortalUser } from '../portal';
import { apiFetch } from '@/lib/api';

interface Client { id: string; name: string }
interface Category { id: string; name: string; description?: string | null; color?: string | null }
interface Customer {
  id: string; phoneNumber: string; name?: string | null; email?: string | null;
  leadSource?: string | null; categoryId?: string | null; category?: Category | null; createdAt: string;
}

export default function CustomersPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categoryForm, setCategoryForm] = useState({ name: '', color: '', description: '' });
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

  const fetchCategories = async (clientId: string) => {
    if (!clientId) return;
    const res = await apiFetch(`/api/categories/${clientId}`, { headers });
    const list = await res.json();
    setCategories(Array.isArray(list) ? list : []);
  };

  const fetchCustomers = async (clientId: string, categoryId = '') => {
    if (!clientId) return;
    const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : '';
    const res = await apiFetch(`/api/customers/${clientId}${query}`, { headers });
    const list = await res.json();
    setCustomers(Array.isArray(list) ? list : []);
  };

  useEffect(() => {
    if (!token) { window.location.href = '/login'; return; }
    if (isPortalUser()) { window.location.href = '/dashboard/bookings'; return; }
    fetchClients();
  }, []);

  useEffect(() => {
    setCategoryFilter('');
    setCustomers([]);
    fetchCategories(selectedId);
    fetchCustomers(selectedId);
  }, [selectedId]);

  useEffect(() => { fetchCustomers(selectedId, categoryFilter); }, [categoryFilter]);

  const createCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    const res = await apiFetch(`/api/categories/${selectedId}`, {
      method: 'POST', headers, body: JSON.stringify({
        name: categoryForm.name,
        color: categoryForm.color || undefined,
        description: categoryForm.description || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) { toast(data.message || 'Failed to create category', 'error'); return; }
    toast('Category created', 'success');
    setCategoryForm({ name: '', color: '', description: '' });
    fetchCategories(selectedId);
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    const res = await apiFetch(`/api/categories/${selectedId}/${id}`, { method: 'DELETE', headers });
    if (!res.ok) { toast('Failed to delete category', 'error'); return; }
    toast('Category deleted', 'success');
    if (categoryFilter === id) setCategoryFilter('');
    fetchCategories(selectedId);
    fetchCustomers(selectedId, categoryFilter === id ? '' : categoryFilter);
  };

  const assignCategory = async (customerId: string, categoryId: string) => {
    const res = await apiFetch(`/api/customers/${selectedId}/${customerId}/category`, {
      method: 'PUT', headers, body: JSON.stringify({ categoryId: categoryId || null }),
    });
    const data = await res.json();
    if (!res.ok) { toast(data.message || 'Failed to update customer category', 'error'); return; }
    setCustomers((rows) => rows.map((customer) => customer.id === customerId ? data : customer));
    toast('Customer category updated', 'success');
  };

  return <div className="flex flex-col gap-4">
    <Card className="max-w-sm">
      <Select label="Client" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
        <option value="">Select a client</option>
        {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
      </Select>
    </Card>

    {selectedId && <>
      <Card title="Customer Categories">
        <div className="flex flex-wrap gap-2">
          {categories.length === 0 ? <span className="text-sm text-muted">No categories yet.</span> : categories.map((category) =>
            <span key={category.id} className="inline-flex items-center gap-1.5 rounded-full bg-page py-1 pl-2 pr-1 text-xs font-medium text-brand-navy">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: category.color || '#94a3b8' }} />
              {category.name}<button type="button" className="rounded-full px-1 text-muted hover:bg-white hover:text-red-600" aria-label={`Delete ${category.name}`} onClick={() => deleteCategory(category.id)}>×</button>
            </span>,
          )}
        </div>
        <form onSubmit={createCategory} className="mt-4 grid gap-2 sm:grid-cols-4">
          <Input placeholder="Category name" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} required />
          <Input placeholder="Hex color (optional)" value={categoryForm.color} onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })} />
          <Input placeholder="Description (optional)" value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} />
          <Button type="submit">Add Category</Button>
        </form>
      </Card>

      <Card title="Customers">
        <div className="mb-4 max-w-xs"><Select label="Category filter" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">All</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </Select></div>
        {customers.length === 0 ? <EmptyState title="No customers yet" hint="Customers will appear here when they message a client." /> :
          <Table><THead><TR><TH>Name</TH><TH>Phone</TH><TH>Category</TH><TH>Lead source</TH><TH>Created</TH></TR></THead>
            <tbody>{customers.map((customer) => <TR key={customer.id}>
              <TD>{customer.name || '—'}{customer.email && <div className="text-xs text-muted">{customer.email}</div>}</TD>
              <TD>{customer.phoneNumber}</TD>
              <TD><Select value={customer.categoryId || ''} onChange={(e) => assignCategory(customer.id, e.target.value)} className="min-w-[150px]">
                <option value="">—</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </Select></TD>
              <TD>{customer.leadSource === 'ctwa_ad' ? <Badge tone="teal">WhatsApp ad</Badge> : <span className="text-muted">Organic/unknown</span>}</TD>
              <TD>{new Date(customer.createdAt).toLocaleDateString()}</TD>
            </TR>)}</tbody>
          </Table>}
      </Card>
    </>}
  </div>;
}
