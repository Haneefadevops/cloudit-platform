import {
  getOperationsImagekit,
  OperationsApiError,
  type OperationsImagekit,
  type OperationsImagekitQuota,
} from "../lib/operations-api";
import { formatAge, formatMaltaTime, formatPercent } from "../lib/operations-time";
import { HealthPill } from "./status-pill";
import { OperationsErrorState } from "./operations-error-state";
import { ConnectivityCard } from "./ops-connectivity";
import { Sparkline } from "./ops-sparkline";

const emptyImagekit: OperationsImagekit = {
  generatedAt: "",
  rollupStatus: "NO_DATA",
  quotas: [],
  utilizationPercent: null,
  connectivity: { reachable: null, lastSuccessfulAt: null, failureCategory: null },
  warningThresholds: { state: "NO_DATA", note: "No threshold evidence collected yet." },
};

export async function ImagekitPage() {
  const now = new Date();
  try {
    const data = await getOperationsImagekit();
    return <ImagekitContent data={data} now={now} />;
  } catch (error) {
    if (error instanceof OperationsApiError && error.statusCode === 404) {
      return <ImagekitContent data={emptyImagekit} now={now} />;
    }
    return <div className="page-wrap">
      <header className="page-header"><div><p className="eyebrow">OPERATIONS · IMAGEKIT EVIDENCE</p><h1>ImageKit analytics</h1><p>Usage, quota and delivery evidence</p></div></header>
      <OperationsErrorState error={error} />
    </div>;
  }
}

function formatBytes(value: number): string {
  if (value >= 1073741824) return `${(value / 1073741824).toFixed(1)} GB`;
  return `${(value / 1048576).toFixed(1)} MB`;
}

function formatQuotaAmount(value: number | null, unit: string): string {
  if (value === null) return "No data";
  if (unit === "bytes") return formatBytes(value);
  return unit ? `${value.toLocaleString("en-US")} ${unit}` : value.toLocaleString("en-US");
}

function QuotaCard({ quota, now }: { quota: OperationsImagekitQuota; now: Date }) {
  const sparklineId = `spark-ik-${quota.metricKey.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const trendPoints = quota.trend.map((point) => ({ value: point.value, ok: null }));
  const hasTrend = trendPoints.filter((point) => point.value !== null).length >= 2;
  const usedPercent = quota.remainingPercent === null ? null : Math.min(100, Math.max(0, 100 - quota.remainingPercent));
  const isLow = quota.remainingPercent !== null && quota.remainingPercent < 20;
  return (
    <article className="ops-metric" aria-labelledby={sparklineId}>
      <h3 id={sparklineId}>{quota.displayName}</h3>
      <p className={quota.used === null ? "ops-metric-value is-empty" : "ops-metric-value"}>
        {formatQuotaAmount(quota.used, quota.unit)}
      </p>
      <p className="ops-sub">
        {quota.quota === null ? "Quota unknown" : `of ${formatQuotaAmount(quota.quota, quota.unit)}`}
        {" · "}Last sample {formatAge(quota.lastSampleAt, now)}
      </p>
      {usedPercent === null ? <p className="ops-empty-note">No data</p> : <>
        <span className="ops-quota-bar" role="img" aria-label={`${Math.round(usedPercent)}% of quota used`}>
          <span className={isLow ? "ops-quota-bar-fill is-low" : "ops-quota-bar-fill"} style={{ width: `${usedPercent}%` }} />
        </span>
        <p className="ops-sub">{Math.round(quota.remainingPercent as number)}% remaining</p>
      </>}
      {hasTrend ? <div className="ops-block"><Sparkline labelledBy={`${sparklineId}-trend`} points={trendPoints} /><span className="visually-hidden" id={`${sparklineId}-trend`}>{quota.displayName} 31 day trend</span></div> : null}
    </article>
  );
}

function ImagekitContent({ data, now }: { data: OperationsImagekit; now: Date }) {
  return <div className="page-wrap">
    <header className="page-header">
      <div><p className="eyebrow">OPERATIONS · IMAGEKIT EVIDENCE</p><h1>ImageKit analytics</h1><p>Usage, quota and delivery evidence</p></div>
      <HealthPill status={data.rollupStatus} />
    </header>
    <p className="ops-updated">Generated {formatMaltaTime(data.generatedAt)} <span className="ops-age">{formatAge(data.generatedAt, now)}</span></p>
    <section className="ops-client" aria-labelledby="imagekit-quotas">
      <h2 id="imagekit-quotas" className="ops-client-title">Usage vs quota</h2>
      {data.quotas.length === 0
        ? <p className="ops-empty-note">No quota evidence collected yet (NO DATA).</p>
        : <div className="ops-metric-grid">
            {data.quotas.map((quota) => <QuotaCard key={quota.metricKey} quota={quota} now={now} />)}
          </div>}
    </section>
    <section className="ops-client" aria-labelledby="imagekit-utilization">
      <h2 id="imagekit-utilization" className="ops-client-title">Account utilization</h2>
      <div className="ops-stat-grid">
        <article className="ops-stat">
          <h3>Utilization</h3>
          <p>{formatPercent(data.utilizationPercent)}</p>
        </article>
      </div>
    </section>
    <section className="ops-client" aria-labelledby="imagekit-connectivity">
      <h2 id="imagekit-connectivity" className="ops-client-title">Connectivity</h2>
      <ConnectivityCard connectivity={data.connectivity} now={now} />
    </section>
    <section className="ops-client" aria-labelledby="imagekit-thresholds">
      <h2 id="imagekit-thresholds" className="ops-client-title">Warning thresholds</h2>
      <article className="ops-card">
        <div className="ops-card-head">
          <h3>Threshold history</h3>
          <HealthPill status={data.warningThresholds.state} />
        </div>
        <p className="ops-empty-note">{data.warningThresholds.note}</p>
      </article>
    </section>
  </div>;
}
