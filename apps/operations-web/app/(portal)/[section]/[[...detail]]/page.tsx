import { notFound } from "next/navigation";
import { FoundationPage } from "../../../../components/foundation-page";
import { OverviewPage } from "../../../../components/overview-page";
import { WorkflowsPage } from "../../../../components/workflows-page";
import { WorkflowDetailPage } from "../../../../components/workflow-detail-page";
import { InfrastructurePage } from "../../../../components/infrastructure-page";
import { VercelPage } from "../../../../components/vercel-page";
import { ImagekitPage } from "../../../../components/imagekit-page";
import { BackupsPage } from "../../../../components/backups-page";
import { ReportsPage } from "../../../../components/reports-page";
import { IncidentsPage, type IncidentsSearchParams } from "../../../../components/incidents-page";
import { IncidentDetailPage } from "../../../../components/incident-detail-page";
import { AuditLogPage, type AuditLogSearchParams } from "../../../../components/audit-log-page";
import type { WorkflowsWindow } from "../../../../lib/operations-api";

const sections = new Set(["overview", "clients", "workflows", "infrastructure", "vercel", "imagekit", "backups", "reports", "incidents", "audit-log", "settings"]);
const workflowWindows = new Set<WorkflowsWindow>(["24h", "7d", "30d"]);

export default async function ProtectedSectionPage({
  params,
  searchParams,
}: {
  params: { section: string; detail?: string[] };
  searchParams: { window?: string } & IncidentsSearchParams & AuditLogSearchParams;
}) {
  if (!sections.has(params.section)) notFound();
  if (params.section === "overview") return <OverviewPage />;
  if (params.section === "infrastructure") return <InfrastructurePage />;
  if (params.section === "vercel") return <VercelPage />;
  if (params.section === "imagekit") return <ImagekitPage />;
  if (params.section === "backups") return <BackupsPage />;
  if (params.section === "reports") return <ReportsPage />;
  if (params.section === "incidents") {
    const incidentKey = params.detail?.[0];
    if (incidentKey) return <IncidentDetailPage incidentKey={incidentKey} />;
    return <IncidentsPage searchParams={searchParams} />;
  }
  if (params.section === "audit-log") return <AuditLogPage searchParams={searchParams} />;
  if (params.section === "workflows") {
    const workflowKey = params.detail?.[0];
    if (workflowKey) return <WorkflowDetailPage workflowKey={workflowKey} />;
    const window = workflowWindows.has(searchParams.window as WorkflowsWindow)
      ? (searchParams.window as WorkflowsWindow)
      : "7d";
    return <WorkflowsPage window={window} />;
  }
  return <FoundationPage section={params.section} detail={params.detail} />;
}
