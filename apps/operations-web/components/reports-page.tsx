import {
  getOperationsReports,
  OperationsApiError,
  type OperationsReport,
  type OperationsReports,
  type ReportDocumentStatus,
} from "../lib/operations-api";
import { formatMaltaTime } from "../lib/operations-time";
import { HealthPill } from "./status-pill";
import { OperationsErrorState } from "./operations-error-state";
import { isReportPdfRelayConfigured } from "../lib/report-pdf-relay";

const emptyReports: OperationsReports = { generatedAt: "", reports: [] };

const stateClass: Record<ReportDocumentStatus, string> = {
  DRAFT: "amber",
  APPROVED: "green",
  SENDING: "amber",
  SENT: "green",
  REJECTED: "no-data",
  SEND_FAILED: "red",
};

function StatePill({ state }: { state: ReportDocumentStatus | null }) {
  if (!state) return <span className="status-pill no-data"><span />NO DATA</span>;
  return <span className={`status-pill ${stateClass[state]}`}><span />{state}</span>;
}

function monthLabel(month: string): string {
  const value = new Date(`${month}T00:00:00Z`);
  return Number.isNaN(value.getTime())
    ? month
    : value.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function findingCount(report: OperationsReport, severity: string): number {
  const value = report.findingCountsBySeverity[severity];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function ReportCard({ report, relayConfigured }: { report: OperationsReport; relayConfigured: boolean }) {
  return (
    <article className="ops-card">
      <div className="ops-card-head">
        <div>
          <p className="eyebrow">{report.clientDisplayName} · {report.reportType.replaceAll("_", " ")}</p>
          <h3>{monthLabel(report.reportMonth)}</h3>
        </div>
        <StatePill state={report.documentStatus} />
      </div>
      <dl className="ops-def-list">
        <div><dt>Overall</dt><dd>{report.overallStatus ? <HealthPill status={report.overallStatus} /> : "NO DATA"}</dd></div>
        <div><dt>Coverage</dt><dd>{report.coverage ?? "NO DATA"}</dd></div>
        <div><dt>Generated</dt><dd>{formatMaltaTime(report.generatedAt)}</dd></div>
        <div><dt>PDF</dt><dd>{report.pdfAvailable ? "Available privately" : "Not available"}</dd></div>
        <div><dt>Delivery</dt><dd>{report.deliveryFailureCategory ? `Failed: ${report.deliveryFailureCategory}` : report.documentStatus ?? "NO DATA"}</dd></div>
      </dl>
      <div className="ops-card-head"><h3>Sanitized findings</h3><span className="ops-sub">{report.findings.length} recorded</span></div>
      {report.findings.length === 0 ? <p className="ops-empty-note">No sanitized findings published for this report.</p> : (
        <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>Severity</th><th>Finding</th><th>Action</th></tr></thead><tbody>
          {report.findings.map((finding) => <tr key={finding.findingKey}><td>{finding.severity.toUpperCase()}</td><td><strong>{finding.safeTitle}</strong>{finding.safeSummary ? <span className="ops-sub">{finding.safeSummary}</span> : null}</td><td>{finding.safeAction ?? "—"}</td></tr>)}
        </tbody></table></div>
      )}
      <div className="ops-card-head"><h3>Report history</h3><span className="ops-sub">Authoritative state mirror</span></div>
      {report.history.length === 0 ? <p className="ops-empty-note">No report-history events published yet.</p> : (
        <div className="ops-table-wrap"><table className="ops-table"><thead><tr><th>When</th><th>Transition</th></tr></thead><tbody>
          {report.history.map((event) => <tr key={`${event.eventType}-${event.occurredAt}`}><td>{formatMaltaTime(event.occurredAt)}</td><td>{event.fromStatus ? `${event.fromStatus} → ${event.toStatus ?? "—"}` : event.toStatus ?? event.eventType}</td></tr>)}
        </tbody></table></div>
      )}
      {report.pdfAvailable && relayConfigured ? (
        <nav className="report-pdf-actions" aria-label={`PDF options for ${monthLabel(report.reportMonth)}`}>
          <a className="ops-link" href={`/reports/${encodeURIComponent(report.reportKey)}/pdf?disposition=inline`} target="_blank" rel="noreferrer">Preview PDF</a>
          <a className="ops-link" href={`/reports/${encodeURIComponent(report.reportKey)}/pdf?disposition=attachment`}>Download PDF</a>
        </nav>
      ) : (
        <p className="ops-sub">Read-only: {report.pdfAvailable ? "private PDF retrieval is not configured." : "no private PDF is available for this report."}</p>
      )}
    </article>
  );
}

function ReportsContent({ data }: { data: OperationsReports }) {
  const relayConfigured = isReportPdfRelayConfigured();
  return <div className="page-wrap">
    <header className="page-header"><div><p className="eyebrow">OPERATIONS · REPORT CENTRE</p><h1>Reports</h1><p>Private, sanitized report evidence and delivery history</p></div></header>
    <article className="ops-card"><p className="ops-sub">Read-only — approval, rejection, sending, retrying, and regeneration are unavailable.</p></article>
    {data.reports.length === 0 ? <article className="ops-card"><p className="ops-empty-note">No report summaries have been published yet.</p></article> : <div className="ops-grid">{data.reports.map((report) => <ReportCard key={report.reportKey} report={report} relayConfigured={relayConfigured} />)}</div>}
  </div>;
}

export async function ReportsPage() {
  try {
    return <ReportsContent data={await getOperationsReports()} />;
  } catch (error) {
    if (error instanceof OperationsApiError && error.statusCode === 404) return <ReportsContent data={emptyReports} />;
    return <div className="page-wrap"><header className="page-header"><div><p className="eyebrow">OPERATIONS · REPORT CENTRE</p><h1>Reports</h1><p>Private, sanitized report evidence and delivery history</p></div></header><OperationsErrorState error={error} /></div>;
  }
}
