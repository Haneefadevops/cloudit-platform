const maltaFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Malta",
  dateStyle: "medium",
  timeStyle: "medium",
});

export const MALTA_TZ_LABEL = "Europe/Malta";

export function formatMaltaTime(iso: string | null | undefined): string {
  if (!iso) return "NO DATA";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "NO DATA";
  return `${maltaFormatter.format(date)} (${MALTA_TZ_LABEL})`;
}

export function formatAge(iso: string | null | undefined, now: Date): string {
  if (!iso) return "NO DATA";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "NO DATA";
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return "NO DATA";
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}m ${rest}s`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "NO DATA";
  return `${Math.round(value)}%`;
}

export function formatSlaSeconds(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return "NO DATA";
  if (seconds % 60 === 0) return `${seconds / 60} minutes (${seconds}s)`;
  return `${seconds} seconds`;
}
