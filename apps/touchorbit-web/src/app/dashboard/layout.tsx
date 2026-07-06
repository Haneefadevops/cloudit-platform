"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  Button,
} from "@cloudit/ui";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Banknote,
  Settings,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Employees", href: "/dashboard/employees", icon: <Users className="h-4 w-4" /> },
  { label: "Leave", href: "/dashboard/leave", icon: <Calendar className="h-4 w-4" /> },
  { label: "Payroll", href: "/dashboard/payroll", icon: <Banknote className="h-4 w-4" /> },
  { label: "Settings", href: "/dashboard/settings", icon: <Settings className="h-4 w-4" /> },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = "/login";
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading || !isAuthenticated) {
    return (
      <main className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </main>
    );
  }

  const items = navItems.map((item) => ({
    ...item,
    active: pathname === item.href || pathname?.startsWith(`${item.href}/`),
  }));

  return (
    <div className="flex min-h-screen">
      <Sidebar
        logo={<span className="font-bold">TouchOrbit HR</span>}
        items={items}
        collapsed={collapsed}
        onCollapse={setCollapsed}
        userProfile={
          <div className="space-y-2">
            <div className="text-sm font-medium truncate">{user?.fullName}</div>
            <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
          </div>
        }
        footer={
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sign out</span>}
          </Button>
        }
      />
      <div className="flex-1 overflow-auto p-6">{children}</div>
    </div>
  );
}
