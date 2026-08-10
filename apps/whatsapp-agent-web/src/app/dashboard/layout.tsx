'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getStoredUser, isPortalUser, StoredUser } from './portal';
import { ToastProvider } from '@/components/ui';
import { apiFetch } from '@/lib/api';

interface PortalClient {
  id: string;
  name: string;
  bookingsEnabled?: boolean;
  ordersEnabled?: boolean;
}

function NavIcon({ href }: { href: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;
  switch (href) {
    case '/dashboard/clients':
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case '/dashboard/ai-settings':
      return (
        <svg {...common}>
          <path d="M12 8V4H8" />
          <rect width="16" height="12" x="4" y="8" rx="2" />
          <path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
        </svg>
      );
    case '/dashboard/knowledge-base':
      return (
        <svg {...common}>
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
        </svg>
      );
    case '/dashboard/canned-responses':
      return (
        <svg {...common}>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case '/dashboard/workflows':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12h8M12 8v8" />
        </svg>
      );
    case '/dashboard/customers':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3" />
          <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
        </svg>
      );
    case '/dashboard/social-comments':
      return (
        <svg {...common}>
          <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <path d="M8 10h8M8 13h5" />
        </svg>
      );
    case '/dashboard/api-keys':
      return (
        <svg {...common}>
          <circle cx="8" cy="15" r="3" />
          <path d="m10.5 12.5 8-8M15 7h3v3M17 5l2 2" />
        </svg>
      );
    case '/dashboard/services':
      return (
        <svg {...common}>
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    case '/dashboard/bookings':
      return (
        <svg {...common}>
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
    case '/dashboard/catalog':
      return (
        <svg {...common}>
          <path d="m7.5 4.27 9 5.15" />
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
        </svg>
      );
    case '/dashboard/orders':
      return (
        <svg {...common}>
          <circle cx="8" cy="21" r="1" />
          <circle cx="19" cy="21" r="1" />
          <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
        </svg>
      );
    case '/dashboard/topups':
      return (
        <svg {...common}>
          <rect width="20" height="12" x="2" y="6" rx="2" />
          <circle cx="12" cy="12" r="2" />
          <path d="M6 12h.01M18 12h.01" />
        </svg>
      );
    case '/dashboard/support-history':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="4" />
          <path d="m4.93 4.93 4.24 4.24M14.83 14.83l4.24 4.24M14.83 9.17l4.24-4.24M4.93 19.07l4.24-4.24" />
        </svg>
      );
    case '/dashboard/ai-models':
      return (
        <svg {...common}>
          <rect width="16" height="16" x="4" y="4" rx="2" />
          <rect width="6" height="6" x="9" y="9" rx="1" />
          <path d="M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2" />
        </svg>
      );
    case '/dashboard/analytics':
      return (
        <svg {...common}>
          <path d="M3 3v18h18" />
          <path d="M18 17V9M13 17V5M8 17v-3" />
        </svg>
      );
    case '/dashboard/playground':
      return (
        <svg {...common}>
          <polygon points="6 3 20 12 6 21 6 3" />
        </svg>
      );
    case '/dashboard/settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}

const titles: Record<string, string> = {
  '/dashboard/clients': 'Clients',
  '/dashboard/ai-settings': 'AI Settings',
  '/dashboard/knowledge-base': 'Knowledge Base',
  '/dashboard/canned-responses': 'Canned Responses',
  '/dashboard/workflows': 'Workflows',
  '/dashboard/customers': 'Customers',
  '/dashboard/social-comments': 'Comments',
  '/dashboard/api-keys': 'API Keys',
  '/dashboard/services': 'Services',
  '/dashboard/bookings': 'Bookings',
  '/dashboard/catalog': 'Catalog',
  '/dashboard/orders': 'Orders',
  '/dashboard/topups': 'Top-ups',
  '/dashboard/support-history': 'Support History',
  '/dashboard/ai-models': 'AI Models',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/playground': 'Playground',
  '/dashboard/settings': 'Settings',
};

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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const token =
      (typeof window !== 'undefined' && localStorage.getItem('token')) || '';
    if (!token) return;
    const stored = getStoredUser();
    setUser(stored);
    if (isPortalUser(stored)) {
      apiFetch('/api/clients/me', {
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
    apiFetch('/api/clients', {
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

  // Close the mobile drawer on navigation
  useEffect(() => {
    setDrawerOpen(false);
    setMenuOpen(false);
  }, [pathname]);

  const portal = isPortalUser(user);

  const nav = portal
    ? [
        ...(showServices
          ? [{ href: '/dashboard/bookings', label: 'Bookings' }]
          : []),
        ...(showOrders ? [{ href: '/dashboard/orders', label: 'Orders' }] : []),
        { href: '/dashboard/support-history', label: 'Support' },
        { href: '/dashboard/analytics', label: 'Analytics' },
        { href: '/dashboard/settings', label: 'Settings' },
      ]
    : [
        { href: '/dashboard/clients', label: 'Clients' },
        { href: '/dashboard/ai-settings', label: 'AI Settings' },
        { href: '/dashboard/knowledge-base', label: 'Knowledge Base' },
        { href: '/dashboard/canned-responses', label: 'Canned Responses' },
        { href: '/dashboard/workflows', label: 'Workflows' },
        { href: '/dashboard/customers', label: 'Customers' },
        { href: '/dashboard/social-comments', label: 'Comments' },
        { href: '/dashboard/api-keys', label: 'API Keys' },
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
        { href: '/dashboard/topups', label: 'Top-ups' },
        { href: '/dashboard/support-history', label: 'Support' },
        { href: '/dashboard/ai-models', label: 'AI Models' },
        { href: '/dashboard/analytics', label: 'Analytics' },
        { href: '/dashboard/playground', label: 'Playground' },
        { href: '/dashboard/settings', label: 'Settings' },
      ];

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const initials = (user?.name || '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const pageTitle =
    Object.keys(titles).find((k) => pathname.startsWith(k)) &&
    titles[Object.keys(titles).find((k) => pathname.startsWith(k))!];

  const sidebar = (
    <div className="flex h-full w-64 flex-col bg-brand-navy text-white">
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark.webp" alt="TheReplyte" className="h-8 w-8" />
        <span className="text-lg font-semibold tracking-tight">TheReplyte</span>
      </div>
      {portal && portalClient && (
        <div className="-mt-3 px-5 pb-4 text-xs text-white/50">
          {portalClient.name}
        </div>
      )}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                active
                  ? 'flex items-center gap-3 rounded-lg bg-brand-gradient px-3 py-2.5 text-sm font-semibold text-white no-underline shadow-card'
                  : 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/70 no-underline transition-colors hover:bg-white/10 hover:text-white'
              }
            >
              <NavIcon href={item.href} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 px-4 py-4">
        {user && (
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{user.name}</div>
              <div className="truncate text-xs capitalize text-white/50">
                {user.role.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/20 bg-transparent px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" x2="9" y1="12" y2="12" />
          </svg>
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-page">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden lg:block">
          {sidebar}
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-brand-navy/50"
              onClick={() => setDrawerOpen(false)}
            />
            <div className="absolute inset-y-0 left-0">{sidebar}</div>
          </div>
        )}

        <div className="flex min-h-screen flex-1 flex-col lg:pl-64">
          {/* Topbar */}
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur sm:px-6">
            <button
              className="rounded-lg p-2 text-brand-navy hover:bg-page lg:hidden"
              aria-label="Open menu"
              onClick={() => setDrawerOpen(true)}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="4" x2="20" y1="6" y2="6" />
                <line x1="4" x2="20" y1="12" y2="12" />
                <line x1="4" x2="20" y1="18" y2="18" />
              </svg>
            </button>
            <h1 className="m-0 flex-1 text-lg font-semibold">{pageTitle}</h1>
            {user && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-xs font-semibold text-white"
                  aria-label="User menu"
                >
                  {initials}
                </button>
                {menuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setMenuOpen(false)}
                    />
                    <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-line bg-white py-1.5 shadow-pop">
                      <div className="border-b border-line px-4 py-2">
                        <div className="truncate text-sm font-medium text-brand-navy">
                          {user.name}
                        </div>
                        <div className="truncate text-xs text-muted">
                          {user.email}
                        </div>
                      </div>
                      <button
                        className="w-full px-4 py-2 text-left text-sm text-muted"
                        disabled
                      >
                        Profile (coming soon)
                      </button>
                      <button
                        onClick={logout}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-page"
                      >
                        Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
