import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export type SwitchProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, ...props }, ref) => {
    return (
      <label className={cn("relative inline-flex cursor-pointer items-center", className)}>
        <input
          ref={ref}
          type="checkbox"
          className="peer sr-only"
          {...props}
        />
        <span className="h-6 w-11 rounded-full bg-border transition-colors peer-checked:bg-secondary" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-primary-foreground shadow-sm transition-transform peer-checked:translate-x-5" />
      </label>
    );
  }
);
Switch.displayName = "Switch";
