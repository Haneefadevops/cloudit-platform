import type { AiFindingProjection } from "../../lib/ai-maintenance-types";
import { formatMaltaTime } from "../../lib/operations-time";
import { HealthPill } from "../status-pill";

function severityPillClass(severity: string): string {
  const normalized = severity.toUpperCase();
  if (normalized === "CRITICAL" || normalized === "HIGH" || normalized === "RED") return "red";
  if (normalized === "MEDIUM" || normalized === "WARNING" || normalized === "AMBER") return "amber";
  if (normalized === "LOW" || normalized === "INFO" || normalized === "GREEN") return "green";
  return "no-data";
}

export function SeverityPill({ severity }: { severity: string }) {
  const label = severity.trim().length > 0 ? severity.toUpperCase() : "UNKNOWN";
  return (
    <span className={`status-pill ${severityPillClass(severity)}`}>
      <span />
      {label}
    </span>
  );
}

export function AiFindingRow({ finding }: { finding: AiFindingProjection }) {
  return (
    <tr>
      <td><SeverityPill severity={finding.severity} /></td>
      <td>{finding.safeTitle}</td>
      <td><HealthPill status={finding.assessment} /></td>
      <td>{finding.confidence}</td>
      <td>{finding.issueCode}</td>
      <td>{finding.recommendedRunbook}</td>
      <td>{finding.model}</td>
      <td><time dateTime={finding.explainedAt}>{formatMaltaTime(finding.explainedAt)}</time></td>
    </tr>
  );
}
