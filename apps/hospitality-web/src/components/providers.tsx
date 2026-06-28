"use client";

import { ToastProvider } from "@cloudit/ui";

export function Providers({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
