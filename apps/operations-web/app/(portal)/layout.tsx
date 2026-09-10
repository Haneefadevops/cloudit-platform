import { AppShell } from "../../components/app-shell";
import { requireOperationsSession } from "../../lib/server-session";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await requireOperationsSession();
  return <AppShell email={session.email}>{children}</AppShell>;
}
