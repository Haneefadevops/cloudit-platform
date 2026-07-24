'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  getStoredUser,
  isPortalUser,
  StoredUser,
} from './portal';

interface PortalClient {
  id: string;
  name: string;
  bookingsEnabled?: boolean;
  ordersEnabled?: boolean;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [portalClient, setPortalClient] = useState<PortalClient | null>(null);
  const [showServices, setShowServices] = useState(true);
  const [showOrders, setShowOrders] = useState(true);

  useEffect(() => {
    const token =
      (typeof window !== 'undefined' && localStorage.getItem('token')) || '';
    if (!token) return;
    const stored = getStoredUser();
    setUser(stored);
    if (isPortalUser(stored)) {
      fetch('/api/clients/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((me) => {
          setPortalClient(me);
          if (me) {
            setShowServices(!!me.bookingsEnabled);
            setShowOrders(!!me.ordersEnabled);
          }
          // On failure keep the safe default: all portal links shown
        })
        .catch(() => {
          // Fail silently to showing the links
        });
      return;
    }
    fetch('/api/clients', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((list) => {
        if (!Array.isArray(list)) return;
        setShowServices(list.some((c) => c.bookingsEnabled));
        setShowOrders(list.some((c) => c.ordersEnabled));
      })
      .catch(() => {
        // Fail silently to showing the link
      });
  }, []);

  const portal = isPortalUser(user);

  const nav = portal
    ? [
        ...(showServices
          ? [{ href: '/dashboard/bookings', label: 'Bookings' }]
          : []),
        ...(showOrders ? [{ href: '/dashboard/orders', label: 'Orders' }] : []),
        { href: '/dashboard/analytics', label: 'Analytics' },
      ]
    : [
        { href: '/dashboard/clients', label: 'Clients' },
        { href: '/dashboard/ai-settings', label: 'AI Settings' },
        { href: '/dashboard/knowledge-base', label: 'Knowledge Base' },
        { href: '/dashboard/canned-responses', label: 'Canned Responses' },
        ...(showServices
          ? [
              { href: '/dashboard/services', label: 'Services' },
              { href: '/dashboard/bookings', label: 'Bookings' },
            ]
          : []),
        ...(showOrders
          ? [
              { href: '/dashboard/catalog', label: 'Catalog' },
              { href: '/dashboard/orders', label: 'Orders' },
            ]
          : []),
        { href: '/dashboard/analytics', label: 'Analytics' },
        { href: '/dashboard/playground', label: 'Playground' },
      ];

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 220,
          background: '#111827',
          color: 'white',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h1 style={{ fontSize: 18, marginBottom: 24 }}>TheReplyte</h1>
        {portal && portalClient && (
          <div
            style={{
              fontSize: 13,
              color: '#9ca3af',
              marginTop: -16,
              marginBottom: 20,
            }}
          >
            {portalClient.name}
          </div>
        )}
        <nav
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            flex: 1,
          }}
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                color: pathname.startsWith(item.href) ? '#60a5fa' : 'white',
                textDecoration: 'none',
                fontWeight: pathname.startsWith(item.href) ? 600 : 400,
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={logout}
          style={{
            marginTop: 24,
            padding: '8px 12px',
            background: 'transparent',
            color: '#9ca3af',
            border: '1px solid #374151',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Logout
        </button>
      </aside>
      <main style={{ flex: 1, padding: 24, background: '#f3f4f6' }}>
        {children}
      </main>
    </div>
  );
}
