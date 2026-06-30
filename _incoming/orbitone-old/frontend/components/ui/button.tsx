import { ButtonHTMLAttributes, forwardRef } from "react";
import { Loader2 } from "lucide-react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "link"
  | "gradient";
type ButtonSize = "sm" | "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-background hover:bg-primary/90 focus:ring-primary",
  secondary:
    "bg-secondary text-white hover:bg-secondary/90 focus:ring-secondary",
  outline:
    "border border-border bg-surface-elevated text-foreground hover:border-secondary hover:text-secondary focus:ring-secondary",
  ghost:
    "text-foreground hover:bg-surface focus:ring-secondary",
  danger:
    "bg-accent text-white hover:bg-accent/90 focus:ring-accent",
  link:
    "text-secondary hover:underline underline-offset-4 focus:ring-0 p-0 h-auto",
  gradient:
    "gradient-sunset text-white hover:opacity-90 focus:ring-secondary shadow-lg shadow-accent/20",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-base",
  lg: "h-12 px-6 text-base",
  icon: "h-10 w-10 p-2",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      children,
      className = "",
      disabled,
      ...props
    },
    ref
  ) => {
    const isIconOnly = size === "icon";
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={[
          "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed",
          "active:scale-[0.98]",
          variant !== "link" && sizeClasses[size],
          variantClasses[variant],
          className,
        ].join(" ")}
        {...props}
      >
        {isLoading && (
          <Loader2
            className={["animate-spin", isIconOnly ? "h-5 w-5" : "h-4 w-4"].join(
              " "
            )}
          />
        )}
        {!isLoading && children}
      </button>
    );
  }
);

Button.displayName = "Button";
