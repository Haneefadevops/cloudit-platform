import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Activity,
  CheckCheck,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  getOperationsIncidentDetail,
  OperationsApiError,
  type HealthStatus,
  type IncidentDetailResponse,
  type IncidentListItem,
} from "../lib/operations-api";
import { formatMaltaTime } from "../lib/operations-time";
import { requireOperationsSession } from "../lib/server-session";
import { HealthPill } from "./status-pill";
import { OperationsErrorState } from "./operations-error-state";

const eventIcons: Record<IncidentDetailResponse["events"][number]["eventType"], LucideIcon> = {
  detected: Activity,
  confirmed: CheckCheck,
  recovered: TrendingUp,
  resolved: CheckCircle2,
  rejected: XCircle,
  updated: RefreshCw,
};

function statePillClass(state: IncidentListItem["state"]): string {
  if (state === "open") return "red";
  if (state === "recovered") return "amber";
  return "green";
}

function severityPillClass(severity: IncidentListItem["severity"]): string {
  if (severity === "critical") return "red";
  if (severity === "warning") return "amber";
  return "no-data";
}

function EventSeverityPill({ severity }: { severity: IncidentDetailResponse["events"][number]["severity"] }) {
  if (!severity) return null;
  return (
    <span className={`status-pill ${severityPillClass(severity)}`}>
      <span />
      {severity.toUpperCase()}
    </span>
  );
}

function IncidentDetailContent({ data }: { data: IncidentDetailResponse }) {
  const { incident, events, links } = data;
  return (
    <div className="page-wrap">
      <p><Link className="ops-link" href="/incidents">← Back to incidents</Link></p>
      <header className="page-header">
        <div>
          <p className="eyebrow">OPERATIONS · INCIDENTS</p>
          <h1>{incident.incidentKey}</h1>
          <p>{incident.safeSummary ?? "Sanitized incident evidence"}</p>
        </div>
        <span className={`status-pill ${statePillClass(incident.state)}`}>
          <span />
          {incident.state.toUpperCase()}
        </span>
      </header>
      <p className="ops-updated">Generated {formatMaltaTime(data.generatedAt)}</p>

      <section className="ops-client" aria-labelledby="incident-summary">
        <h2 id="incident-summary" className="ops-client-title">Incident summary</h2>
        <dl className="ops-def-list">
          <div><dt>State</dt><dd>{incident.state.toUpperCase()}</dd></div>
          <div>
            <dt>Severity</dt>
            <dd>
              <span className={`status-pill ${severityPillClass(incident.severity)}`}>
                <span />
                {incident.severity.toUpperCase()}
              </span>
            </dd>
          </div>
          <div><dt>Failure category</dt><dd>{incident.failureCategory ?? "Uncategorized"}</dd></div>
          <div><dt>Service</dt><dd>{incident.serviceKey}</dd></div>
          <div><dt>Endpoint</dt><dd>{incident.endpointDisplayName ?? incident.endpointKey ?? "NO DATA"}</dd></div>
          <div><dt>Domain</dt><dd>{incident.domainKey ?? "NO DATA"}</dd></div>
          <div><dt>Occurrences</dt><dd>{incident.occurrenceCount}</dd></div>
          <div><dt>Started (Europe/Malta)</dt><dd>{formatMaltaTime(incident.startedAt)}</dd></div>
          <div><dt>Confirmed (Europe/Malta)</dt><dd>{formatMaltaTime(incident.confirmedAt)}</dd></div>
          <div><dt>Recovered (Europe/Malta)</dt><dd>{formatMaltaTime(incident.recoveredAt)}</dd></div>
          <div><dt>Resolved (Europe/Malta)</dt><dd>{formatMaltaTime(incident.resolvedAt)}</dd></div>
          <div><dt>Last observed (Europe/Malta)</dt><dd>{formatMaltaTime(incident.lastObservedAt)}</dd></div>
          <div><dt>Safe summary</dt><dd>{incident.safeSummary ?? "NO DATA"}</dd></div>
          <div><dt>Safe action</dt><dd>{incident.safeAction ?? "NO DATA"}</dd></div>
          <div><dt>Correlation key</dt><dd>{incident.correlationKey ?? "NO DATA"}</dd></div>
          <div>
            <dt>Status colour</dt>
            <dd>{incident.statusColor ? <HealthPill status={incident.statusColor} /> : "NO DATA"}</dd>
          </div>
        </dl>
      </section>

      <section className="ops-client" aria-labelledby="incident-timeline">
        <h2 id="incident-timeline" className="ops-client-title">Recovery timeline</h2>
        <p className="ops-muted">
          This timeline is append-only published evidence — it reflects exactly what the
          publisher recorded and cannot be edited or backfilled.
        </p>
        {events.length === 0 ? (
          <p className="ops-empty-note">No timeline events have been published for this incident.</p>
        ) : (
          <ol className="ops-command-history">
            {events.map((event, index) => {
              const Icon = eventIcons[event.eventType];
              return (
                <li key={`${event.eventType}-${event.occurredAt}-${index}`}>
                  <span>
                    <Icon size={13} aria-hidden="true" /> {event.eventType.toUpperCase()}
                    {event.correlationKey ? <span className="ops-sub">Correlation: {event.correlationKey}</span> : null}
                  </span>
                  <span>{event.statusColor ? <HealthPill status={event.statusColor as HealthStatus} /> : null}<EventSeverityPill severity={event.severity} /></span>
                  <time dateTime={event.occurredAt}>{formatMaltaTime(event.occurredAt)}</time>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="ops-client" aria-labelledby="incident-links">
        <h2 id="incident-links" className="ops-client-title">Investigation links</h2>
        {links.length === 0 ? (
          <p className="ops-empty-note">No linked evidence.</p>
        ) : (
          <ul className="ops-command-history">
            {links.map((link) => (
              <li key={`${link.kind}-${link.refKey}`}>
                {link.kind === "endpoint" ? (
                  <Link className="ops-link" href="/infrastructure">{link.label}</Link>
                ) : (
                  <span>{link.label}</span>
                )}
                <span className="ops-sub">{link.kind} · {link.refKey}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export async function IncidentDetailPage({ incidentKey }: { incidentKey: string }) {
  await requireOperationsSession();
  try {
    const data = await getOperationsIncidentDetail(incidentKey);
    return <IncidentDetailContent data={data} />;
  } catch (error) {
    if (error instanceof OperationsApiError && error.statusCode === 404) notFound();
    return (
      <div className="page-wrap">
        <header className="page-header">
          <div>
            <p className="eyebrow">OPERATIONS · INCIDENTS</p>
            <h1>Incident</h1>
            <p>Sanitized incident evidence and recovery timeline</p>
          </div>
        </header>
        <OperationsErrorState error={error} />
      </div>
    );
  }
}
