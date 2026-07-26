'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { cx } from './Card';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<(message: string, kind?: ToastKind) => void>(
  () => {},
);

/** Show a toast. Usage: const toast = useToast(); toast('Saved', 'success'); */
export function useToast() {
  return useContext(ToastContext);
}

const kindStyles: Record<ToastKind, string> = {
  success: 'border-brand-teal/40 bg-white text-brand-navy',
  error: 'border-red-300 bg-white text-red-700',
  info: 'border-line bg-white text-brand-navy',
};

const dotStyles: Record<ToastKind, string> = {
  success: 'bg-brand-teal',
  error: 'bg-red-500',
  info: 'bg-brand-indigo',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const push = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = nextId.current++;
    setToasts((list) => [...list, { id, kind, message }]);
    setTimeout(() => {
      setToasts((list) => list.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              'pointer-events-auto flex items-center gap-2.5 rounded-xl border px-4 py-3 text-sm shadow-pop',
              kindStyles[t.kind],
            )}
          >
            <span className={cx('h-2 w-2 shrink-0 rounded-full', dotStyles[t.kind])} />
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
