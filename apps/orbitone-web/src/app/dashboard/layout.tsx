"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard,
  User,
  Users,
  Settings,
  LogOut,
  CalendarClock,
  TrendingUp,
  Zap,
  Building2,
  Briefcase,
  UserCog,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/dashboard/profile", icon: User, label: "Profile" },
  { to: "/dashboard/scheduling", icon: CalendarClock, label: "Scheduling" },
  { to: "/dashboard/analytics", icon: TrendingUp, label: "Analytics" },
  { to: "/dashboard/customers", icon: Users, label: "Customers" },
  {
    to: "/dashboard/accounts",
    icon: Briefcase,
    label: "Accounts",
    businessOnly: true,
  },
  { to: "/dashboard/organization", icon: Building2, label: "Organization" },
  {
    to: "/dashboard/organization/members",
    icon: UserCog,
    label: "Team",
    adminOnly: true,
  },
  { to: "/dashboard/upgrade", icon: Zap, label: "Upgrade" },
  { to: "/dashboard/settings", icon: Settings, label: "Settings" },
];

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { state } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (state.status === "unauthenticated") {
      router.replace("/login");
    }
  }, [state.status, router]);

  if (state.status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (state.status === "unauthenticated") {
    return null;
  }

  return children;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <DashboardShell>{children}</DashboardShell>
    </ProtectedRoute>
  );
}

function DashboardShell({ children }: { children: React.ReactNode }) {
  const { state, logout } = useAuth();
  const pathname = usePathname();
  const user = state.status === "authenticated" ? state.user : null;
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleNavItems = navItems.filter(
    (item) =>
      (!item.businessOnly || user?.plan.startsWith("pro_business")) &&
      (!item.adminOnly || user?.role === "admin"),
  );

  const NavContent = (
    <>
      <div className="hidden h-16 items-center gap-2 px-4 md:flex">
        <Logo className="h-8 w-8" />
        <span className="text-lg font-semibold text-foreground">OrbitOne</span>
      </div>

      <nav className="space-y-1 p-3">
        {visibleNavItems.map((item) => {
          const isActive =
            pathname === item.to || pathname.startsWith(`${item.to}/`);
          return (
            <Link
              key={item.to}
              href={item.to}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 border-l-4 px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "border-secondary bg-surface text-foreground"
                  : "border-transparent text-muted hover:bg-surface-elevated/60 hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-border/50 p-4">
        <div className="mb-4 flex items-center gap-3">
          <Avatar fallback={user?.fullName ?? "U"} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {user?.fullName}
            </p>
            <p className="truncate text-xs text-muted">{user?.email}</p>
          </div>
        </div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <Badge variant="outline" className="capitalize">
            {user?.plan.replace(/_/g, " ") ?? "free"}
          </Badge>
          <ThemeToggle />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Log out
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Mobile header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border/50 bg-surface/60 px-4 backdrop-blur-xl md:hidden">
        <div className="flex items-center gap-2">
          <Logo className="h-8 w-8" />
          <span className="text-lg font-semibold text-foreground">
            OrbitOne
          </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 px-0"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-16 z-40 flex h-[calc(100vh-4rem)] w-64 transform flex-col border-r border-border/50 bg-surface/95 backdrop-blur-xl transition-transform md:static md:top-0 md:h-auto md:min-h-screen md:w-64 md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {NavContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
