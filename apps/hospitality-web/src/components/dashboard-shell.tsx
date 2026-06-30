"use client";

import { Sidebar } from "@cloudit/ui";
import {
  LayoutDashboard,
  Building2,
  BedDouble,
  Sparkles,
  PlugZap,
  Users,
  Calendar,
  ClipboardList,
  FileText,
  BarChart3,
  Settings,
} from "lucide-react";
import { OrganizationSelector } from "./organization-selector";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-4 w-4" />, active: true },
  { label: "Properties", href: "/dashboard/properties", icon: <Building2 className="h-4 w-4" /> },
  { label: "Rooms", href: "/dashboard/rooms", icon: <BedDouble className="h-4 w-4" /> },
  { label: "Housekeeping", href: "/dashboard/housekeeping", icon: <Sparkles className="h-4 w-4" /> },
  { label: "Guests", href: "/dashboard/guests", icon: <Users className="h-4 w-4" /> },
  { label: "Reservations", href: "/dashboard/reservations", icon: <ClipboardList className="h-4 w-4" /> },
  { label: "Calendar", href: "/dashboard/calendar", icon: <Calendar className="h-4 w-4" /> },
  { label: "Invoices", href: "/dashboard/invoices", icon: <FileText className="h-4 w-4" /> },
  { label: "Reports", href: "/dashboard/reports", icon: <BarChart3 className="h-4 w-4" /> },
  { label: "Integrations", href: "/dashboard/integrations", icon: <PlugZap className="h-4 w-4" /> },
  { label: "Settings", href: "/dashboard/settings", icon: <Settings className="h-4 w-4" /> },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar
        logo={<span className="font-bold">CloudIT Hospitality</span>}
        items={navItems}
        footer={<OrganizationSelector />}
      />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">{children}</main>
    </div>
  );
}
