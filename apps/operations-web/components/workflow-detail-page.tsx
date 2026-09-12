import { notFound } from "next/navigation";
import { getWorkflowDetail, OperationsApiError, type WorkflowDetail } from "../lib/operations-api";
import { formatDuration, formatMaltaTime, formatPercent, formatSlaSeconds } from "../lib/operations-time";
import { HealthPill } from "./status-pill";
import { OperationsErrorState } from "./operations-error-state";

export async function WorkflowDetailPage({ workflowKey }: { workflowKey: string }) {
  try {
    const details = await getWorkflowDetail(workflowKey);
    if (details.length === 0) notFound();
    return <div className="page-wrap">
      <header className="page-header">
        <div><p className="eyebrow">OPERATIONS · WORKFLOW DETAIL</p><h1>{details[0].definition.displayName}</h1><p>{details[0].definition.workflowKey} · {details[0].clientKey} / {details[0].environmentKey}</p></div>
      </header>
      {details.map((detail) => <WorkflowDetailSection key={`${detail.clientKey}/${detail.environmentKey}`} detail={detail} />)}
    </div>;
  } catch (error) {
    if (error instanceof OperationsApiError && error.statusCode === 404) notFound();
    return <div className="page-wrap">
      <header className="page-header"><div><p className="eyebrow">OPERATIONS · WORKFLOW DETAIL</p><h1>{workflowKey}</h1></div></header>
      <OperationsErrorState error={error} />
    </div>;
  }
}

function WorkflowDetailSection({ detail }: { detail: WorkflowDetail }) {
  const { definition } = detail;
  return <section className="ops-detail" aria-label={definition.displayName}>
    <div className="ops-card">
      <div className="ops-card-head"><h3>Definition</h3><HealthPill status={definition.enabled ? "GREEN" : "NO_DATA"} /></div>
      <dl className="ops-def-list">
        <div><dt>Trigger</dt><dd>{definition.triggerKind}</dd></div>
        <div><dt>Schedule</dt><dd>{definition.scheduleExpression ?? "NO DATA"}</dd></div>
        <div><dt>Schedule timezone</dt><dd>{definition.scheduleTimezone ?? "NO DATA"}</dd></div>
        <div><dt>Completion SLA</dt><dd>{formatSlaSeconds(definition.completionSlaSeconds)}</dd></div>
        <div><dt>Criticality</dt><dd>{definition.criticality}</dd></div>
        <div><dt>Enabled</dt><dd>{definition.enabled ? "Yes" : "No"}</dd></div>
      </dl>
    </div>
    <div className="ops-stat-grid">
      {(["24h", "7d", "30d"] as const).map((w) => <article key={w} className="ops-stat">
        <h3>Success {w}</h3>
        <p>{formatPercent(detail.successPercent[w])}</p>
      </article>)}
    </div>
    <div className="ops-card">
      <div className="ops-card-head"><h3>Recent executions</h3></div>
      {detail.executions.length === 0 ? <p className="ops-empty-note">No executions observed (NO DATA).</p> : <div className="table-scroll"><table className="ops-table">
        <thead><tr>
          <th scope="col">Scheduled ({`Europe/Malta`})</th><th scope="col">Started ({`Europe/Malta`})</th><th scope="col">Finished ({`Europe/Malta`})</th><th scope="col">Duration</th><th scope="col">Schedule delay</th><th scope="col">Outcome</th><th scope="col">Failure category</th><th scope="col">Status</th>
        </tr></thead>
        <tbody>
          {detail.executions.map((ex) => <tr key={ex.executionKey}>
            <td>{formatMaltaTime(ex.scheduledFor)}</td>
            <td>{formatMaltaTime(ex.startedAt)}</td>
            <td>{formatMaltaTime(ex.finishedAt)}</td>
            <td>{formatDuration(ex.durationMs)}</td>
            <td>{formatDuration(ex.scheduleDelayMs)}</td>
            <td>{ex.outcome}</td>
            <td>{ex.failureCategory ?? "—"}</td>
            <td><HealthPill status={ex.status} /></td>
          </tr>)}
        </tbody>
      </table></div>}
    </div>
    <div className="ops-card">
      <div className="ops-card-head"><h3>Workflow diagram</h3></div>
      <p className="ops-empty-note">Curated step diagram is not available for this workflow yet.</p>
    </div>
  </section>;
}
