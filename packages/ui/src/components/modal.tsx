import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../lib/utils.js";
import { Button } from "./button.js";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          "relative z-50 grid w-full max-w-lg gap-4 rounded-xl border bg-background p-6 shadow-lg",
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-start justify-between">
          <div className="grid gap-1.5">
            {title && (
              <h2 className="text-lg font-semibold leading-none tracking-tight">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div>{children}</div>
        {footer && <div className="flex items-center gap-2">{footer}</div>}
      </div>
    </div>
  );
}

export { Modal };
