"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { ThemeIconButton } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import {
  LayoutDashboard,
  UserCircle,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  Calendar,
  Clock,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/discover", label: "Discover", icon: Search },
  { href: "/dashboard/events", label: "Events", icon: Calendar },
  { href: "/dashboard/scheduling", label: "Scheduling", icon: Clock },
  { href: "/dashboard/profile", label: "Profile", icon: UserCircle },
  { href: "/dashboard/connections", label: "Connections", icon: Users },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  async function handleLogout() {
    await auth.logout();
    router.push("/");
  }

  if (auth.status === "loading") {
    return (
      <div className="flex min-h-full items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-secondary border-t-transparent" />
      </div>
    );
  }

  if (auth.status === "unauthenticated" || auth.status === "error") {
    router.replace("/login");
    return null;
  }

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      {/* Mobile header */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-surface/90 px-4 backdrop-blur lg:hidden">
        <Link href="/dashboard">
          <Logo />
        </Link>
        <div className="flex items-center gap-1">
          <ThemeIconButton />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="rounded-xl p-2 text-foreground hover:bg-background"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
      </header>

      {/* Sidebar */}
      <aside
        className={[
          "fixed inset-x-0 top-16 z-40 flex-col border-b border-border bg-surface lg:static lg:inset-auto lg:flex lg:h-auto lg:w-64 lg:border-b-0 lg:border-r",
          mobileMenuOpen ? "flex" : "hidden lg:flex",
        ].join(" ")}
      >
        <div className="hidden h-16 items-center border-b border-border px-6 lg:flex">
          <Link href="/dashboard">
            <Logo />
          </Link>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={[
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-secondary/10 text-secondary"
                    : "text-muted hover:bg-background hover:text-foreground",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                    isActive
                      ? "bg-secondary text-white"
                      : "bg-background text-muted group-hover:text-foreground",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {item.label}
                {isActive && (
                  <span className="ml-auto h-2 w-2 rounded-full bg-accent" />
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-4">
          <div className="hidden items-center gap-3 rounded-2xl border border-border bg-background p-3 lg:flex">
            <Avatar
              initials={auth.user?.fullName}
              alt={auth.user?.fullName}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {auth.user?.fullName}
              </p>
              <p className="truncate text-xs text-muted">{auth.user?.email}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 px-1">
            <ThemeIconButton />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="flex-1 justify-start text-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 bg-background">
        {/* Desktop top bar */}
        <div className="sticky top-0 z-30 hidden h-16 items-center justify-end gap-3 border-b border-border bg-background/90 px-8 backdrop-blur lg:flex">
          <LanguageSwitcher compact />
          <div className="h-6 w-px bg-border" />
          <ThemeIconButton />
          <div className="relative">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:border-secondary/50"
            >
              <Avatar
                initials={auth.user?.fullName}
                alt={auth.user?.fullName}
                size="sm"
              />
              <span className="max-w-[8rem] truncate">{auth.user?.fullName}</span>
              <ChevronDown className="h-4 w-4 text-muted" />
            </button>
            {userMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-border bg-surface p-2 shadow-dropdown">
                <div className="border-b border-border px-3 py-2">
                  <p className="text-sm font-semibold text-foreground">
                    {auth.user?.fullName}
                  </p>
                  <p className="text-xs text-muted">{auth.user?.email}</p>
                </div>
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-background hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
