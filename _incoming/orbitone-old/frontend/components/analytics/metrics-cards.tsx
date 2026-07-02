"use client";

import type { ProfileMetrics } from "@/lib/contracts";
import { Eye, QrCode, Download, Users } from "lucide-react";

export function MetricsCards({ metrics }: { metrics: ProfileMetrics }) {
  const items = [
    { label: "Profile views", value: metrics.profileViews, icon: Eye, gradient: "from-secondary to-accent-2" },
    { label: "QR scans", value: metrics.qrScans, icon: QrCode, gradient: "from-accent-2 to-accent" },
    { label: "vCard downloads", value: metrics.vcardDownloads, icon: Download, gradient: "from-secondary to-accent" },
    { label: "Connections added", value: metrics.connectionsAdded, icon: Users, gradient: "from-accent to-accent-2" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className="rounded-2xl border border-border bg-surface p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-dropdown"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted">{item.label}</p>
              <span
                className={[
                  "inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                  item.gradient,
                ].join(" ")}
              >
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold text-foreground">
              {item.value.toLocaleString()}
            </p>
          </div>
        );
      })}
    </div>
  );
}
