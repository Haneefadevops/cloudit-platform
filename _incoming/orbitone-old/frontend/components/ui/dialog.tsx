"use client";

import { createPortal } from "react-dom";
import { ReactNode, useCallback, useEffect, useSyncExternalStore } from "react";
import { X } from "lucide-react";

function subscribe() {
  return () => {};
}
function getClientSnapshot() {
  return true;
}
function getServerSnapshot() {
  return false;
}

interface DialogBaseProps {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

type DialogProps =
  | (DialogBaseProps & { onClose: () => void; onOpenChange?: never })
  | (DialogBaseProps & { onOpenChange: (open: boolean) => void; onClose?: never });

export function Dialog({
  open,
  onClose,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: DialogProps) {
  const mounted = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot
  );

  const handleClose = useCallback(() => {
    if (onOpenChange) {
      onOpenChange(false);
    } else if (onClose) {
      onClose();
    }
  }, [onClose, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, handleClose]);

  if (!mounted || !open) return null;

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-primary/40 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div
        className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
      >
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-full p-1 text-muted hover:bg-surface hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-semibold text-foreground pr-8">{title}</h2>
        {description && (
          <p className="mt-1.5 text-sm text-muted">{description}</p>
        )}
        {children && <div className="mt-5">{children}</div>}
        {footer && (
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

export function DialogActions({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={["flex justify-end gap-3 mt-6", className].join(" ")}>
      {children}
    </div>
  );
}
