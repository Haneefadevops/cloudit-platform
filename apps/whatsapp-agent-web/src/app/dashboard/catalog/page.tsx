'use client';

import { useEffect, useState } from 'react';

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

const cardStyle: React.CSSProperties = {
  marginTop: 16,
  background: 'white',
  padding: 16,
  borderRadius: 8,
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
};

const badgeStyle = (color: string, bg: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 600,
  color,
  background: bg,
});

export default function CatalogPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm());

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

  const fetchProducts = async (clientId: string) => {
    if (!clientId) return;
    const res = await fetch(`/api/orders/${clientId}/products`, { headers });
    const list = await res.json();
    setProducts(Array.isArray(list) ? list : []);
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
    const res = await fetch(url, {
      method: editingId ? 'PUT' : 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      showInfo(data.message || 'Failed to save product');
      return;
    }
    showInfo(editingId ? 'Product updated' : 'Product created');
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
    await fetch(`/api/orders/${selectedId}/products/${id}`, {
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
    <div>
      <h1>Catalog</h1>
      <p style={{ color: '#6b7280', fontSize: 14 }}>
        Products per client. These power the orders module menu that customers
        see on WhatsApp.
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
              {c.ordersEnabled ? '' : ' (orders disabled)'}
            </option>
          ))}
        </select>
      </div>

      {selectedId && (
        <>
          <form
            onSubmit={handleSubmit}
            style={{
              ...cardStyle,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                placeholder="Product name (e.g. Chicken Kottu)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                style={{ ...inputStyle, flex: 2 }}
              />
              <input
                placeholder="Price"
                type="number"
                min={0}
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                placeholder="Category (e.g. Mains)"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>
            <input
              placeholder="Description (optional)"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              style={inputStyle}
            />

            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 600 }}>Options</span>
                <button
                  type="button"
                  onClick={() =>
                    setForm({ ...form, options: [...form.options, emptyOption()] })
                  }
                  style={buttonStyle('#2563eb')}
                >
                  Add Option
                </button>
              </div>
              {form.options.length === 0 ? (
                <div style={{ fontSize: 13, color: '#9ca3af' }}>
                  No options — add sizes, extras, etc.
                </div>
              ) : (
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
                >
                  {form.options.map((o, i) => (
                    <div
                      key={i}
                      style={{ display: 'flex', gap: 8, alignItems: 'center' }}
                    >
                      <input
                        placeholder="Option name (e.g. Large)"
                        value={o.name}
                        onChange={(e) =>
                          setOption(i, { name: e.target.value })
                        }
                        style={{ ...inputStyle, flex: 2 }}
                      />
                      <input
                        placeholder="Price delta"
                        type="number"
                        step="0.01"
                        value={o.priceDelta}
                        onChange={(e) =>
                          setOption(i, { priceDelta: Number(e.target.value) })
                        }
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            options: form.options.filter((_, j) => j !== i),
                          })
                        }
                        style={buttonStyle('#dc2626')}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 16, fontSize: 14 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={form.available}
                  onChange={(e) =>
                    setForm({ ...form, available: e.target.checked })
                  }
                />
                Available (uncheck when sold out)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm({ ...form, active: e.target.checked })
                  }
                />
                Active
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" style={buttonStyle('#16a34a')}>
                {editingId ? 'Update Product' : 'Add Product'}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setForm(emptyForm());
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
              ...cardStyle,
              display: 'flex',
              gap: 16,
              alignItems: 'flex-end',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ width: 220 }}>
              <label style={{ fontSize: 13, fontWeight: 600 }}>Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                style={{ ...inputStyle, marginTop: 4 }}
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={cardStyle}>
            {visibleProducts.length === 0 ? (
              <div style={{ color: '#6b7280' }}>No products found</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr
                    style={{ textAlign: 'left', color: '#6b7280', fontSize: 13 }}
                  >
                    <th style={{ paddingBottom: 8 }}>Name</th>
                    <th style={{ paddingBottom: 8 }}>Category</th>
                    <th style={{ paddingBottom: 8 }}>Price</th>
                    <th style={{ paddingBottom: 8 }}>Options</th>
                    <th style={{ paddingBottom: 8 }}>Flags</th>
                    <th style={{ paddingBottom: 8 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.map((p) => (
                    <tr key={p.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 8px 10px 0' }}>
                        {p.name}
                        {p.description && (
                          <div style={{ fontSize: 12, color: '#6b7280' }}>
                            {p.description}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 8px 10px 0' }}>
                        {p.category || '—'}
                      </td>
                      <td style={{ padding: '10px 8px 10px 0' }}>
                        ${Number(p.price).toFixed(2)}
                      </td>
                      <td
                        style={{
                          padding: '10px 8px 10px 0',
                          fontSize: 13,
                          color: '#374151',
                        }}
                      >
                        {optionsSummary(p.options)}
                      </td>
                      <td style={{ padding: '10px 8px 10px 0' }}>
                        <div
                          style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
                        >
                          <span
                            style={badgeStyle(
                              p.available ? '#15803d' : '#b91c1c',
                              p.available ? '#f0fdf4' : '#fef2f2',
                            )}
                          >
                            {p.available ? 'available' : 'sold out'}
                          </span>
                          <span
                            style={badgeStyle(
                              p.active ? '#15803d' : '#6b7280',
                              p.active ? '#f0fdf4' : '#f3f4f6',
                            )}
                          >
                            {p.active ? 'active' : 'inactive'}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 0' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => handleEdit(p)}
                            style={buttonStyle('#2563eb')}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(p.id)}
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
