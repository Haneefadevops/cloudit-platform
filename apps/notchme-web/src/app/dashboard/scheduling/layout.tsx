"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  List,
  Clock,
  Settings,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";

const subNavItems = [
  {
    to: "/dashboard/scheduling",
    icon: LayoutDashboard,
    label: "Overview",
    exact: true,
  },
  {
    to: "/dashboard/scheduling/calendar",
    icon: CalendarDays,
    label: "Calendar",
    exact: true,
  },
  { to: "/dashboard/scheduling/meeting-types", icon: List, label: "Meeting types" },
  { to: "/dashboard/scheduling/availability", icon: Clock, label: "Availability" },
  { to: "/dashboard/scheduling/bookings", icon: Settings, label: "Bookings" },
];

export default function SchedulingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Scheduling</h1>
        <p className="text-muted">
          Manage your availability, meeting types, and bookings.
        </p>
      </div>

      <nav className="flex gap-2 overflow-x-auto border-b border-border pb-1">
        {subNavItems.map((item) => {
          const isActive = item.exact
            ? pathname === item.to
            : pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              href={item.to}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-secondary text-secondary"
                  : "border-transparent text-muted hover:text-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
