import { getOperationsOverview, OperationsApiError, type ClientOverview } from "../lib/operations-api";
import { formatAge, formatDuration, formatMaltaTime, formatPercent } from "../lib/operations-time";
import { HealthPill } from "./status-pill";
import { OperationsErrorState } from "./operations-error-state";

export async function OverviewPage() {
  const lastUpdated = new Date();
  try {
    const overview = await getOperationsOverview();
    return <OverviewContent overview={overview} lastUpdated={lastUpdated} />;
  } catch (error) {
    if (error instanceof OperationsApiError && error.statusCode === 404) {
      return <OverviewContent overview={{ clients: [] }} lastUpdated={lastUpdated} />;
    }
    return <div className="page-wrap">
      <header className="page-header"><div><p className="eyebrow">OPERATIONS · LIVE EVIDENCE</p><h1>Operations overview</h1><p>All clients · live service and evidence health</p></div></header>
      <OperationsErrorState error={error} />
    </div>;
  }
}

function OverviewContent({ overview, lastUpdated }: { overview: { clients: ClientOverview[] }; lastUpdated: Date }) {
  return <div className="page-wrap">
    <header className="page-header">
      <div><p className="eyebrow">OPERATIONS · LIVE EVIDENCE</p><h1>Operations overview</h1><p>All clients · live service and evidence health</p></div>
    </header>
    <p className="ops-updated">Last updated {formatMaltaTime(lastUpdated.toISOString())}</p>
    {overview.clients.length === 0 && <p className="ops-empty-note">No client evidence is available yet (NO DATA).</p>}
    {overview.clients.map((client) => <section key={client.clientKey} className="ops-client" aria-labelledby={`client-${client.clientKey}`}>
      <h2 id={`client-${client.clientKey}`} className="ops-client-title">{client.displayName}<span className="ops-client-state">{client.state}</span></h2>
      {client.environments.length === 0 && <p className="ops-empty-note">No environments reported (NO DATA).</p>}
      <div className="ops-env-grid">
        {client.environments.map((env) => <article key={env.environmentKey} className="ops-card" aria-labelledby={`env-${env.environmentKey}`}>
          <div className="ops-card-head">
            <h3 id={`env-${env.environmentKey}`}>{env.displayName}</h3>
            <HealthPill status={env.environmentHealth.level} />
          </div>
          {env.environmentHealth.reasons.length > 0 && <ul className="ops-reasons">
            {env.environmentHealth.reasons.map((reason, i) => <li key={i}>{reason}</li>)}
          </ul>}
          <div className="ops-block">
            <h4>Domains</h4>
            {env.domains.length === 0 ? <p className="ops-empty-note">NO DATA</p> : <ul className="ops-domains">
              {env.domains.map((domain) => <li key={domain}>{domain}</li>)}
            </ul>}
          </div>
          <div className="ops-block">
            <h4>Workflow health</h4>
            {env.workflowHealth.length === 0 ? <p className="ops-empty-note">NO DATA</p> : <div className="table-scroll"><table className="ops-table">
              <thead><tr><th scope="col">Workflow</th><th scope="col">Latest outcome</th><th scope="col">Status</th><th scope="col">Last run ({`Europe/Malta`})</th><th scope="col">Duration</th><th scope="col">Schedule delay</th><th scope="col">Success 24h</th><th scope="col">Success 7d</th></tr></thead>
              <tbody>
                {env.workflowHealth.map((wf) => <tr key={wf.workflowKey}>
                  <td>{wf.displayName}</td>
                  <td>{wf.latestOutcome ?? "NO DATA"}{wf.failureCategory ? <span className="ops-failure"> · {wf.failureCategory}</span> : null}</td>
                  <td><HealthPill status={wf.status} /></td>
                  <td>{formatMaltaTime(wf.latestFinishedAt ?? wf.latestObservedAt)}</td>
                  <td>{formatDuration(wf.latestDurationMs)}</td>
                  <td>{formatDuration(wf.latestScheduleDelayMs)}</td>
                  <td>{formatPercent(wf.successPercent24h)}</td>
                  <td>{formatPercent(wf.successPercent7d)}</td>
                </tr>)}
              </tbody>
            </table></div>}
          </div>
          <div className="ops-block">
            <h4>Evidence freshness</h4>
            {env.evidenceFreshness.length === 0 ? <p className="ops-empty-note">NO DATA</p> : <ul className="ops-evidence">
              {env.evidenceFreshness.map((ev) => <li key={ev.sourceSystem}>
                <span>{ev.sourceSystem}</span>
                <span>{formatMaltaTime(ev.latestObservedAt)}</span>
                <span className="ops-age">{formatAge(ev.latestObservedAt, lastUpdated)}</span>
              </li>)}
            </ul>}
          </div>
        </article>)}
      </div>
    </section>)}
  </div>;
}
