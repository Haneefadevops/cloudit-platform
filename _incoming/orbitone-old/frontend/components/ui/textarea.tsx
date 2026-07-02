import { forwardRef, TextareaHTMLAttributes, useEffect, useRef } from "react";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  showCount?: boolean;
  autoResize?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className = "",
      showCount = false,
      autoResize = false,
      maxLength,
      value,
      onChange,
      ...props
    },
    forwardedRef
  ) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);

    useEffect(() => {
      if (!autoResize) return;
      const el = innerRef.current;
      if (!el) return;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, [value, autoResize]);

    function setRef(node: HTMLTextAreaElement | null) {
      innerRef.current = node;
      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    }

    const charCount = typeof value === "string" ? value.length : 0;

    return (
      <div className="w-full">
        <textarea
          ref={setRef}
          value={value}
          onChange={onChange}
          maxLength={maxLength}
          className={[
            "flex w-full rounded-xl border border-border bg-surface px-4 py-3 text-base",
            "text-foreground placeholder:text-muted/70",
            "focus:outline-none focus:ring-2 focus:ring-secondary focus:border-secondary",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "transition-colors duration-150",
            autoResize ? "resize-none overflow-hidden" : "resize-y",
            className,
          ].join(" ")}
          {...props}
        />
        {showCount && (
          <p className="mt-1 text-right text-xs text-muted">
            {charCount}
            {maxLength ? ` / ${maxLength}` : ""}
          </p>
        )}
      </div>
    );
  }
);
Textarea.displayName = "Textarea";
