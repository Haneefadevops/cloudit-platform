import { forwardRef, HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "outline";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "default", className = "", children, ...props }, ref) => {
    const base =
      "rounded-2xl border transition-all duration-200";
    const variants = {
      default:
        "bg-surface border-border shadow-sm hover:shadow-md",
      glass:
        "bg-surface/80 backdrop-blur border-border/50 shadow-md",
      outline:
        "bg-transparent border-border hover:border-secondary/40",
    };
    return (
      <div
        ref={ref}
        className={[base, variants[variant], className].join(" ")}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

export function CardHeader({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={["p-5 pb-0", className].join(" ")}>{children}</div>
  );
}

export function CardTitle({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h3
      className={[
        "text-lg font-semibold tracking-tight text-foreground",
        className,
      ].join(" ")}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p className={["text-sm text-muted", className].join(" ")}>{children}</p>
  );
}

export function CardContent({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={["p-5", className].join(" ")}>{children}</div>;
}

export function CardFooter({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        "flex items-center gap-3 p-5 pt-0",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}
