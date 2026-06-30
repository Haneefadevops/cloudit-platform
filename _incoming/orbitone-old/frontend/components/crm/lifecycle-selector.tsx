"use client";

import type { LifecycleStage } from "@/lib/contracts";

const stages: { value: LifecycleStage; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "meeting", label: "Meeting" },
  { value: "proposal", label: "Proposal" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
];

interface LifecycleSelectorProps {
  value: LifecycleStage;
  onChange: (value: LifecycleStage) => void;
  disabled?: boolean;
}

export function LifecycleSelector({
  value,
  onChange,
  disabled = false,
}: LifecycleSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {stages.map((stage) => {
        const isActive = stage.value === value;
        return (
          <button
            key={stage.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(stage.value)}
            className={[
              "rounded-xl border px-3 py-2 text-sm font-medium transition-all",
              isActive
                ? "border-transparent bg-primary text-white shadow-sm"
                : "border-border bg-surface text-muted hover:bg-background hover:text-foreground",
              disabled && "opacity-50 cursor-not-allowed",
            ].join(" ")}
          >
            {stage.label}
          </button>
        );
      })}
    </div>
  );
}
