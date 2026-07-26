'use client';

import { useEffect, useState } from 'react';
import { getStoredUser, isPortalUser } from '../portal';
import { apiFetch } from '@/lib/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageLoading,
  Select,
  StatusBadge,
  cx,
  useToast,
} from '@/components/ui';

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

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export default function OrdersPage() {
  const toast = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');

  const [orders, setOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [portal, setPortal] = useState(false);

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

  const fetchOrders = async (clientId: string) => {
    if (!clientId) return;
    setLoading(true);
    try {
      const qs = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await apiFetch(`/api/orders/${clientId}/orders${qs}`, {
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
    const user = getStoredUser();
    if (isPortalUser(user)) {
      setPortal(true);
      if (user?.clientId) setSelectedId(user.clientId);
      return;
    }
    fetchClients();
  }, []);

  useEffect(() => {
    fetchOrders(selectedId);
  }, [selectedId, statusFilter]);

  const updateStatus = async (order: Order, status: OrderStatus) => {
    if (!selectedId) return;
    const res = await apiFetch(`/api/orders/${selectedId}/orders/${order.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast(data.message || 'Failed to update order', 'error');
      return;
    }
    toast(`Order ${STATUS_LABELS[status].toLowerCase()}`, 'success');
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
    const buttons: { label: string; status: OrderStatus }[] = [];
    if (order.status === 'pending') {
      buttons.push({ label: 'Confirm', status: 'confirmed' });
    } else if (order.status === 'confirmed') {
      buttons.push({ label: 'Preparing', status: 'preparing' });
    } else if (order.status === 'preparing') {
      if (order.type === 'delivery') {
        buttons.push({
          label: 'Out for delivery',
          status: 'out_for_delivery',
        });
      } else {
        buttons.push({
          label: 'Complete',
          status: 'completed',
        });
      }
    } else if (order.status === 'out_for_delivery') {
      buttons.push({ label: 'Complete', status: 'completed' });
    }
    if (
      order.status === 'pending' ||
      order.status === 'confirmed' ||
      order.status === 'preparing'
    ) {
      buttons.push({ label: 'Cancel', status: 'cancelled' });
    }
    if (buttons.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1.5">
        {buttons.map((b) => (
          <Button
            key={b.status}
            size="sm"
            variant={b.status === 'cancelled' ? 'danger' : 'primary'}
            onClick={() => handleAction(order, b.status)}
          >
            {b.label}
          </Button>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="m-0 text-sm text-muted">
        View and manage orders per client. Changing an order&apos;s status
        automatically messages the customer on WhatsApp.
      </p>

      {!portal && (
        <div className="w-full max-w-xs">
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
      )}

      {selectedId && (
        <>
          <div className="flex flex-wrap gap-2">
            {(['all', ...STATUSES] as string[]).map((s) => {
              const active = statusFilter === s;
              const label =
                s === 'all' ? 'All' : STATUS_LABELS[s as OrderStatus];
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cx(
                    'rounded-full border px-3.5 py-1.5 text-[13px] transition-colors',
                    active
                      ? 'border-brand-indigo bg-indigo-50 font-semibold text-brand-indigo'
                      : 'border-line bg-white text-brand-navy hover:bg-page',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <Card>
            {loading ? (
              <PageLoading />
            ) : orders.length === 0 ? (
              <EmptyState title="No orders found" />
            ) : (
              <div className="flex flex-col gap-3">
                {orders.map((order) => {
                  return (
                    <div
                      key={order.id}
                      className="rounded-lg border border-line p-3"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <strong className="text-brand-navy">
                              #{order.id.slice(0, 8)}
                            </strong>
                            <StatusBadge status={order.status} />
                            <Badge tone="gray" className="capitalize">
                              {order.type}
                            </Badge>
                          </div>
                          <div className="mt-1 text-[13px] text-brand-navy">
                            {order.customer?.name || order.customerName || '—'}
                            {' • '}
                            {order.customer?.phoneNumber || order.phone || '—'}
                          </div>
                          {order.type === 'delivery' && order.address && (
                            <div className="text-[13px] text-muted">
                              {order.address}
                            </div>
                          )}
                          <div className="mt-0.5 text-xs text-muted">
                            {formatTime(order.createdAt)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-base font-bold text-brand-navy">
                            ${Number(order.total).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 border-t border-line pt-2 text-[13px]">
                        {order.items.map((item, i) => (
                          <div
                            key={i}
                            className="flex justify-between gap-2 py-0.5"
                          >
                            <span>
                              {item.quantity}× {item.product?.name}
                              {item.selectedOptions &&
                                item.selectedOptions.length > 0 && (
                                  <span className="text-muted">
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
                        <div className="mt-2 text-[13px] text-brand-navy">
                          <strong>Notes:</strong> {order.notes}
                        </div>
                      )}

                      <div className="mt-2">{renderActions(order)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
