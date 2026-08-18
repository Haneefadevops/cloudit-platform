import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "outline" | "accent" | "success" | "warning" | "error";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        {
          "bg-primary text-primary-foreground": variant === "default",
          "bg-secondary text-secondary-foreground": variant === "secondary",
          "border border-border bg-surface-elevated text-foreground": variant === "outline",
          "bg-accent text-accent-foreground": variant === "accent",
          "bg-success text-success-foreground": variant === "success",
          "bg-warning text-warning-foreground": variant === "warning",
          "bg-error text-error-foreground": variant === "error",
        },
        className
      )}
      {...props}
    />
  );
}
