import { forwardRef, InputHTMLAttributes } from "react";

interface SwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  label?: string;
  onCheckedChange?: (checked: boolean) => void;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, onCheckedChange, className = "", ...props }, ref) => {
    return (
      <label
        className={[
          "inline-flex items-center gap-3 cursor-pointer",
          className,
        ].join(" ")}
      >
        <div className="relative">
          <input
            ref={ref}
            type="checkbox"
            className="peer sr-only"
            onChange={(e) => onCheckedChange?.(e.target.checked)}
            {...props}
          />
          <div
            className={[
              "h-6 w-11 rounded-full border border-border bg-muted/30 transition-colors",
              "peer-checked:bg-secondary peer-checked:border-secondary",
            ].join(" ")}
          />
          <div
            className={[
              "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
              "peer-checked:translate-x-5",
            ].join(" ")}
          />
        </div>
        {label && (
          <span className="text-sm font-medium text-foreground">{label}</span>
        )}
      </label>
    );
  }
);
Switch.displayName = "Switch";
