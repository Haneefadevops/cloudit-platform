/**
 * EvidenceSource - bounded, SELECT-only reader that turns raw operations-DB
 * evidence rows into a supervisor-ready SanitizedEvidenceProjection.
 *
 * Rules:
 *  - Every statement is a SELECT on operations_reader-granted tables
 *    (defence in depth on top of the DB role). Queries are parameterized by
 *    (clientKey, environmentKey) and bounded by maxRowsPerFamily.
 *  - Fail closed: any database, parsing or disconnect error rejects read()
 *    with a bounded, credential-free message. A family with no rows is
 *    omitted entirely; the supervisor reports missing required sources.
 *  - No raw payload column ever reaches a record: safeSummary is synthesized
 *    from fixed vocabulary plus a row count only.
 *  - status mapping GREEN->OK, AMBER->DEGRADED, RED->FAILED, everything else
 *    (UNKNOWN/NO_DATA/null) -> UNKNOWN. Severity passes through when it is
 *    one of none/info/warning/critical; otherwise DEGRADED->warning,
 *    FAILED->critical, OK->none.
 *  - Aggregation within a family (and across families that share a
 *    sourceKey, e.g. postgresql.* metrics and the supabase provider
 *    connection both map to 'database') is worst-of: FAILED outranks UNKNOWN,
 *    UNKNOWN outranks DEGRADED (an unobservable source hides failures), and
 *    DEGRADED outranks OK; severity, latest observedAt and latest freshUntil
 *    follow the same max rule.
 *  - freshUntil = observed_at + metric_definitions.freshness_seconds for
 *    metric samples when resolvable; every other family (including
 *    backups-daily) uses observed_at + 24h.
 */

import type { ClientConfig } from 'pg';
import { Client } from 'pg';
import type { Severity } from '@cloudit/operations-agent-contracts';
import { ENVIRONMENT_KEY_PATTERN } from '@cloudit/operations-agent-contracts';
import type {
  EvidenceSourceRecord,
  EvidenceSourceStatus,
  SanitizedEvidenceProjection,
  SourceCriticality,
} from '../supervisor';

export interface EvidenceSourceOptions {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  queryTimeoutMs?: number;
  maxRowsPerFamily?: number;
  pgFactory?: (cfg: object) => PgClientLike;
  now?: () => number;
}

export interface PgClientLike {
  connect(): Promise<void>;
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  end(): Promise<void>;
}

/**
 * Reads the latest evidence rows (bounded, SELECT-only) and returns a
 * supervisor-ready SanitizedEvidenceProjection for (clientKey, environmentKey).
 * Rejects on ANY database error — fail closed; the caller maps a rejection
 * to an all-UNKNOWN assessment path. Never returns silently partial data
 * for a family it claims to cover.
 */
export interface EvidenceSource {
  read(clientKey: string, environmentKey: string): Promise<unknown>;
}

const DEFAULT_QUERY_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_ROWS_PER_FAMILY = 5;
const DEFAULT_FRESHNESS_MS = 24 * 60 * 60 * 1000;
// The maintenance report is a MONTHLY artifact (generated ~a week into the
// month, then manually approved and sent - see the portal docs), so a 24h
// window made every legitimate report read stale the day after sending and
// pinned the verdict at RED. 45 days tolerates the approval gap while still
// flagging a genuinely missing cycle (>6 weeks without a report).
const REPORTS_FRESHNESS_MS = 45 * 24 * 60 * 60 * 1000;
const SAFE_SUMMARY_MAX_CHARS = 200;
const OBSERVED_AT_MAX_MS = 8_640_000_000_000; // 2262 ceiling; anything above is garbage
const CLIENT_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

const STATUS_RANK: Record<EvidenceSourceStatus, number> = {
  OK: 0,
  DEGRADED: 1,
  UNKNOWN: 2,
  FAILED: 3,
};
const STATUS_BY_RANK: readonly EvidenceSourceStatus[] = ['OK', 'DEGRADED', 'UNKNOWN', 'FAILED'];

const SEVERITY_RANK: Record<Severity, number> = { none: 0, info: 1, warning: 2, critical: 3 };
const SEVERITY_BY_RANK: readonly Severity[] = ['none', 'info', 'warning', 'critical'];
const KNOWN_SEVERITIES = new Set<string>(SEVERITY_BY_RANK);

const CRITICALITY_BY_SOURCE_KEY: Record<string, SourceCriticality> = {
  'public-website': 'required',
  'public-api': 'required',
  database: 'required',
  incidents: 'required',
  'backups-daily': 'required',
  'restore-test': 'required',
  'n8n-workflows': 'required',
  'maintenance-report': 'required',
  'vercel-analytics': 'analytics',
  'imagekit-delivery': 'analytics',
};

const ENDPOINT_OBSERVATIONS_QUERY = `
SELECT eo.status, eo.severity, eo.observed_at,
       e.endpoint_key, e.display_name, e.registered_path
FROM operations.endpoint_observations eo
JOIN operations.endpoints e ON e.id = eo.endpoint_id AND e.client_id = eo.client_id
JOIN operations.clients c ON c.id = eo.client_id
JOIN operations.environments en ON en.client_id = c.id AND en.id = eo.environment_id
WHERE c.client_key = $1 AND en.environment_key = $2
ORDER BY eo.observed_at DESC
LIMIT $3`;

const METRIC_SAMPLES_QUERY = `
SELECT ms.status, ms.severity, ms.observed_at, md.metric_key, md.freshness_seconds
FROM operations.metric_samples ms
JOIN operations.metric_definitions md ON md.id = ms.metric_definition_id AND md.client_id = ms.client_id
JOIN operations.clients c ON c.id = ms.client_id
LEFT JOIN operations.environments en ON en.client_id = c.id AND en.id = ms.environment_id
WHERE c.client_key = $1 AND (en.environment_key = $2 OR ms.environment_id IS NULL)
ORDER BY ms.observed_at DESC
LIMIT $3`;

const INCIDENTS_QUERY = `
SELECT i.status_color, i.severity_echo, i.observed_at
FROM operations.incidents i
JOIN operations.clients c ON c.id = i.client_id
LEFT JOIN operations.environments en ON en.client_id = c.id AND en.id = i.environment_id
WHERE c.client_key = $1 AND (en.environment_key = $2 OR i.environment_id IS NULL)
ORDER BY i.observed_at DESC
LIMIT $3`;

const BACKUP_EVIDENCE_QUERY = `
SELECT be.status, be.severity, be.observed_at
FROM operations.backup_evidence be
JOIN operations.clients c ON c.id = be.client_id
JOIN operations.environments en ON en.client_id = c.id AND en.id = be.environment_id
WHERE c.client_key = $1 AND en.environment_key = $2
ORDER BY be.observed_at DESC
LIMIT $3`;

const RESTORE_TESTS_QUERY = `
SELECT rt.status, rt.severity, rt.observed_at
FROM operations.restore_tests rt
JOIN operations.clients c ON c.id = rt.client_id
JOIN operations.environments en ON en.client_id = c.id AND en.id = rt.environment_id
WHERE c.client_key = $1 AND en.environment_key = $2
ORDER BY rt.observed_at DESC
LIMIT $3`;

const WORKFLOW_EXECUTIONS_QUERY = `
SELECT we.status, we.severity, we.observed_at
FROM operations.workflow_executions we
JOIN operations.clients c ON c.id = we.client_id
JOIN operations.environments en ON en.client_id = c.id AND en.id = we.environment_id
WHERE c.client_key = $1 AND en.environment_key = $2
ORDER BY we.observed_at DESC
LIMIT $3`;

const REPORTS_QUERY = `
SELECT r.status, r.severity, r.observed_at,
       f.status_color AS finding_status, f.severity_echo AS finding_severity
FROM operations.reports r
LEFT JOIN operations.report_findings f ON f.report_id = r.id AND f.client_id = r.client_id
JOIN operations.clients c ON c.id = r.client_id
LEFT JOIN operations.environments en ON en.client_id = c.id AND en.id = r.environment_id
WHERE c.client_key = $1 AND (en.environment_key = $2 OR r.environment_id IS NULL)
ORDER BY r.observed_at DESC
LIMIT $3`;

const PROVIDER_CONNECTIONS_QUERY = `
SELECT pc.provider, pc.status, pc.severity, pc.observed_at
FROM operations.provider_connections pc
JOIN operations.clients c ON c.id = pc.client_id
LEFT JOIN operations.environments en ON en.client_id = c.id AND en.id = pc.environment_id
WHERE c.client_key = $1 AND (en.environment_key = $2 OR pc.environment_id IS NULL)
ORDER BY pc.observed_at DESC
LIMIT $3`;

const FAMILY_QUERIES = [
  ENDPOINT_OBSERVATIONS_QUERY,
  METRIC_SAMPLES_QUERY,
  INCIDENTS_QUERY,
  BACKUP_EVIDENCE_QUERY,
  RESTORE_TESTS_QUERY,
  WORKFLOW_EXECUTIONS_QUERY,
  REPORTS_QUERY,
  PROVIDER_CONNECTIONS_QUERY,
] as const;

interface ResolvedEvidenceSourceOptions {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  queryTimeoutMs: number;
  maxRowsPerFamily: number;
  pgFactory: (cfg: object) => PgClientLike;
}

interface FamilyAccumulator {
  rank: number;
  severityRank: number;
  observedAtMs: number;
  freshUntilMs: number;
  samples: number;
}

function resolveOptions(options: EvidenceSourceOptions): ResolvedEvidenceSourceOptions {
  if (typeof options?.host !== 'string' || options.host.length === 0) {
    throw new Error('evidence source: host must be a non-empty string');
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    throw new Error('evidence source: port must be an integer between 1 and 65535');
  }
  if (typeof options.database !== 'string' || options.database.length === 0) {
    throw new Error('evidence source: database must be a non-empty string');
  }
  if (typeof options.user !== 'string' || options.user.length === 0) {
    throw new Error('evidence source: user must be a non-empty string');
  }
  if (typeof options.password !== 'string' || options.password.length === 0) {
    throw new Error('evidence source: password must be configured');
  }
  const queryTimeoutMs = options.queryTimeoutMs ?? DEFAULT_QUERY_TIMEOUT_MS;
  if (!(queryTimeoutMs > 0)) {
    throw new Error('evidence source: queryTimeoutMs must be a positive number of milliseconds');
  }
  const maxRowsPerFamily = options.maxRowsPerFamily ?? DEFAULT_MAX_ROWS_PER_FAMILY;
  if (!Number.isInteger(maxRowsPerFamily) || maxRowsPerFamily <= 0) {
    throw new Error('evidence source: maxRowsPerFamily must be a positive integer');
  }
  return {
    host: options.host,
    port: options.port,
    database: options.database,
    user: options.user,
    password: options.password,
    queryTimeoutMs,
    maxRowsPerFamily,
    pgFactory:
      options.pgFactory ??
      ((cfg: object): PgClientLike => new Client(cfg as ClientConfig) as unknown as PgClientLike),
  };
}

function mapStatus(raw: unknown): EvidenceSourceStatus {
  if (raw === 'GREEN') return 'OK';
  if (raw === 'AMBER') return 'DEGRADED';
  if (raw === 'RED') return 'FAILED';
  return 'UNKNOWN';
}

function mapSeverity(raw: unknown, status: EvidenceSourceStatus): Severity {
  if (typeof raw === 'string' && KNOWN_SEVERITIES.has(raw)) {
    return raw as Severity;
  }
  if (status === 'FAILED') return 'critical';
  if (status === 'DEGRADED') return 'warning';
  return 'none';
}

function parseObservedAtMs(raw: unknown): number {
  // Real pg returns timestamptz columns as Date objects; the projection
  // validator wants ISO strings. Accept both at the boundary.
  let ms: number;
  if (raw instanceof Date) {
    ms = raw.getTime();
  } else if (typeof raw === 'string' && raw.length > 0) {
    ms = Date.parse(raw);
  } else {
    throw new Error('evidence row is missing observed_at');
  }
  if (Number.isNaN(ms) || ms < 0 || ms > OBSERVED_AT_MAX_MS) {
    throw new Error('evidence row has an invalid observed_at');
  }
  return ms;
}

function freshnessMsFor(row: Record<string, unknown>): number {
  const seconds = row.freshness_seconds;
  if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000;
  }
  return DEFAULT_FRESHNESS_MS;
}

/**
 * Endpoint classification rule: the endpoints table carries no url/type
 * column, so an endpoint is the public API when its endpoint_key,
 * display_name or registered_path mentions "api" (e.g. cavetta.public_api)
 * or when it is registered without a path (bare-host API such as the
 * Supabase REST endpoint); every other endpoint is the public website.
 */
function endpointSourceKey(row: Record<string, unknown>): 'public-api' | 'public-website' {
  const haystack = `${row.endpoint_key ?? ''} ${row.display_name ?? ''} ${row.registered_path ?? ''}`;
  if (row.registered_path === null || /api/i.test(haystack)) return 'public-api';
  return 'public-website';
}

function metricSourceKey(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  if (raw.startsWith('postgresql.')) return 'database';
  if (raw.startsWith('vercel.')) return 'vercel-analytics';
  if (raw.startsWith('imagekit.')) return 'imagekit-delivery';
  return undefined;
}

/**
 * Provider connection families: supabase is the platform database/backup
 * provider; the vercel/imagekit provider_connection rows evidence the
 * analytics/delivery sources alongside their metric samples (worst-of
 * merge). Anything else (e.g. github) is not part of the contracted
 * catalogue and is omitted.
 */
function providerSourceKey(raw: unknown): string | undefined {
  if (raw === 'supabase') return 'database';
  if (raw === 'vercel') return 'vercel-analytics';
  if (raw === 'imagekit') return 'imagekit-delivery';
  return undefined;
}

function buildSafeSummary(sourceKey: string, status: EvidenceSourceStatus, samples: number): string {
  const summary = `${sourceKey} ${status.toLowerCase()}, ${samples} sample(s)`;
  return summary.length <= SAFE_SUMMARY_MAX_CHARS
    ? summary
    : `${sourceKey} ${status.toLowerCase()}`.slice(0, SAFE_SUMMARY_MAX_CHARS);
}

class EvidenceSourceImpl implements EvidenceSource {
  constructor(private readonly options: ResolvedEvidenceSourceOptions) {}

  async read(clientKey: string, environmentKey: string): Promise<unknown> {
    this.assertKeys(clientKey, environmentKey);
    const client = this.options.pgFactory(this.pgConfig());
    try {
      await client.connect();
      const values = [clientKey, environmentKey, this.options.maxRowsPerFamily];
      const results = await Promise.all(
        FAMILY_QUERIES.map((text) => client.query(text, values)),
      );
      return this.buildProjection(
        clientKey,
        environmentKey,
        results.map((result) => result.rows),
      );
    } catch (error) {
      throw this.toBoundedError(error);
    } finally {
      try {
        await client.end();
      } catch (endError) {
        // A bare disconnect failure after a successful read still fails closed.
        throw this.toBoundedError(endError);
      }
    }
  }

  private assertKeys(clientKey: string, environmentKey: string): void {
    if (typeof clientKey !== 'string' || !CLIENT_KEY_PATTERN.test(clientKey)) {
      throw this.toBoundedError(new Error('invalid client key'));
    }
    if (typeof environmentKey !== 'string' || !ENVIRONMENT_KEY_PATTERN.test(environmentKey)) {
      throw this.toBoundedError(new Error('invalid environment key'));
    }
  }

  private pgConfig(): object {
    return {
      host: this.options.host,
      port: this.options.port,
      database: this.options.database,
      user: this.options.user,
      password: this.options.password,
      connectionTimeoutMillis: this.options.queryTimeoutMs,
      statement_timeout: this.options.queryTimeoutMs,
    };
  }

  private toBoundedError(error: unknown): Error {
    const raw = error instanceof Error ? error.message : String(error);
    const safe = raw.split(this.options.password).join('[redacted]').replace(/[\r\n\t]/g, ' ');
    return new Error(`evidence read failed: ${safe}`.slice(0, 200));
  }

  private buildProjection(
    clientKey: string,
    environmentKey: string,
    familyRows: Record<string, unknown>[][],
  ): SanitizedEvidenceProjection {
    const accumulators = new Map<string, FamilyAccumulator>();

    const add = (
      sourceKey: string,
      status: EvidenceSourceStatus,
      severity: Severity,
      observedAtMs: number,
      freshUntilMs: number,
    ): void => {
      const acc: FamilyAccumulator = accumulators.get(sourceKey) ?? {
        rank: 0,
        severityRank: 0,
        observedAtMs: 0,
        freshUntilMs: 0,
        samples: 0,
      };
      acc.rank = Math.max(acc.rank, STATUS_RANK[status]);
      acc.severityRank = Math.max(acc.severityRank, SEVERITY_RANK[severity]);
      acc.observedAtMs = Math.max(acc.observedAtMs, observedAtMs);
      acc.freshUntilMs = Math.max(acc.freshUntilMs, freshUntilMs);
      acc.samples += 1;
      accumulators.set(sourceKey, acc);
    };

    const ingest = (
      rows: Record<string, unknown>[],
      sourceKeyOf: (row: Record<string, unknown>) => string | undefined,
      statusField: string,
      severityField: string | undefined,
      freshness: (row: Record<string, unknown>) => number,
    ): void => {
      for (const row of rows) {
        const sourceKey = sourceKeyOf(row);
        if (sourceKey === undefined) continue;
        const status = mapStatus(row[statusField]);
        const severity = severityField
          ? mapSeverity(row[severityField], status)
          : mapSeverity(undefined, status);
        const observedAtMs = parseObservedAtMs(row.observed_at);
        add(sourceKey, status, severity, observedAtMs, observedAtMs + freshness(row));
      }
    };

    ingest(familyRows[0], endpointSourceKey, 'status', 'severity', () => DEFAULT_FRESHNESS_MS);
    ingest(familyRows[1], (row) => metricSourceKey(row.metric_key), 'status', 'severity', freshnessMsFor);
    ingest(familyRows[2], () => 'incidents', 'status_color', 'severity_echo', () => DEFAULT_FRESHNESS_MS);
    ingest(familyRows[3], () => 'backups-daily', 'status', 'severity', () => DEFAULT_FRESHNESS_MS);
    ingest(familyRows[4], () => 'restore-test', 'status', 'severity', () => DEFAULT_FRESHNESS_MS);
    ingest(familyRows[5], () => 'n8n-workflows', 'status', 'severity', () => DEFAULT_FRESHNESS_MS);
    ingest(familyRows[6], () => 'maintenance-report', 'status', 'severity', () => REPORTS_FRESHNESS_MS);
    ingest(familyRows[7], (row) => providerSourceKey(row.provider), 'status', 'severity', () => DEFAULT_FRESHNESS_MS);

    // Findings ride along on report rows and can worsen the family verdict.
    for (const row of familyRows[6]) {
      if (row.finding_status === null || row.finding_status === undefined) continue;
      const status = mapStatus(row.finding_status);
      const severity = mapSeverity(row.finding_severity, status);
      const observedAtMs = parseObservedAtMs(row.observed_at);
      add('maintenance-report', status, severity, observedAtMs, observedAtMs + REPORTS_FRESHNESS_MS);
    }

    const records: EvidenceSourceRecord[] = [];
    for (const [sourceKey, acc] of accumulators) {
      const status = STATUS_BY_RANK[acc.rank];
      const criticality = CRITICALITY_BY_SOURCE_KEY[sourceKey] ?? 'optional';
      records.push({
        sourceKey,
        status,
        severity: SEVERITY_BY_RANK[acc.severityRank],
        observedAt: new Date(acc.observedAtMs).toISOString(),
        freshUntil: new Date(acc.freshUntilMs).toISOString(),
        criticality,
        safeSummary: buildSafeSummary(sourceKey, status, acc.samples),
        counts: { samples: acc.samples },
      });
    }

    return { client: clientKey, environment: environmentKey, records };
  }
}

export function createEvidenceSource(options: EvidenceSourceOptions): EvidenceSource {
  return new EvidenceSourceImpl(resolveOptions(options));
}
