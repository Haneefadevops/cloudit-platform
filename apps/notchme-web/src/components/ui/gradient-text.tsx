import { cn } from "@/lib/utils";

export function GradientText({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "bg-gradient-to-r from-secondary via-accent to-secondary bg-clip-text text-transparent",
        className
      )}
    >
      {children}
    </span>
  );
}
