"use client";

import type { RelationshipStatus } from "@/lib/contracts";

const statuses: { value: RelationshipStatus; label: string; dot: string }[] = [
  { value: "new", label: "New", dot: "bg-secondary" },
  { value: "active", label: "Active", dot: "bg-success" },
  { value: "follow_up", label: "Follow up", dot: "bg-accent-2" },
  { value: "opportunity", label: "Opportunity", dot: "bg-accent" },
  { value: "archived", label: "Archived", dot: "bg-muted" },
];

interface StatusSelectorProps {
  value: RelationshipStatus;
  onChange: (value: RelationshipStatus) => void;
  disabled?: boolean;
}

export function StatusSelector({
  value,
  onChange,
  disabled = false,
}: StatusSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((status) => {
        const isActive = status.value === value;
        return (
          <button
            key={status.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(status.value)}
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
                isActive ? "bg-white" : status.dot,
              ].join(" ")}
            />
            {status.label}
          </button>
        );
      })}
    </div>
  );
}
