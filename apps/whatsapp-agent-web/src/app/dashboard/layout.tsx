'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [showServices, setShowServices] = useState(true);
  const [showOrders, setShowOrders] = useState(true);

  useEffect(() => {
    const token =
      (typeof window !== 'undefined' && localStorage.getItem('token')) || '';
    if (!token) return;
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

  const nav = [
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

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        style={{
          width: 220,
          background: '#111827',
          color: 'white',
          padding: 20,
        }}
      >
        <h1 style={{ fontSize: 18, marginBottom: 24 }}>TheReplyte</h1>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
      </aside>
      <main style={{ flex: 1, padding: 24, background: '#f3f4f6' }}>
        {children}
      </main>
    </div>
  );
}
