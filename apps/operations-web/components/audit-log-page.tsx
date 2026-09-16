import Link from "next/link";
import {
  getOperationsAuditEvents,
  OperationsApiError,
  type AuditCategoryFilter,
  type AuditEventsResponse,
} from "../lib/operations-api";
import { formatMaltaTime } from "../lib/operations-time";
import { requireOperationsSession } from "../lib/server-session";
import { OperationsErrorState } from "./operations-error-state";

const categoryFilters: { value: AuditCategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "report_actions", label: "Report actions" },
  { value: "authentication", label: "Authentication" },
  { value: "administrative", label: "Administrative" },
];

const rangeFilters = [
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "all", label: "All" },
] as const;

type RangeFilter = (typeof rangeFilters)[number]["value"];

export interface AuditLogSearchParams {
  category?: string;
  range?: string;
  cursor?: string;
}

interface AuditFilters {
  category: AuditCategoryFilter;
  range: RangeFilter;
  cursor: string | null;
}

function utcDateDaysAgo(days: number, now: Date): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function parseFilters(searchParams: AuditLogSearchParams): AuditFilters {
  const category = categoryFilters.some((f) => f.value === searchParams.category)
    ? (searchParams.category as AuditCategoryFilter)
    : "all";
  const range = rangeFilters.some((f) => f.value === searchParams.range)
    ? (searchParams.range as RangeFilter)
    : "all";
  const cursor = searchParams.cursor && searchParams.cursor.length > 0 ? searchParams.cursor : null;
  return { category, range, cursor };
}

function rangeBounds(range: RangeFilter, now: Date): { from: string | null; to: string | null } {
  if (range === "24h") return { from: utcDateDaysAgo(1, now), to: null };
  if (range === "7d") return { from: utcDateDaysAgo(7, now), to: null };
  if (range === "30d") return { from: utcDateDaysAgo(30, now), to: null };
  return { from: null, to: null };
}

function auditHref(filters: AuditFilters, override: Partial<AuditFilters>): string {
  const next = { ...filters, ...override };
  const params = new URLSearchParams();
  if (next.category !== "all") params.set("category", next.category);
  if (next.range !== "all") params.set("range", next.range);
  if (next.cursor) params.set("cursor", next.cursor);
  const query = params.toString();
  return `/audit-log${query ? `?${query}` : ""}`;
}

const resultPillClass: Record<AuditEventsResponse["events"][number]["result"], string> = {
  success: "green",
  allowed: "green",
  denied: "amber",
  error: "red",
};

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

function AuditLogContent({ data, filters }: { data: AuditEventsResponse; filters: AuditFilters }) {
  return (
    <div className="page-wrap">
      <header className="page-header">
        <div>
          <p className="eyebrow">OPERATIONS · AUDIT LOG</p>
          <h1>Audit log</h1>
          <p>Append-only, read-only history of report actions, authentication and administrative events</p>
        </div>
      </header>
      <p className="ops-updated">Generated {formatMaltaTime(data.generatedAt)}</p>

      <FilterPills
        ariaLabel="Audit category"
        options={categoryFilters}
        current={filters.category}
        hrefFor={(value) => auditHref(filters, { category: value as AuditCategoryFilter, cursor: null })}
      />
      <FilterPills
        ariaLabel="Date range"
        options={[...rangeFilters]}
        current={filters.range}
        hrefFor={(value) => auditHref(filters, { range: value as RangeFilter, cursor: null })}
      />

      {data.events.length === 0 ? (
        <article className="ops-card">
          <p className="ops-empty-note">No audit events have been published yet.</p>
        </article>
      ) : (
        <div className="table-scroll">
          <table className="ops-table">
            <thead>
              <tr>
                <th scope="col">When (Europe/Malta)</th>
                <th scope="col">Actor</th>
                <th scope="col">Action</th>
                <th scope="col">Target</th>
                <th scope="col">Result</th>
                <th scope="col">Reason code</th>
                <th scope="col">Command key</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((event) => (
                <tr key={event.eventKey}>
                  <td><time dateTime={event.occurredAt}>{formatMaltaTime(event.occurredAt)}</time></td>
                  <td>
                    {event.actorType}
                    <span className="ops-sub">{event.actorKey}</span>
                  </td>
                  <td>{event.action}</td>
                  <td>{event.targetType ? `${event.targetType}${event.targetKey ? `: ${event.targetKey}` : ""}` : "—"}</td>
                  <td>
                    <span className={`status-pill ${resultPillClass[event.result] ?? "no-data"}`}>
                      <span />
                      {event.result.toUpperCase()}
                    </span>
                  </td>
                  <td>{event.safeReasonCode ?? "—"}</td>
                  <td>{event.commandKey ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <nav className="window-links" aria-label="Audit log pages">
        {filters.cursor ? <Link href={auditHref(filters, { cursor: null })}>Newer</Link> : null}
        {data.nextCursor ? (
          <Link href={auditHref(filters, { cursor: data.nextCursor })}>Older</Link>
        ) : null}
      </nav>
    </div>
  );
}

const emptyAuditEvents: AuditEventsResponse = {
  generatedAt: "",
  filters: { category: "all", from: null, to: null },
  events: [],
  nextCursor: null,
};

export async function AuditLogPage({ searchParams }: { searchParams: AuditLogSearchParams }) {
  await requireOperationsSession();
  const filters = parseFilters(searchParams);
  const { from, to } = rangeBounds(filters.range, new Date());
  try {
    const data = await getOperationsAuditEvents({
      category: filters.category,
      from: from ?? undefined,
      to: to ?? undefined,
      cursor: filters.cursor ?? undefined,
    });
    return <AuditLogContent data={data} filters={filters} />;
  } catch (error) {
    if (error instanceof OperationsApiError && error.statusCode === 404) {
      return <AuditLogContent data={emptyAuditEvents} filters={filters} />;
    }
    return (
      <div className="page-wrap">
        <header className="page-header">
          <div>
            <p className="eyebrow">OPERATIONS · AUDIT LOG</p>
            <h1>Audit log</h1>
            <p>Append-only, read-only history of report actions, authentication and administrative events</p>
          </div>
        </header>
        <OperationsErrorState error={error} />
      </div>
    );
  }
}
