import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("rounded-2xl border border-dashed border-border bg-surface p-8 text-center sm:p-10", className)}>
      {icon && <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">{icon}</div>}
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
