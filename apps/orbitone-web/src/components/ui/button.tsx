import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading, children, disabled, asChild, ...props }, ref) => {
    const classes = cn(
      "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
      {
        "bg-primary text-primary-foreground hover:bg-primary/90": variant === "primary",
        "bg-secondary text-secondary-foreground hover:bg-secondary/90": variant === "secondary",
        "border border-border bg-surface-elevated text-foreground hover:bg-surface": variant === "outline",
        "text-foreground hover:bg-surface": variant === "ghost",
        "bg-error text-error-foreground hover:bg-error/90": variant === "danger",
      },
      {
        "h-8 px-3 text-sm": size === "sm",
        "h-10 px-4 text-sm": size === "md",
        "h-12 px-6 text-base": size === "lg",
      },
      className
    );

    if (asChild) {
      const child = children as React.ReactElement<React.HTMLAttributes<HTMLElement>>;
      return (
        <child.type
          {...child.props}
          className={cn(classes, child.props.className)}
          ref={ref}
          disabled={disabled || isLoading}
        />
      );
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={classes}
        {...props}
      >
        {isLoading ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {children}
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);
Button.displayName = "Button";
