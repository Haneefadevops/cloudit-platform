"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const icons: Record<ToastType, React.ReactNode> = {
    success: <CheckCircle className="h-5 w-5 text-secondary" />,
    error: <XCircle className="h-5 w-5 text-accent" />,
    info: <Info className="h-5 w-5 text-secondary" />,
    warning: <AlertTriangle className="h-5 w-5 text-accent-2" />,
  };

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {typeof window !== "undefined" &&
        createPortal(
          <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3">
            {toasts.map((toast) => (
              <div
                key={toast.id}
                className={[
                  "flex items-center gap-3 rounded-xl border bg-surface px-4 py-3 shadow-lg min-w-[16rem] max-w-xs",
                  "animate-in slide-in-from-bottom-2 fade-in duration-200",
                ].join(" ")}
              >
                {icons[toast.type]}
                <span className="flex-1 text-sm font-medium text-foreground">
                  {toast.message}
                </span>
                <button
                  onClick={() => remove(toast.id)}
                  className="rounded-full p-1 text-muted hover:bg-surface hover:text-foreground"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>,
          document.body
        )}
    </ToastContext.Provider>
  );
}
