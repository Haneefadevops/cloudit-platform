'use client';

import { useEffect, useState } from 'react';

interface Client {
  id: string;
  name: string;
  ordersEnabled?: boolean;
}

type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled';

interface SelectedOption {
  name: string;
  priceDelta: number;
}

interface OrderItem {
  quantity: number;
  unitPrice: number;
  selectedOptions?: SelectedOption[] | null;
  product: { name: string };
}

interface Order {
  id: string;
  type: 'delivery' | 'pickup';
  status: OrderStatus;
  customerName?: string | null;
  address?: string | null;
  phone?: string | null;
  total: number;
  notes?: string | null;
  createdAt: string;
  customer?: { name: string; phoneNumber: string } | null;
  items: OrderItem[];
}

const STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'out_for_delivery',
  'completed',
  'cancelled',
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  out_for_delivery: 'Out for delivery',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<OrderStatus, { color: string; bg: string }> = {
  pending: { color: '#92400e', bg: '#fef3c7' },
  confirmed: { color: '#15803d', bg: '#f0fdf4' },
  preparing: { color: '#c2410c', bg: '#fff7ed' },
  out_for_delivery: { color: '#6d28d9', bg: '#f5f3ff' },
  completed: { color: '#1d4ed8', bg: '#eff6ff' },
  cancelled: { color: '#b91c1c', bg: '#fef2f2' },
};

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

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export default function OrdersPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [message, setMessage] = useState<string | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);

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

  const fetchOrders = async (clientId: string) => {
    if (!clientId) return;
    setLoading(true);
    try {
      const qs = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await fetch(`/api/orders/${clientId}/orders${qs}`, {
        headers,
      });
      const list = await res.json();
      setOrders(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
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
    fetchOrders(selectedId);
  }, [selectedId, statusFilter]);

  const updateStatus = async (order: Order, status: OrderStatus) => {
    if (!selectedId) return;
    const res = await fetch(`/api/orders/${selectedId}/orders/${order.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) {
      showInfo(data.message || 'Failed to update order');
      return;
    }
    showInfo(`Order ${STATUS_LABELS[status].toLowerCase()}`);
    fetchOrders(selectedId);
  };

  const handleAction = (order: Order, status: OrderStatus) => {
    if (status === 'cancelled') {
      if (
        !confirm('Cancel this order? The customer will be notified on WhatsApp.')
      )
        return;
    }
    updateStatus(order, status);
  };

  const itemLineTotal = (item: OrderItem) => {
    const optionsDelta = (item.selectedOptions || []).reduce(
      (sum, o) => sum + (Number(o.priceDelta) || 0),
      0,
    );
    return (Number(item.unitPrice) + optionsDelta) * item.quantity;
  };

  const renderActions = (order: Order) => {
    const buttons: { label: string; status: OrderStatus; color: string }[] = [];
    if (order.status === 'pending') {
      buttons.push({ label: 'Confirm', status: 'confirmed', color: '#16a34a' });
    } else if (order.status === 'confirmed') {
      buttons.push({ label: 'Preparing', status: 'preparing', color: '#c2410c' });
    } else if (order.status === 'preparing') {
      if (order.type === 'delivery') {
        buttons.push({
          label: 'Out for delivery',
          status: 'out_for_delivery',
          color: '#7c3aed',
        });
      } else {
        buttons.push({
          label: 'Complete',
          status: 'completed',
          color: '#2563eb',
        });
      }
    } else if (order.status === 'out_for_delivery') {
      buttons.push({ label: 'Complete', status: 'completed', color: '#2563eb' });
    }
    if (
      order.status === 'pending' ||
      order.status === 'confirmed' ||
      order.status === 'preparing'
    ) {
      buttons.push({ label: 'Cancel', status: 'cancelled', color: '#dc2626' });
    }
    if (buttons.length === 0) return null;
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {buttons.map((b) => (
          <button
            key={b.status}
            onClick={() => handleAction(order, b.status)}
            style={buttonStyle(b.color)}
          >
            {b.label}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div>
      <h1>Orders</h1>
      <p style={{ color: '#6b7280', fontSize: 14 }}>
        View and manage orders per client. Changing an order&apos;s status
        automatically messages the customer on WhatsApp.
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
          <div
            style={{
              marginTop: 16,
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            {(['all', ...STATUSES] as string[]).map((s) => {
              const active = statusFilter === s;
              const label =
                s === 'all' ? 'All' : STATUS_LABELS[s as OrderStatus];
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 16,
                    border: active ? '1px solid #2563eb' : '1px solid #d1d5db',
                    background: active ? '#eff6ff' : 'white',
                    color: active ? '#1d4ed8' : '#374151',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div style={cardStyle}>
            {loading ? (
              <div style={{ color: '#6b7280' }}>Loading…</div>
            ) : orders.length === 0 ? (
              <div style={{ color: '#6b7280' }}>No orders found</div>
            ) : (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                {orders.map((order) => {
                  const colors = STATUS_COLORS[order.status];
                  return (
                    <div
                      key={order.id}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        padding: 12,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          flexWrap: 'wrap',
                          gap: 8,
                        }}
                      >
                        <div>
                          <strong>#{order.id.slice(0, 8)}</strong>{' '}
                          <span style={badgeStyle(colors.color, colors.bg)}>
                            {STATUS_LABELS[order.status]}
                          </span>{' '}
                          <span
                            style={badgeStyle('#374151', '#f3f4f6')}
                          >
                            {order.type}
                          </span>
                          <div style={{ fontSize: 13, color: '#374151', marginTop: 4 }}>
                            {order.customer?.name || order.customerName || '—'}
                            {' • '}
                            {order.customer?.phoneNumber || order.phone || '—'}
                          </div>
                          {order.type === 'delivery' && order.address && (
                            <div style={{ fontSize: 13, color: '#6b7280' }}>
                              {order.address}
                            </div>
                          )}
                          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                            {formatTime(order.createdAt)}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 16, fontWeight: 700 }}>
                            ${Number(order.total).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: 8,
                          borderTop: '1px solid #f3f4f6',
                          paddingTop: 8,
                          fontSize: 13,
                        }}
                      >
                        {order.items.map((item, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: 8,
                              padding: '2px 0',
                            }}
                          >
                            <span>
                              {item.quantity}× {item.product?.name}
                              {item.selectedOptions &&
                                item.selectedOptions.length > 0 && (
                                  <span style={{ color: '#6b7280' }}>
                                    {' '}
                                    (
                                    {item.selectedOptions
                                      .map((o) => o.name)
                                      .join(', ')}
                                    )
                                  </span>
                                )}
                            </span>
                            <span>${itemLineTotal(item).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>

                      {order.notes && (
                        <div
                          style={{
                            marginTop: 8,
                            fontSize: 13,
                            color: '#374151',
                          }}
                        >
                          <strong>Notes:</strong> {order.notes}
                        </div>
                      )}

                      <div style={{ marginTop: 8 }}>{renderActions(order)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
