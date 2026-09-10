import { notFound } from "next/navigation";
import { FoundationPage } from "../../../../components/foundation-page";

const sections = new Set(["overview", "clients", "workflows", "infrastructure", "vercel", "imagekit", "backups", "reports", "incidents", "audit-log", "settings"]);

export default function ProtectedSectionPage({ params }: { params: { section: string; detail?: string[] } }) {
  if (!sections.has(params.section)) notFound();
  return <FoundationPage section={params.section} detail={params.detail} />;
}
