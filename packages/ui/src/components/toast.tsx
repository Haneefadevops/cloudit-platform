"use client";
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../lib/utils.js";
import { Button } from "./button.js";

export type ToastVariant = "default" | "success" | "error" | "warning";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(
  undefined
);

function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

interface ToastProviderProps {
  children: React.ReactNode;
}

function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastViewport toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

interface ToastViewportProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

function ToastViewport({ toasts, removeToast }: ToastViewportProps) {
  return (
    <div className="fixed bottom-0 right-0 z-50 flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-[420px]">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onClose: () => void;
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  React.useEffect(() => {
    const timer = setTimeout(onClose, toast.duration ?? 5000);
    return () => clearTimeout(timer);
  }, [toast.duration, onClose]);

  return (
    <div
      className={cn(
        "pointer-events-auto relative flex w-full items-start justify-between gap-3 rounded-lg border p-4 shadow-lg",
        toast.variant === "error" &&
          "border-destructive bg-destructive text-destructive-foreground",
        toast.variant === "success" &&
          "border-green-600 bg-green-600 text-white",
        toast.variant === "warning" &&
          "border-yellow-500 bg-yellow-500 text-white",
        (!toast.variant || toast.variant === "default") &&
          "border-border bg-background text-foreground"
      )}
    >
      <div className="grid gap-1">
        {toast.title && <p className="text-sm font-semibold">{toast.title}</p>}
        {toast.description && (
          <p className="text-sm opacity-90">{toast.description}</p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={onClose}
        aria-label="Close toast"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export { ToastProvider, useToast, ToastItem, ToastViewport };
export type { ToastContextValue };
