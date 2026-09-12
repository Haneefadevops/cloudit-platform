import Link from "next/link";
import { getWorkflowCatalogue, OperationsApiError, type WorkflowsWindow } from "../lib/operations-api";
import { formatMaltaTime, formatPercent } from "../lib/operations-time";
import { HealthPill } from "./status-pill";
import { OperationsErrorState } from "./operations-error-state";

const windows: WorkflowsWindow[] = ["24h", "7d", "30d"];

const overdueLabel: Record<string, string> = { on_time: "ON TIME", due: "DUE", overdue: "OVERDUE" };

export async function WorkflowsPage({ window }: { window: WorkflowsWindow }) {
  try {
    const catalogue = await getWorkflowCatalogue(window);
    return <div className="page-wrap">
      <header className="page-header">
        <div><p className="eyebrow">OPERATIONS · AUTOMATION EVIDENCE</p><h1>Workflow health</h1><p>Curated automation status · never an editable n8n canvas</p></div>
      </header>
      <nav className="window-links" aria-label="Success percentage window">
        {windows.map((w) => <Link key={w} href={`/workflows?window=${w}`} className={w === window ? "active" : ""} aria-current={w === window ? "true" : undefined}>{w}</Link>)}
      </nav>
      {catalogue.workflows.length === 0 ? <p className="ops-empty-note">No workflows reported (NO DATA).</p> : <div className="table-scroll"><table className="ops-table">
        <thead><tr>
          <th scope="col">Workflow</th><th scope="col">Client / environment</th><th scope="col">Schedule</th><th scope="col">Enabled</th><th scope="col">Criticality</th><th scope="col">Last execution</th><th scope="col">Last success ({`Europe/Malta`})</th><th scope="col">Next expected ({`Europe/Malta`})</th><th scope="col">Overdue</th><th scope="col">Success {window}</th>
        </tr></thead>
        <tbody>
          {catalogue.workflows.map((wf) => <tr key={`${wf.clientKey}/${wf.environmentKey}/${wf.workflowKey}`}>
            <td><Link className="ops-link" href={`/workflows/${encodeURIComponent(wf.workflowKey)}`}>{wf.displayName}</Link></td>
            <td>{wf.clientKey} / {wf.environmentKey}</td>
            <td>{wf.scheduleExpression ?? "NO DATA"}<span className="ops-sub">{wf.scheduleTimezone ?? "NO DATA"}</span></td>
            <td>{wf.enabled ? "Yes" : "No"}</td>
            <td>{wf.criticality}</td>
            <td>{wf.latestExecution ? <>{wf.latestExecution.outcome}{wf.latestExecution.failureCategory ? <span className="ops-failure"> · {wf.latestExecution.failureCategory}</span> : null} <HealthPill status={wf.latestExecution.status} /></> : "NO DATA"}</td>
            <td>{formatMaltaTime(wf.lastSuccessAt)}</td>
            <td>{formatMaltaTime(wf.nextExpectedRun)}</td>
            <td>{wf.overdueState ? <span className={`status-pill ${wf.overdueState === "on_time" ? "green" : wf.overdueState === "due" ? "amber" : "red"}`}><span />{overdueLabel[wf.overdueState]}</span> : "NO DATA"}</td>
            <td>{formatPercent(wf.successPercent)}</td>
          </tr>)}
        </tbody>
      </table></div>}
    </div>;
  } catch (error) {
    if (error instanceof OperationsApiError && error.statusCode === 404) {
      return <div className="page-wrap">
        <header className="page-header"><div><p className="eyebrow">OPERATIONS · AUTOMATION EVIDENCE</p><h1>Workflow health</h1><p>Curated automation status · never an editable n8n canvas</p></div></header>
        <p className="ops-empty-note">No workflows reported (NO DATA).</p>
      </div>;
    }
    return <div className="page-wrap">
      <header className="page-header"><div><p className="eyebrow">OPERATIONS · AUTOMATION EVIDENCE</p><h1>Workflow health</h1><p>Curated automation status · never an editable n8n canvas</p></div></header>
      <OperationsErrorState error={error} />
    </div>;
  }
}
