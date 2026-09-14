import {
  getOperationsVercel,
  OperationsApiError,
  type OperationsVercel,
  type OperationsVercelDeployment,
  type OperationsVercelTraffic,
} from "../lib/operations-api";
import { formatAge, formatDuration, formatMaltaTime } from "../lib/operations-time";
import { BooleanPill, HealthPill } from "./status-pill";
import { OperationsErrorState } from "./operations-error-state";
import { ConnectivityCard } from "./ops-connectivity";

const emptyVercel: OperationsVercel = {
  generatedAt: "",
  rollupStatus: "NO_DATA",
  traffic: null,
  deployments: { current: null, recent: [], lastDeploymentAt: null },
  domains: [],
  connectivity: { reachable: null, lastSuccessfulAt: null, failureCategory: null },
};

export async function VercelPage() {
  const now = new Date();
  try {
    const data = await getOperationsVercel();
    return <VercelContent data={data} now={now} />;
  } catch (error) {
    if (error instanceof OperationsApiError && error.statusCode === 404) {
      return <VercelContent data={emptyVercel} now={now} />;
    }
    return <div className="page-wrap">
      <header className="page-header"><div><p className="eyebrow">OPERATIONS · VERCEL EVIDENCE</p><h1>Vercel analytics</h1><p>Web traffic, deployments, domains and connectivity evidence</p></div></header>
      <OperationsErrorState error={error} />
    </div>;
  }
}

function deploymentStateClass(state: string): string {
  const normalised = state.toUpperCase();
  if (normalised === "READY") return "green";
  if (normalised === "ERROR" || normalised === "CANCELED") return "red";
  if (["BUILDING", "INITIALIZING", "DEPLOYING", "QUEUED", "PENDING"].includes(normalised)) return "amber";
  return "no-data";
}

function DeploymentStatePill({ state }: { state: string }) {
  return (
    <span className={`status-pill ${deploymentStateClass(state)}`}>
      <span />
      {state || "UNKNOWN"}
    </span>
  );
}

function sumDaily(daily: OperationsVercelTraffic["daily"], key: "visitors" | "pageviews"): number | null {
  let sum = 0;
  let any = false;
  for (const point of daily) {
    const value = point[key];
    if (value !== null) {
      sum += value;
      any = true;
    }
  }
  return any ? sum : null;
}

function trafficSparkId(traffic: OperationsVercelTraffic): string {
  return `spark-vercel-traffic-${traffic.boundary.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function TrafficSparkline({ traffic }: { traffic: OperationsVercelTraffic }) {
  const width = 240;
  const height = 52;
  const pad = 5;
  const labelledBy = trafficSparkId(traffic);
  const series = traffic.daily.map((point) => ({
    visitors: point.visitors,
    pageviews: point.pageviews,
  }));
  const values = series.flatMap((point) => [point.visitors, point.pageviews]).filter((value): value is number => value !== null);
  if (series.length < 2) {
    return <p className="ops-empty-note">Trend chart appears after 2 or more days of evidence ({series.length} day collected).</p>;
  }
  if (values.length < 2) {
    return <p className="ops-empty-note">No trend data (NO DATA).</p>;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = (width - pad * 2) / Math.max(1, series.length - 1);
  const xOf = (index: number) => pad + index * stepX;
  const yOf = (value: number) => pad + (1 - (value - min) / span) * (height - pad * 2);
  const pathOf = (key: "visitors" | "pageviews") => {
    let line = "";
    series.forEach((point, index) => {
      const value = point[key];
      if (value === null) return;
      line += `${line ? "L" : "M"}${xOf(index).toFixed(1)},${yOf(value).toFixed(1)} `;
    });
    return line.trim();
  };
  const visitorsLine = pathOf("visitors");
  const pageviewsLine = pathOf("pageviews");
  return <>
    <svg className="ops-spark" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={labelledBy}>
      {pageviewsLine ? <path className="spark-line-b" d={pageviewsLine} fill="none" strokeWidth="1.5" /> : null}
      {visitorsLine ? <path className="spark-line" d={visitorsLine} fill="none" strokeWidth="1.5" /> : null}
    </svg>
    <span className="visually-hidden" id={labelledBy}>Visitors and pageviews daily trend</span>
    <p className="ops-sub">
      <span style={{ color: "var(--blue)" }}>● Visitors</span> · <span style={{ color: "var(--green)" }}>● Pageviews</span>
    </p>
  </>;
}

function TrafficSection({ traffic, now }: { traffic: OperationsVercelTraffic; now: Date }) {
  const visitors = sumDaily(traffic.daily, "visitors");
  const pageviews = sumDaily(traffic.daily, "pageviews");
  return <>
    <div className="ops-stat-grid">
      <article className="ops-stat">
        <h3>Visitors · sum of daily</h3>
        <p>{visitors === null ? "No data" : visitors.toLocaleString("en-US")}</p>
      </article>
      <article className="ops-stat">
        <h3>Pageviews · sum of daily</h3>
        <p>{pageviews === null ? "No data" : pageviews.toLocaleString("en-US")}</p>
      </article>
      <article className="ops-stat">
        <h3>Window</h3>
        <p>{traffic.daily.length}d</p>
        <span className="ops-sub">Last sample {formatAge(traffic.lastTrafficAt, now)}</span>
      </article>
    </div>
    <div className="ops-card">
      <div className="ops-block">
        <h4>Daily traffic · {traffic.daily.length} day window ({traffic.timezone})</h4>
        <TrafficSparkline traffic={traffic} />
      </div>
      <div className="ops-block">
        <h4>Top routes</h4>
        {traffic.topRoutes.length === 0 ? <p className="ops-empty-note">No route evidence collected yet (NO DATA).</p> : <div className="table-scroll"><table className="ops-table">
          <thead><tr><th scope="col">Path</th><th scope="col">Views</th></tr></thead>
          <tbody>
            {traffic.topRoutes.map((route) => <tr key={route.path}>
              <td>{route.path}</td>
              <td>{route.views.toLocaleString("en-US")}</td>
            </tr>)}
          </tbody>
        </table></div>}
      </div>
    </div>
  </>;
}

function CurrentDeploymentCard({ deployment, now }: { deployment: OperationsVercelDeployment; now: Date }) {
  return (
    <article className="ops-card">
      <div className="ops-card-head">
        <h3>Current production</h3>
        <DeploymentStatePill state={deployment.state} />
      </div>
      <p className="ops-sub">{deployment.deploymentKey}</p>
      <dl className="ops-def-list">
        <div>
          <dt>Created</dt>
          <dd>{formatMaltaTime(deployment.createdAt)} <span className="ops-age">{formatAge(deployment.createdAt, now)}</span></dd>
        </div>
        <div>
          <dt>Ready</dt>
          <dd>{deployment.readyAt ? `${formatMaltaTime(deployment.readyAt)} ` : "NO DATA"}
            {deployment.readyAt ? <span className="ops-age">{formatAge(deployment.readyAt, now)}</span> : null}</dd>
        </div>
        <div>
          <dt>Duration</dt>
          <dd>{formatDuration(deployment.durationMs)}</dd>
        </div>
      </dl>
    </article>
  );
}

function DeploymentsSection({ deployments, now }: { deployments: OperationsVercel["deployments"]; now: Date }) {
  if (!deployments.current && deployments.recent.length === 0) {
    return <p className="ops-empty-note">No deployment evidence collected yet (NO DATA).</p>;
  }
  return <>
    {deployments.current ? <CurrentDeploymentCard deployment={deployments.current} now={now} /> : <p className="ops-empty-note">No current production deployment reported (NO DATA).</p>}
    <div className="ops-card">
      <div className="ops-card-head">
        <h3>Recent deployments</h3>
        <span className="ops-sub">Last deployment {formatAge(deployments.lastDeploymentAt, now)}</span>
      </div>
      {deployments.recent.length === 0 ? <p className="ops-empty-note">No recent deployments reported (NO DATA).</p> : <div className="table-scroll"><table className="ops-table">
        <thead><tr><th scope="col">Deployment</th><th scope="col">State</th><th scope="col">Created</th><th scope="col">Duration</th><th scope="col">Production</th></tr></thead>
        <tbody>
          {deployments.recent.map((deployment) => <tr key={deployment.deploymentKey}>
            <td title={deployment.deploymentKey}>{deployment.deploymentKey.slice(0, 12)}</td>
            <td><DeploymentStatePill state={deployment.state} /></td>
            <td>{formatMaltaTime(deployment.createdAt)} <span className="ops-age">{formatAge(deployment.createdAt, now)}</span></td>
            <td>{formatDuration(deployment.durationMs)}</td>
            <td>{deployment.isCurrentProduction ? <span className="ops-client-state">CURRENT</span> : "—"}</td>
          </tr>)}
        </tbody>
      </table></div>}
    </div>
  </>;
}

function DomainsSection({ domains, now }: { domains: OperationsVercel["domains"]; now: Date }) {
  if (domains.length === 0) {
    return <p className="ops-empty-note">No domain evidence collected yet (NO DATA).</p>;
  }
  return <div className="table-scroll"><table className="ops-table">
    <thead><tr><th scope="col">Domain</th><th scope="col">Verified</th><th scope="col">Observed</th></tr></thead>
    <tbody>
      {domains.map((domain) => <tr key={domain.domain}>
        <td>{domain.domain}</td>
        <td><BooleanPill value={domain.verified} trueLabel="VERIFIED" falseLabel="UNVERIFIED" /></td>
        <td>{formatMaltaTime(domain.observedAt)} <span className="ops-age">{formatAge(domain.observedAt, now)}</span></td>
      </tr>)}
    </tbody>
  </table></div>;
}

function VercelContent({ data, now }: { data: OperationsVercel; now: Date }) {
  return <div className="page-wrap">
    <header className="page-header">
      <div><p className="eyebrow">OPERATIONS · VERCEL EVIDENCE</p><h1>Vercel analytics</h1><p>Web traffic, deployments, domains and connectivity evidence</p></div>
      <HealthPill status={data.rollupStatus} />
    </header>
    <p className="ops-updated">Generated {formatMaltaTime(data.generatedAt)} <span className="ops-age">{formatAge(data.generatedAt, now)}</span></p>
    <section className="ops-client" aria-labelledby="vercel-traffic">
      <h2 id="vercel-traffic" className="ops-client-title">Traffic (Web Analytics)</h2>
      {data.traffic === null
        ? <p className="ops-empty-note">No traffic evidence collected yet.</p>
        : <TrafficSection traffic={data.traffic} now={now} />}
    </section>
    <section className="ops-client" aria-labelledby="vercel-deployments">
      <h2 id="vercel-deployments" className="ops-client-title">Deployments</h2>
      <DeploymentsSection deployments={data.deployments} now={now} />
    </section>
    <section className="ops-client" aria-labelledby="vercel-domains">
      <h2 id="vercel-domains" className="ops-client-title">Domains</h2>
      <DomainsSection domains={data.domains} now={now} />
    </section>
    <section className="ops-client" aria-labelledby="vercel-connectivity">
      <h2 id="vercel-connectivity" className="ops-client-title">Connectivity</h2>
      <ConnectivityCard connectivity={data.connectivity} now={now} />
    </section>
  </div>;
}
