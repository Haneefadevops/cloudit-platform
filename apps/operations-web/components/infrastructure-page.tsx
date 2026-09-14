import {
  getOperationsInfrastructure,
  OperationsApiError,
  type DatabaseEvidence,
  type EndpointSeriesPoint,
  type MetricSeriesPoint,
  type MonitoredEndpoint,
  type OperationsInfrastructure,
  type RollupMetric,
} from "../lib/operations-api";
import { formatAge, formatDuration, formatMaltaTime } from "../lib/operations-time";
import { HealthPill } from "./status-pill";
import { OperationsErrorState } from "./operations-error-state";

const emptyInfrastructure: OperationsInfrastructure = {
  generatedAt: "",
  endpoints: [],
  database: { environmentKey: "", latest: null, series: {} },
};

export async function InfrastructurePage() {
  const now = new Date();
  try {
    const data = await getOperationsInfrastructure();
    return <InfrastructureContent data={data} now={now} />;
  } catch (error) {
    if (error instanceof OperationsApiError && error.statusCode === 404) {
      return <InfrastructureContent data={emptyInfrastructure} now={now} />;
    }
    return <div className="page-wrap">
      <header className="page-header"><div><p className="eyebrow">OPERATIONS · INFRASTRUCTURE EVIDENCE</p><h1>Infrastructure</h1><p>Website, PostgreSQL and connection evidence</p></div></header>
      <OperationsErrorState error={error} />
    </div>;
  }
}

function availabilityState(value: boolean | string | null): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalised = value.toLowerCase();
    if (normalised === "up" || normalised === "available" || normalised === "true") return true;
    if (normalised === "down" || normalised === "unavailable" || normalised === "false") return false;
  }
  return null;
}

function formatAvailability(value: boolean | string | null): string {
  const state = availabilityState(value);
  if (state === null) return typeof value === "string" && value ? value : "NO DATA";
  return state ? "Up" : "Down";
}

function humanizeMetricKey(key: string): string {
  const leaf = key.split(".").pop() ?? key;
  const words = leaf.split("_").filter((word) => !["bytes", "percent", "count"].includes(word));
  if (words.length === 0) return leaf;
  return words
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function formatBytes(value: number): string {
  if (value >= 1073741824) return `${(value / 1073741824).toFixed(1)} GB`;
  return `${(value / 1048576).toFixed(1)} MB`;
}

function formatMetricValue(key: string, metric: RollupMetric): string {
  if (metric.value === null || metric.value === undefined) return "No data";
  if (typeof metric.value === "boolean") {
    if (key.split(".").pop() === "up") return metric.value ? "Up" : "Down";
    return metric.value ? "Yes" : "No";
  }
  if (metric.unit === "bytes" || key.endsWith("_bytes")) return formatBytes(metric.value);
  if (metric.unit === "percent" || metric.unit === "%" || key.endsWith("_percent")) {
    return `${metric.value}%`;
  }
  return `${metric.value}`;
}

function Sparkline({ points, labelledBy }: { points: Array<{ value: number | null; ok: boolean | null }>; labelledBy?: string }) {
  const width = 240;
  const height = 52;
  const pad = 5;
  const numeric = points.filter((point) => point.value !== null);
  if (numeric.length < 2) {
    return <p className="ops-empty-note">No trend data (NO DATA).</p>;
  }
  const values = numeric.map((point) => point.value as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = (width - pad * 2) / Math.max(1, points.length - 1);
  const xOf = (index: number) => pad + index * stepX;
  const yOf = (value: number) => pad + (1 - (value - min) / span) * (height - pad * 2);
  let line = "";
  points.forEach((point, index) => {
    if (point.value === null) return;
    line += `${line ? "L" : "M"}${xOf(index).toFixed(1)},${yOf(point.value).toFixed(1)} `;
  });
  return <svg className="ops-spark" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={labelledBy}>
    <path className="spark-line" d={line.trim()} fill="none" strokeWidth="1.5" />
    {points.map((point, index) => point.ok === null ? null : (
      <circle key={index} className={point.ok ? "spark-up" : "spark-down"} cx={xOf(index).toFixed(1)} cy={point.value === null ? height - pad : yOf(point.value).toFixed(1)} r="2" />
    ))}
  </svg>;
}

function endpointSparklineId(endpoint: MonitoredEndpoint): string {
  return `spark-${endpoint.endpointKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function EndpointCard({ endpoint, now }: { endpoint: MonitoredEndpoint; now: Date }) {
  const sparklineId = endpointSparklineId(endpoint);
  return <article className="ops-card" aria-labelledby={`endpoint-${sparklineId}`}>
    <div className="ops-card-head">
      <h3 id={`endpoint-${sparklineId}`}>{endpoint.displayLabel}</h3>
      {endpoint.latest ? <HealthPill status={endpoint.latest.status} /> : <HealthPill status="NO_DATA" />}
    </div>
    <p className="ops-sub infra-host">{endpoint.urlHost} · {endpoint.environmentKey}</p>
    {endpoint.latest ? <dl className="ops-def-list">
      <div><dt>Availability</dt><dd>{formatAvailability(endpoint.latest.availability)}</dd></div>
      <div><dt>HTTP status</dt><dd>{endpoint.latest.httpStatus ?? "NO DATA"}</dd></div>
      <div><dt>Response time</dt><dd>{formatDuration(endpoint.latest.responseTimeMs)}</dd></div>
      <div><dt>Checked</dt><dd>{formatMaltaTime(endpoint.latest.checkedAt)} <span className="ops-age">{formatAge(endpoint.latest.checkedAt, now)}</span></dd></div>
    </dl> : <p className="ops-empty-note">No checks observed yet (NO DATA).</p>}
    <div className="ops-block">
      <h4 id={sparklineId}>Response time · 24h</h4>
      <Sparkline labelledBy={sparklineId} points={endpoint.series24h.map((point: EndpointSeriesPoint) => ({
        value: point.responseTimeMs,
        ok: availabilityState(point.availability),
      }))} />
    </div>
  </article>;
}

function metricSparklinePoints(series: MetricSeriesPoint[] | undefined): Array<{ value: number | null; ok: boolean | null }> {
  return (series ?? []).map((point) => ({
    value: typeof point.value === "number" ? point.value : null,
    ok: null,
  }));
}

function DatabaseSection({ database, now }: { database: DatabaseEvidence; now: Date }) {
  if (!database.latest) {
    return <p className="ops-empty-note">No database evidence reported (NO DATA).</p>;
  }
  const { latest } = database;
  const metricKeys = Object.keys(latest.rollupMetrics);
  return <>
    <div className="ops-card">
      <div className="ops-card-head">
        <h3>PostgreSQL status</h3>
        <HealthPill status={latest.status} />
      </div>
      <dl className="ops-def-list">
        <div><dt>State</dt><dd>{latest.up === null ? "NO DATA" : latest.up ? "Up" : "Down"}</dd></div>
        <div><dt>Observed</dt><dd>{formatMaltaTime(latest.observedAt)} <span className="ops-age">{formatAge(latest.observedAt, now)}</span></dd></div>
      </dl>
    </div>
    {metricKeys.length === 0 ? <p className="ops-empty-note">No rollup metrics reported (NO DATA).</p> : <div className="ops-metric-grid">
      {metricKeys.map((key) => {
        const metric = latest.rollupMetrics[key];
        const hasSparkline = typeof metric?.value === "number" && metricSparklinePoints(database.series[key]).some((point) => point.value !== null);
        const sparklineId = `spark-db-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
        return <article className="ops-metric" key={key}>
          <h3>{humanizeMetricKey(key)}</h3>
          <p className={metric?.value === null || metric?.value === undefined ? "ops-metric-value is-empty" : "ops-metric-value"}>
            {metric ? formatMetricValue(key, metric) : "No data"}
          </p>
          {hasSparkline ? <Sparkline labelledBy={sparklineId} points={metricSparklinePoints(database.series[key])} /> : null}
          {hasSparkline ? <span className="visually-hidden" id={sparklineId}>{humanizeMetricKey(key)} 24 hour trend</span> : null}
        </article>;
      })}
    </div>}
  </>;
}

function InfrastructureContent({ data, now }: { data: OperationsInfrastructure; now: Date }) {
  const environmentKeys = [
    ...new Set(
      [data.database?.environmentKey, ...data.endpoints.map((endpoint) => endpoint.environmentKey)]
        .filter((key): key is string => Boolean(key)),
    ),
  ];
  return <div className="page-wrap">
    <header className="page-header">
      <div><p className="eyebrow">OPERATIONS · INFRASTRUCTURE EVIDENCE</p><h1>Infrastructure</h1><p>Website, PostgreSQL and connection evidence</p></div>
      <div className="infra-env-badges">{environmentKeys.map((key) => <span key={key} className="ops-client-state">{key}</span>)}</div>
    </header>
    <p className="ops-updated">Generated {formatMaltaTime(data.generatedAt)}</p>
    <section className="ops-client" aria-labelledby="infra-endpoints">
      <h2 id="infra-endpoints" className="ops-client-title">Monitored endpoints</h2>
      {data.endpoints.length === 0 ? <p className="ops-empty-note">No endpoints reported (NO DATA).</p> : <div className="ops-endpoint-grid">
        {data.endpoints.map((endpoint) => <EndpointCard key={endpoint.endpointKey} endpoint={endpoint} now={now} />)}
      </div>}
    </section>
    <section className="ops-client" aria-labelledby="infra-database">
      <h2 id="infra-database" className="ops-client-title">Database (Supabase)</h2>
      <DatabaseSection database={data.database} now={now} />
    </section>
  </div>;
}
