"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { Calendar, UserPlus, QrCode, BarChart3 } from "lucide-react";

const actions = [
  { icon: Calendar, label: "Meeting", href: "/dashboard/scheduling/meeting-types" },
  { icon: UserPlus, label: "Customer", href: "/dashboard/customers" },
  { icon: QrCode, label: "Share QR", href: "/dashboard/profile" },
  { icon: BarChart3, label: "Analytics", href: "/dashboard/analytics" },
];

export function QuickActions({ className }: { className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      {actions.map((action) => (
        <Link
          key={action.label}
          href={action.href}
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-surface/40 p-4 text-center backdrop-blur-xl transition-all hover:border-secondary/40 hover:bg-surface-elevated/60"
        >
          <action.icon className="h-5 w-5 text-secondary" />
          <span className="text-xs font-medium text-foreground">{action.label}</span>
        </Link>
      ))}
    </div>
  );
}
