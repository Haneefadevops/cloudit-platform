import { cn } from "@/lib/utils";

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  hover?: boolean;
}

export function GlassCard({ children, className, hover = false, ...props }: GlassCardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border/60 bg-surface/40 p-6 backdrop-blur-xl",
        hover && "transition-all duration-300 hover:-translate-y-1 hover:border-secondary/40 hover:bg-surface-elevated/60",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
