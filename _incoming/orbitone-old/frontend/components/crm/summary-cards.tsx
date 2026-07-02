"use client";

import type { CRMSummary, LifecycleStage } from "@/lib/contracts";
import { Users, ArrowUp, CheckCircle2, AlertCircle } from "lucide-react";

const lifecycleOrder: LifecycleStage[] = [
  "new",
  "contacted",
  "meeting",
  "proposal",
  "won",
  "lost",
];

const lifecycleLabels: Record<LifecycleStage, string> = {
  new: "New",
  contacted: "Contacted",
  meeting: "Meeting",
  proposal: "Proposal",
  won: "Won",
  lost: "Lost",
};

const lifecycleGradients: Record<LifecycleStage, string> = {
  new: "from-secondary to-secondary/70",
  contacted: "from-accent-2 to-accent-2/70",
  meeting: "from-accent to-accent/70",
  proposal: "from-secondary to-accent-2",
  won: "from-secondary to-accent",
  lost: "from-muted to-muted/70",
};

export function CRMSummaryCards({ summary }: { summary: CRMSummary }) {
  const total = lifecycleOrder.reduce(
    (sum, stage) => sum + (summary.lifecycle[stage] || 0),
    0
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryMetric
          label="Total connections"
          value={total}
          icon={<Users className="h-4 w-4 text-white" />}
          gradient="from-secondary to-accent-2"
        />
        <SummaryMetric
          label="High priority"
          value={summary.highPriority}
          icon={<ArrowUp className="h-4 w-4 text-white" />}
          gradient="from-accent to-accent-2"
        />
        <SummaryMetric
          label="Open follow-ups"
          value={summary.openFollowUps}
          icon={<CheckCircle2 className="h-4 w-4 text-white" />}
          gradient="from-secondary to-accent"
        />
        <SummaryMetric
          label="Overdue follow-ups"
          value={summary.overdueFollowUps}
          icon={<AlertCircle className="h-4 w-4 text-white" />}
          gradient="from-accent to-accent-2"
        />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">
          Lifecycle breakdown
        </h3>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {lifecycleOrder.map((stage) => (
            <div
              key={stage}
              className="rounded-xl border border-border bg-background p-3 text-center transition-all hover:-translate-y-0.5 hover:border-secondary hover:shadow-card"
            >
              <span
                className={[
                  "mx-auto mb-2 block h-1.5 w-8 rounded-full bg-gradient-to-r",
                  lifecycleGradients[stage],
                ].join(" ")}
              />
              <p className="text-2xl font-bold text-foreground">
                {summary.lifecycle[stage] || 0}
              </p>
              <p className="text-xs text-muted">{lifecycleLabels[stage]}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryMetric({
  label,
  value,
  icon,
  gradient,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-dropdown">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted">{label}</p>
        <span
          className={[
            "inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br shadow-sm",
            gradient,
          ].join(" ")}
        >
          {icon}
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold text-foreground">
        {value.toLocaleString()}
      </p>
    </div>
  );
}
