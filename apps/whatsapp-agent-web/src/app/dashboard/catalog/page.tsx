'use client';

import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  StatusBadge,
  Table,
  TD,
  TH,
  THead,
  TR,
  useToast,
} from '@/components/ui';
import { isPortalUser } from '../portal';
import { apiFetch } from '@/lib/api';

interface Client {
  id: string;
  name: string;
  ordersEnabled?: boolean;
}

interface ProductOption {
  name: string;
  priceDelta: number;
}

interface Product {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  category?: string | null;
  available: boolean;
  active: boolean;
  options?: ProductOption[] | null;
}

const emptyOption = (): ProductOption => ({ name: '', priceDelta: 0 });

const emptyForm = () => ({
  name: '',
  description: '',
  price: '',
  category: '',
  available: true,
  active: true,
  options: [] as ProductOption[],
});

export default function CatalogPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');

  const [products, setProducts] = useState<Product[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());

  const toast = useToast();

  const token =
    (typeof window !== 'undefined' && localStorage.getItem('token')) || '';

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const fetchClients = async () => {
    const res = await apiFetch('/api/clients', { headers });
    const list = await res.json();
    const arr = Array.isArray(list) ? list : [];
    setClients(arr);
    if (!selectedId && arr.length > 0) setSelectedId(arr[0].id);
  };

  const fetchProducts = async (clientId: string) => {
    if (!clientId) return;
    const res = await apiFetch(`/api/orders/${clientId}/products`, { headers });
    const list = await res.json();
    setProducts(Array.isArray(list) ? list : []);
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
    setForm(emptyForm());
    setCategoryFilter('all');
    fetchProducts(selectedId);
  }, [selectedId]);

  const categories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean)),
  ) as string[];

  const visibleProducts =
    categoryFilter === 'all'
      ? products
      : products.filter((p) => (p.category || '') === categoryFilter);

  const optionsSummary = (options?: ProductOption[] | null) => {
    if (!options || options.length === 0) return '—';
    return options
      .map(
        (o) =>
          `${o.name}${o.priceDelta ? ` (+$${Number(o.priceDelta).toFixed(2)})` : ''}`,
      )
      .join(', ');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;

    const payload = {
      name: form.name,
      description: form.description || null,
      price: Number(form.price) || 0,
      category: form.category || null,
      available: form.available,
      active: form.active,
      options: form.options
        .filter((o) => o.name.trim() !== '')
        .map((o) => ({ name: o.name.trim(), priceDelta: Number(o.priceDelta) || 0 })),
    };

    const url = editingId
      ? `/api/orders/${selectedId}/products/${editingId}`
      : `/api/orders/${selectedId}/products`;
    const res = await apiFetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.message || 'Failed to save product', 'error');
      return;
    }
    toast(editingId ? 'Product updated' : 'Product created', 'success');
    setEditingId(null);
    setForm(emptyForm());
    fetchProducts(selectedId);
  };

  const handleEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description || '',
      price: String(p.price),
      category: p.category || '',
      available: p.available,
      active: p.active,
      options: (p.options || []).map((o) => ({
        name: o.name,
        priceDelta: Number(o.priceDelta) || 0,
      })),
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    await apiFetch(`/api/orders/${selectedId}/products/${id}`, {
      method: 'DELETE',
      headers,
    });
    fetchProducts(selectedId);
  };

  const setOption = (index: number, patch: Partial<ProductOption>) => {
    const options = form.options.map((o, i) =>
      i === index ? { ...o, ...patch } : o,
    );
    setForm({ ...form, options });
  };

  return (
    <div className="space-y-4">
      <p className="m-0 text-sm text-muted">
        Products per client. These power the orders module menu that customers
        see on WhatsApp.
      </p>

      <Card>
        <div className="max-w-xs">
          <Select
            label="Client"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">Select a client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.ordersEnabled ? '' : ' (orders disabled)'}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {selectedId && (
        <>
          <Card>
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr]">
                <Input
                  placeholder="Product name (e.g. Chicken Kottu)"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
                <Input
                  placeholder="Price"
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  required
                />
                <Input
                  placeholder="Category (e.g. Mains)"
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                />
              </div>
              <Input
                placeholder="Description (optional)"
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />

              <div>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">Options</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setForm({
                        ...form,
                        options: [...form.options, emptyOption()],
                      })
                    }
                  >
                    Add Option
                  </Button>
                </div>
                {form.options.length === 0 ? (
                  <div className="text-sm text-muted">
                    No options — add sizes, extras, etc.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {form.options.map((o, i) => (
                      <div
                        key={i}
                        className="flex flex-col gap-2 sm:flex-row sm:items-center"
                      >
                        <Input
                          className="sm:flex-[2]"
                          placeholder="Option name (e.g. Large)"
                          value={o.name}
                          onChange={(e) =>
                            setOption(i, { name: e.target.value })
                          }
                        />
                        <Input
                          className="sm:flex-1"
                          placeholder="Price delta"
                          type="number"
                          step="0.01"
                          value={o.priceDelta}
                          onChange={(e) =>
                            setOption(i, {
                              priceDelta: Number(e.target.value),
                            })
                          }
                        />
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          className="shrink-0"
                          onClick={() =>
                            setForm({
                              ...form,
                              options: form.options.filter((_, j) => j !== i),
                            })
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="accent-brand-indigo"
                    checked={form.available}
                    onChange={(e) =>
                      setForm({ ...form, available: e.target.checked })
                    }
                  />
                  Available (uncheck when sold out)
                </label>
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="accent-brand-indigo"
                    checked={form.active}
                    onChange={(e) =>
                      setForm({ ...form, active: e.target.checked })
                    }
                  />
                  Active
                </label>
              </div>
              <div className="flex gap-2">
                <Button type="submit">
                  {editingId ? 'Update Product' : 'Add Product'}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setForm(emptyForm());
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </Card>

          <Card>
            <div className="max-w-xs">
              <Select
                label="Category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </div>
          </Card>

          {visibleProducts.length === 0 ? (
            <EmptyState title="No products found" />
          ) : (
            <Card className="p-0">
              <Table>
                <THead>
                  <TR>
                    <TH>Name</TH>
                    <TH>Category</TH>
                    <TH>Price</TH>
                    <TH>Options</TH>
                    <TH>Flags</TH>
                    <TH>Actions</TH>
                  </TR>
                </THead>
                <tbody>
                  {visibleProducts.map((p) => (
                    <TR key={p.id}>
                      <TD>
                        {p.name}
                        {p.description && (
                          <div className="text-xs text-muted">
                            {p.description}
                          </div>
                        )}
                      </TD>
                      <TD>{p.category || '—'}</TD>
                      <TD>${Number(p.price).toFixed(2)}</TD>
                      <TD className="text-[13px] text-gray-700">
                        {optionsSummary(p.options)}
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge tone={p.available ? 'green' : 'red'}>
                            {p.available ? 'available' : 'sold out'}
                          </Badge>
                          <StatusBadge
                            status={p.active ? 'active' : 'inactive'}
                          />
                        </div>
                      </TD>
                      <TD>
                        <div className="flex gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(p)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(p.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
