'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const nav = [
    { href: '/dashboard/conversations', label: 'Conversations' },
    { href: '/dashboard/clients', label: 'Clients' },
    { href: '/dashboard/ai-settings', label: 'AI Settings' },
    { href: '/dashboard/analytics', label: 'Analytics' },
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
