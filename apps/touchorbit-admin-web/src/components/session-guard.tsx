'use client'

import { useSessionCheck } from "@/hooks/use-session-check";

export function SessionGuard({ children }: { children: React.ReactNode }) {
  useSessionCheck();
  return <>{children}</>;
}
