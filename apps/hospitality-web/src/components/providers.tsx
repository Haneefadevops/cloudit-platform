"use client";

import { ToastProvider } from "@cloudit/ui";
import { useInitOrganization } from "@/hooks/useInitOrganization";

export function Providers({ children }: { children: React.ReactNode }) {
  useInitOrganization();
  return <ToastProvider>{children}</ToastProvider>;
}
