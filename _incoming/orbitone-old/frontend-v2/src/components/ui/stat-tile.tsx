import { cn } from "@/lib/utils";

export interface StatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: string;
}

export function StatTile({ label, value, icon, trend, className, ...props }: StatTileProps) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-3xl border border-border/60 bg-surface/40 p-6 backdrop-blur-xl",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-muted">{label}</span>
        {icon && <div className="text-secondary">{icon}</div>}
      </div>
      <div className="mt-4">
        <div className="text-4xl font-semibold tracking-tight text-foreground">{value}</div>
        {trend && <div className="mt-1 text-xs text-muted">{trend}</div>}
      </div>
    </div>
  );
}
