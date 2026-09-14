import type { HealthStatus } from "../lib/operations-api";

const pillClass: Record<HealthStatus, string> = {
  GREEN: "green",
  AMBER: "amber",
  RED: "red",
  NO_DATA: "no-data",
  UNKNOWN: "no-data",
};

const pillText: Record<HealthStatus, string> = {
  GREEN: "GREEN",
  AMBER: "AMBER",
  RED: "RED",
  NO_DATA: "NO DATA",
  UNKNOWN: "UNKNOWN",
};

export function HealthPill({ status }: { status: HealthStatus }) {
  return (
    <span className={`status-pill ${pillClass[status] ?? "no-data"}`}>
      <span />
      {pillText[status] ?? "UNKNOWN"}
    </span>
  );
}

export function BooleanPill({
  value,
  trueLabel,
  falseLabel,
}: {
  value: boolean | null;
  trueLabel: string;
  falseLabel: string;
}) {
  const className = value === null ? "no-data" : value ? "green" : "red";
  const label = value === null ? "NO DATA" : value ? trueLabel : falseLabel;
  return (
    <span className={`status-pill ${className}`}>
      <span />
      {label}
    </span>
  );
}
