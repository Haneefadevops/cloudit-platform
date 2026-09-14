import { formatAge, formatMaltaTime } from "../lib/operations-time";
import { BooleanPill } from "./status-pill";

export interface ConnectivityEvidence {
  reachable: boolean | null;
  lastSuccessfulAt: string | null;
  failureCategory: string | null;
}

export function ConnectivityCard({ connectivity, now }: { connectivity: ConnectivityEvidence; now: Date }) {
  return (
    <article className="ops-card">
      <div className="ops-card-head">
        <h3>Connectivity</h3>
        <BooleanPill value={connectivity.reachable} trueLabel="REACHABLE" falseLabel="UNREACHABLE" />
      </div>
      <dl className="ops-def-list">
        <div>
          <dt>Last successful collection</dt>
          <dd>
            {formatMaltaTime(connectivity.lastSuccessfulAt)}{" "}
            <span className="ops-age">{formatAge(connectivity.lastSuccessfulAt, now)}</span>
          </dd>
        </div>
        <div>
          <dt>Failure category</dt>
          <dd className={connectivity.failureCategory ? "ops-failure" : undefined}>
            {connectivity.failureCategory ?? "None recorded"}
          </dd>
        </div>
      </dl>
    </article>
  );
}
