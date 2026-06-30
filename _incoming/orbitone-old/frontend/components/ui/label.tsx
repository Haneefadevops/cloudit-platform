import { forwardRef, LabelHTMLAttributes } from "react";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  optional?: boolean;
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className = "", children, optional, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={[
          "block text-sm font-semibold text-foreground mb-1.5",
          className,
        ].join(" ")}
        {...props}
      >
        <span className="inline-flex items-center gap-1.5">
          {children}
          {optional && (
            <span className="text-xs font-normal text-muted">(optional)</span>
          )}
        </span>
      </label>
    );
  }
);
Label.displayName = "Label";
