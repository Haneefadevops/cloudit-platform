"use client";

import type { ConnectionPriority } from "@/lib/contracts";

const priorities: { value: ConnectionPriority; label: string; dot: string }[] = [
  { value: "low", label: "Low", dot: "bg-muted" },
  { value: "medium", label: "Medium", dot: "bg-accent-2" },
  { value: "high", label: "High", dot: "bg-accent" },
];

interface PrioritySelectorProps {
  value: ConnectionPriority;
  onChange: (value: ConnectionPriority) => void;
  disabled?: boolean;
}

export function PrioritySelector({
  value,
  onChange,
  disabled = false,
}: PrioritySelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {priorities.map((priority) => {
        const isActive = priority.value === value;
        return (
          <button
            key={priority.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(priority.value)}
            className={[
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
              isActive
                ? "border-transparent bg-primary text-white shadow-sm"
                : "border-border bg-surface text-muted hover:bg-background hover:text-foreground",
              disabled && "opacity-50 cursor-not-allowed",
            ].join(" ")}
          >
            <span
              className={[
                "h-2 w-2 rounded-full",
                isActive ? "bg-white" : priority.dot,
              ].join(" ")}
            />
            {priority.label}
          </button>
        );
      })}
    </div>
  );
}
