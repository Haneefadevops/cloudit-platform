import Link from "next/link";
import {
  getOperationsIncidents,
  OperationsApiError,
  type IncidentListItem,
  type IncidentsResponse,
  type IncidentSeverityFilter,
  type IncidentSourceFilter,
  type IncidentStateFilter,
} from "../lib/operations-api";
import { formatMaltaTime } from "../lib/operations-time";
import { requireOperationsSession } from "../lib/server-session";
import { OperationsErrorState } from "./operations-error-state";

const stateFilters: { value: IncidentStateFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "recovered", label: "Recovered" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All" },
];

const severityFilters: { value: IncidentSeverityFilter | "all"; label: string }[] = [
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "critical", label: "Critical" },
  { value: "all", label: "All" },
];

const incidentSources: IncidentSourceFilter[] = [
  "n8n",
  "uptime_kuma",
  "github_actions",
  "vercel",
  "supabase",
  "imagekit",
];

const CLIENT_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{1,62}$/;
const DOMAIN_KEY_PATTERN = /^[a-z0-9.-]+\.[a-z]{2,}$/;

export interface IncidentsSearchParams {
  state?: string;
  severity?: string;
  source?: string;
  client?: string;
  domain?: string;
}

interface IncidentFilters {
  state: IncidentStateFilter;
  severity: IncidentSeverityFilter | null;
  source: IncidentSourceFilter | null;
  client: string | null;
  domain: string | null;
}

function parseFilters(searchParams: IncidentsSearchParams): IncidentFilters {
  const state = stateFilters.some((f) => f.value === searchParams.state)
    ? (searchParams.state as IncidentStateFilter)
    : "all";
  const severity = (severityFilters.some((f) => f.value === searchParams.severity) &&
  searchParams.severity !== "all"
    ? searchParams.severity
    : null) as IncidentSeverityFilter | null;
  const source = incidentSources.includes(searchParams.source as IncidentSourceFilter)
    ? (searchParams.source as IncidentSourceFilter)
    : null;
  const client =
    searchParams.client && CLIENT_KEY_PATTERN.test(searchParams.client) ? searchParams.client : null;
  const domain =
    searchParams.domain && DOMAIN_KEY_PATTERN.test(searchParams.domain) ? searchParams.domain : null;
  return { state, severity, source, client, domain };
}

function incidentsHref(filters: IncidentFilters, override: Partial<IncidentFilters>): string {
  const next = { ...filters, ...override };
  const params = new URLSearchParams();
  if (next.state !== "all") params.set("state", next.state);
  if (next.severity) params.set("severity", next.severity);
  if (next.source) params.set("source", next.source);
  if (next.client) params.set("client", next.client);
  if (next.domain) params.set("domain", next.domain);
  const query = params.toString();
  return `/incidents${query ? `?${query}` : ""}`;
}

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

function SeverityPill({ severity }: { severity: IncidentListItem["severity"] }) {
  return (
    <span className={`status-pill ${severityPillClass(severity)}`}>
      <span />
      {severity.toUpperCase()}
    </span>
  );
}

function allIncidents(data: IncidentsResponse): IncidentListItem[] {
  return data.clients.flatMap((client) => client.incidents);
}

function FilterPills({
  ariaLabel,
  options,
  current,
  hrefFor,
}: {
  ariaLabel: string;
  options: { value: string; label: string }[];
  current: string;
  hrefFor: (value: string) => string;
}) {
  return (
    <nav className="window-links" aria-label={ariaLabel}>
      {options.map((option) => (
        <Link
          key={option.value}
          href={hrefFor(option.value)}
          className={option.value === current ? "active" : ""}
          aria-current={option.value === current ? "true" : undefined}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}

function IncidentsContent({ data, filters, facets }: { data: IncidentsResponse; filters: IncidentFilters; facets: IncidentsResponse }) {
  const incidents = allIncidents(data);
  const facetIncidents = allIncidents(facets);
  const openNow = incidents.filter((incident) => incident.state === "open").length;
  const criticalOpen = incidents.filter(
    (incident) => incident.state === "open" && incident.severity === "critical",
  ).length;
  const recovered = incidents.filter((incident) => incident.state === "recovered").length;

  const domainOptions = [
    ...new Set(facetIncidents.map((incident) => incident.domainKey).filter((key): key is string => key !== null)),
  ].sort();
  const clientOptions = facets.clients.map((client) => client.clientKey).sort();

  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">OPERATIONS · INCIDENTS</p>
          <h1>Incidents</h1>
          <p>Sanitized incident evidence and repeated-failure findings across all clients</p>
        </div>
      </header>
      <p className="ops-updated">Generated {formatMaltaTime(data.generatedAt)}</p>

      <div className="ops-stat-grid">
        <div className="ops-stat"><h3>Open now</h3><p>{openNow}</p></div>
        <div className="ops-stat"><h3>Critical open</h3><p>{criticalOpen}</p></div>
        <div className="ops-stat"><h3>Recovered (filtered)</h3><p>{recovered}</p></div>
        <div className="ops-stat"><h3>Repeated-failure buckets</h3><p>{data.buckets.length}</p></div>
      </div>

      <FilterPills
        ariaLabel="Incident state"
        options={[...stateFilters].reverse()}
        current={filters.state}
        hrefFor={(value) => incidentsHref(filters, { state: value as IncidentFilters["state"] })}
      />
      <FilterPills
        ariaLabel="Incident severity"
        options={[...severityFilters].reverse()}
        current={filters.severity ?? "all"}
        hrefFor={(value) =>
          incidentsHref(filters, { severity: value === "all" ? null : (value as IncidentSeverityFilter) })
        }
      />
      <FilterPills
        ariaLabel="Source system"
        options={[{ value: "all", label: "All sources" }, ...incidentSources.map((source) => ({ value: source, label: source }))]}
        current={filters.source ?? "all"}
        hrefFor={(value) =>
          incidentsHref(filters, { source: value === "all" ? null : (value as IncidentSourceFilter) })
        }
      />
      {domainOptions.length > 0 ? (
        <FilterPills
          ariaLabel="Domain"
          options={[{ value: "all", label: "All domains" }, ...domainOptions.map((domain) => ({ value: domain, label: domain }))]}
          current={filters.domain ?? "all"}
          hrefFor={(value) => incidentsHref(filters, { domain: value === "all" ? null : value })}
        />
      ) : null}
      {clientOptions.length > 1 ? (
        <FilterPills
          ariaLabel="Client"
          options={[{ value: "all", label: "All clients" }, ...clientOptions.map((client) => ({ value: client, label: client }))]}
          current={filters.client ?? "all"}
          hrefFor={(value) => incidentsHref(filters, { client: value === "all" ? null : value })}
        />
      ) : null}

      <section className="ops-client" aria-labelledby="incident-buckets">
        <h2 id="incident-buckets" className="ops-client-title">Repeated-failure buckets</h2>
        {data.buckets.length === 0 ? (
          <p className="ops-empty-note">No repeated-failure findings in the current filter set.</p>
        ) : (
          <div className="table-scroll">
            <table className="ops-table">
              <thead>
                <tr>
                  <th scope="col">Category</th>
                  <th scope="col">Service / endpoint</th>
                  <th scope="col">Open</th>
                  <th scope="col">Total occurrences</th>
                  <th scope="col">Last occurred (Europe/Malta)</th>
                </tr>
              </thead>
              <tbody>
                {data.buckets.map((bucket) => (
                  <tr key={`${bucket.failureCategory ?? "uncategorized"}/${bucket.serviceKey}/${bucket.endpointKey ?? "none"}`}>
                    <td>{bucket.failureCategory ?? "Uncategorized"}</td>
                    <td>{bucket.serviceKey}{bucket.endpointKey ? <span className="ops-sub">{bucket.endpointKey}</span> : null}</td>
                    <td>{bucket.openCount}</td>
                    <td>{bucket.totalOccurrences}</td>
                    <td>{formatMaltaTime(bucket.lastOccurredAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {incidents.length === 0 ? (
        <article className="ops-card">
          <p className="ops-empty-note">No incidents have been published yet.</p>
        </article>
      ) : (
        data.clients.map((client) => (
          <section key={client.clientKey} className="ops-client" aria-labelledby={`incidents-${client.clientKey}`}>
            <h2 id={`incidents-${client.clientKey}`} className="ops-client-title">
              {client.clientName}<span className="ops-client-state">{client.clientKey}</span>
            </h2>
            <div className="table-scroll">
              <table className="ops-table">
                <thead>
                  <tr>
                    <th scope="col">Incident</th>
                    <th scope="col">Service / endpoint</th>
                    <th scope="col">Severity</th>
                    <th scope="col">State</th>
                    <th scope="col">Failures</th>
                    <th scope="col">Started (Europe/Malta)</th>
                    <th scope="col">Recovered / resolved (Europe/Malta)</th>
                  </tr>
                </thead>
                <tbody>
                  {client.incidents.map((incident) => (
                    <tr key={incident.incidentKey}>
                      <td>
                        <Link className="ops-link" href={`/incidents/${encodeURIComponent(incident.incidentKey)}`}>
                          {incident.incidentKey}
                        </Link>
                        {incident.safeSummary ? <span className="ops-sub">{incident.safeSummary}</span> : null}
                      </td>
                      <td>
                        {incident.serviceKey}
                        {incident.endpointKey ? <span className="ops-sub">{incident.endpointDisplayName ?? incident.endpointKey}</span> : null}
                      </td>
                      <td><SeverityPill severity={incident.severity} /></td>
                      <td>
                        <span className={`status-pill ${statePillClass(incident.state)}`}>
                          <span />
                          {incident.state.toUpperCase()}
                        </span>
                      </td>
                      <td>{incident.occurrenceCount}</td>
                      <td>{formatMaltaTime(incident.startedAt)}</td>
                      <td>{incident.resolvedAt ? formatMaltaTime(incident.resolvedAt) : formatMaltaTime(incident.recoveredAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </div>
  );
}

const emptyIncidents: IncidentsResponse = {
  generatedAt: "",
  filters: { state: "all", severity: null, client: null, domain: null, source: null },
  clients: [],
  buckets: [],
};

export async function IncidentsPage({ searchParams }: { searchParams: IncidentsSearchParams }) {
  await requireOperationsSession();
  const filters = parseFilters(searchParams);
  try {
    const [data, facets] = await Promise.all([
      getOperationsIncidents({
        state: filters.state,
        severity: filters.severity ?? undefined,
        source: filters.source ?? undefined,
        client: filters.client ?? undefined,
        domain: filters.domain ?? undefined,
      }),
      getOperationsIncidents({ state: "all" }),
    ]);
    return <IncidentsContent data={data} filters={filters} facets={facets} />;
  } catch (error) {
    if (error instanceof OperationsApiError && error.statusCode === 404) {
      return <IncidentsContent data={emptyIncidents} filters={filters} facets={emptyIncidents} />;
    }
    return (
      <div className="page-wrap">
        <header className="page-header">
          <div>
            <p className="eyebrow">OPERATIONS · INCIDENTS</p>
            <h1>Incidents</h1>
            <p>Sanitized incident evidence and repeated-failure findings across all clients</p>
          </div>
        </header>
        <OperationsErrorState error={error} />
      </div>
    );
  }
}
