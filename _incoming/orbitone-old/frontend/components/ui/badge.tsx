type BadgeVariant =
  | "default"
  | "primary"
  | "secondary"
  | "accent"
  | "outline"
  | "muted"
  | "success"
  | "warning"
  | "info";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

export function Badge({
  variant = "default",
  dot = false,
  className = "",
  children,
  ...props
}: BadgeProps) {
  const variants: Record<BadgeVariant, string> = {
    default: "bg-surface border-border text-foreground",
    primary: "bg-primary/10 text-primary border-primary/20",
    secondary: "bg-secondary/10 text-secondary border-secondary/20",
    accent: "bg-accent/10 text-accent border-accent/20",
    outline: "border-border text-muted bg-transparent",
    muted: "bg-muted/10 text-muted border-muted/20",
    success: "bg-secondary/10 text-secondary border-secondary/20",
    warning: "bg-accent-2/15 text-amber-700 border-accent-2/30 dark:text-accent-2",
    info: "bg-info/10 text-info border-info/20",
  };
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        variants[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {dot && (
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
      )}
      {children}
    </span>
  );
}
