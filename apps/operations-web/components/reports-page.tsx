import {
  getOperationsReports,
  getReportActions,
  OperationsApiError,
  type OperationsReport,
  type OperationsReports,
  type ReportActions as ReportActionsFlags,
  type ReportCommandType,
  type ReportDocumentStatus,
} from "../lib/operations-api";
import { formatMaltaTime } from "../lib/operations-time";
import { deriveCsrfToken, deriveRequestKey, newActionNonce } from "../lib/report-action-tokens";
import { requireOperationsSession } from "../lib/server-session";
import { HealthPill } from "./status-pill";
import { OperationsErrorState } from "./operations-error-state";
import { ReportActions, type ReportActionsProps } from "./report-actions";
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

function isActionCandidate(report: OperationsReport): boolean {
  return (
    (report.documentStatus === "DRAFT" && report.pdfAvailable) ||
    report.documentStatus === "SEND_FAILED"
  );
}

type ActionTokenBundle = Pick<ReportActionsProps, "csrf" | "requestKeys">;

function buildActionTokens(
  secret: string,
  email: string,
  reportKey: string,
  actionNonce: string,
): ActionTokenBundle {
  const commandTypes: Record<keyof ActionTokenBundle["requestKeys"], ReportCommandType> = {
    approveAndSend: "APPROVE_AND_SEND",
    reject: "REJECT",
    retrySend: "RETRY_SEND",
  };
  const tokens = {} as Record<keyof ActionTokenBundle["requestKeys"], { csrf: string; requestKey: string }>;
  for (const kind of Object.keys(commandTypes) as Array<keyof ActionTokenBundle["requestKeys"]>) {
    tokens[kind] = {
      csrf: deriveCsrfToken(secret, email, reportKey, commandTypes[kind], actionNonce),
      requestKey: deriveRequestKey(secret, email, reportKey, commandTypes[kind], actionNonce),
    };
  }
  return {
    csrf: {
      actionNonce,
      tokens: { approveAndSend: tokens.approveAndSend.csrf, reject: tokens.reject.csrf, retrySend: tokens.retrySend.csrf },
    },
    requestKeys: {
      approveAndSend: tokens.approveAndSend.requestKey,
      reject: tokens.reject.requestKey,
      retrySend: tokens.retrySend.requestKey,
    },
  };
}

function ReportCard({
  report,
  relayConfigured,
  actionFlags,
  actionTokens,
}: {
  report: OperationsReport;
  relayConfigured: boolean;
  actionFlags: ReportActionsFlags | null;
  actionTokens: ActionTokenBundle | null;
}) {
  const showActions =
    actionFlags !== null &&
    actionTokens !== null &&
    (actionFlags.actions.approveAndSend || actionFlags.actions.reject || actionFlags.actions.retrySend);
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
      {report.recentCommand ? (
        <p className="ops-muted">
          Last action: {report.recentCommand.commandType.replaceAll("_", " ")} — {report.recentCommand.status}
          {report.recentCommand.resultCode ? ` (${report.recentCommand.resultCode})` : ""}
        </p>
      ) : null}
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
      {showActions && actionFlags && actionTokens ? (
        <ReportActions
          reportKey={report.reportKey}
          clientDisplayName={report.clientDisplayName}
          reportMonth={report.reportMonth}
          documentStatus={report.documentStatus}
          pdfAvailable={report.pdfAvailable}
          actions={actionFlags.actions}
          csrf={actionTokens.csrf}
          requestKeys={actionTokens.requestKeys}
        />
      ) : null}
    </article>
  );
}

async function ReportsContent({
  data,
  sessionEmail,
  sessionSecret,
}: {
  data: OperationsReports;
  sessionEmail: string;
  sessionSecret: string | null;
}) {
  const relayConfigured = isReportPdfRelayConfigured();
  const actionNonce = newActionNonce();
  const candidates = sessionSecret
    ? data.reports.filter((report) => isActionCandidate(report))
    : [];

  const flagsByKey = new Map<string, ReportActionsFlags | null>();
  await Promise.all(
    candidates.map(async (report) => {
      try {
        flagsByKey.set(report.reportKey, await getReportActions(report.reportKey));
      } catch {
        // Fail closed: an actions lookup failure renders no action buttons.
        flagsByKey.set(report.reportKey, null);
      }
    }),
  );

  return <div className="page-wrap">
    <header className="page-header"><div><p className="eyebrow">OPERATIONS · REPORT CENTRE</p><h1>Reports</h1><p>Private, sanitized report evidence and delivery history</p></div></header>
    {data.reports.length === 0 ? <article className="ops-card"><p className="ops-empty-note">No report summaries have been published yet.</p></article> : (
      <div className="ops-grid">
        {data.reports.map((report) => (
          <ReportCard
            key={report.reportKey}
            report={report}
            relayConfigured={relayConfigured}
            actionFlags={flagsByKey.get(report.reportKey) ?? null}
            actionTokens={sessionSecret ? buildActionTokens(sessionSecret, sessionEmail, report.reportKey, actionNonce) : null}
          />
        ))}
      </div>
    )}
  </div>;
}

export async function ReportsPage() {
  const session = await requireOperationsSession();
  const sessionSecret = process.env.OPERATIONS_SESSION_SECRET;
  const usableSecret = sessionSecret && sessionSecret.length >= 32 ? sessionSecret : null;
  try {
    return (
      <ReportsContent
        data={await getOperationsReports()}
        sessionEmail={session.email}
        sessionSecret={usableSecret}
      />
    );
  } catch (error) {
    if (error instanceof OperationsApiError && error.statusCode === 404) {
      return (
        <ReportsContent
          data={emptyReports}
          sessionEmail={session.email}
          sessionSecret={usableSecret}
        />
      );
    }
    return <div className="page-wrap"><header className="page-header"><div><p className="eyebrow">OPERATIONS · REPORT CENTRE</p><h1>Reports</h1><p>Private, sanitized report evidence and delivery history</p></div></header><OperationsErrorState error={error} /></div>;
  }
}
