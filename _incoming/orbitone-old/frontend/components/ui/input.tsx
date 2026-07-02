import { forwardRef, InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={[
          "flex w-full rounded-xl border bg-surface px-4 py-2.5 text-base",
          "text-foreground placeholder:text-muted/70",
          "focus:outline-none focus:ring-2 focus:border-secondary",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-colors duration-150",
          error
            ? "border-error focus:ring-error focus:border-error"
            : "border-border focus:ring-secondary",
          className,
        ].join(" ")}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
