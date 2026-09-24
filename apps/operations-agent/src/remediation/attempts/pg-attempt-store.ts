/**
 * PgAttemptStore — the durable exactly-once attempt ledger (Programme Phase H).
 *
 * This store is the ONLY durable exactly-once mechanism for Tier A
 * remediation executions: the unique idempotency key lives in PostgreSQL
 * (operations.remediation_attempts.idempotency_key), so replays, concurrent
 * claims and container restarts can never produce a second attempt.
 *
 * Rules (mirroring observer/evidence-source.ts):
 *  - Every statement is parameterized; no string interpolation of inputs.
 *  - Fail closed AND never throw: any database, mapping or input-validation
 *    failure maps to null (claim/finish/get/findByIdempotencyKey) or []
 *    (finalizeStaleRunning). The executor treats a claim failure as
 *    'do not execute'.
 *  - claim() is INSERT ... ON CONFLICT (idempotency_key) DO NOTHING
 *    RETURNING *: exactly one concurrent caller sees a row back.
 *  - finish() is compare-and-set WHERE status = 'RUNNING': finish is
 *    once-only; an already-finished or unknown attempt returns null.
 *  - Rows are append-only audit evidence: there is no delete path anywhere
 *    in this module, matching the migration (0015) grant shape
 *    (SELECT, INSERT, UPDATE only — never DELETE).
 *  - Returned records are frozen and fully validated against the contract's
 *    closed lists; a malformed row maps to null rather than surfacing.
 *  - No sensitive data is logged or embedded in errors; connection config is
 *    injected through pgFactory so tests never touch a real database.
 */

import type { ClientConfig } from 'pg';
import { Client } from 'pg';
import type {
  AttemptResultCode,
  AttemptStatus,
  AttemptStore,
  ClaimAttemptInput,
  FinishAttemptInput,
  RemediationAttemptRecord,
} from '../attempt-contract';
import { REMEDIATION_ATTEMPT_RESULT_CODES } from '../attempt-contract';

export interface PgAttemptStoreOptions {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  queryTimeoutMs?: number;
  pgFactory?: (cfg: object) => PgClientLike;
  /**
   * Optional fallback clock (ms epoch) used only when a caller passes a
   * non-integer nowMs; valid integer nowMs always win so behavior stays
   * deterministic. Without it, an invalid nowMs fails closed (null / []).
   */
  now?: () => number;
}

export interface PgClientLike {
  connect(): Promise<void>;
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  end(): Promise<void>;
}

const DEFAULT_QUERY_TIMEOUT_MS = 10_000;
const KEY_MAX_CHARS = 128;
const ATTEMPT_ID_MAX_CHARS = 64;
const SUMMARY_MAX_CHARS = 200;
const TIMESTAMP_MAX_MS = 8_640_000_000_000; // 2262 ceiling; anything above is garbage
const CONTROL_CHARS = /[\x00-\x1f\x7f]/;
const FALLBACK_SCOPE_KEY = 'unknown';

const CLAIM_QUERY = `
INSERT INTO operations.remediation_attempts (
  attempt_id, runbook_key, runbook_version, target_key, issue_code,
  idempotency_key, status, claimed_at, summary, client_key, environment_key
) VALUES ($1, $2, $3, $4, $5, $6, 'RUNNING', $7, $8, $9, $10)
ON CONFLICT (idempotency_key) DO NOTHING
RETURNING *`;

const FINISH_QUERY = `
UPDATE operations.remediation_attempts
SET status = $2, result_code = $3, summary = $4, finished_at = $5
WHERE attempt_id = $1 AND status = 'RUNNING'
RETURNING *`;

const FINALIZE_STALE_QUERY = `
UPDATE operations.remediation_attempts
SET status = 'FAILED', result_code = 'TIMED_OUT', finished_at = $1
WHERE status = 'RUNNING' AND claimed_at < $2
RETURNING attempt_id`;

const GET_QUERY = `
SELECT * FROM operations.remediation_attempts
WHERE attempt_id = $1`;

const FIND_BY_IDEMPOTENCY_KEY_QUERY = `
SELECT * FROM operations.remediation_attempts
WHERE idempotency_key = $1`;

const STATUSES: readonly AttemptStatus[] = ['RUNNING', 'SUCCEEDED', 'FAILED'];
const RESULT_CODES: readonly string[] = REMEDIATION_ATTEMPT_RESULT_CODES;

interface ResolvedPgAttemptStoreOptions {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  queryTimeoutMs: number;
  pgFactory: (cfg: object) => PgClientLike;
  /** Injected fallback clock; absent means an invalid nowMs fails closed. */
  now: (() => number) | undefined;
}

function resolveOptions(options: PgAttemptStoreOptions): ResolvedPgAttemptStoreOptions {
  if (typeof options?.host !== 'string' || options.host.length === 0) {
    throw new Error('attempt store: host must be a non-empty string');
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) {
    throw new Error('attempt store: port must be an integer between 1 and 65535');
  }
  if (typeof options.database !== 'string' || options.database.length === 0) {
    throw new Error('attempt store: database must be a non-empty string');
  }
  if (typeof options.user !== 'string' || options.user.length === 0) {
    throw new Error('attempt store: user must be a non-empty string');
  }
  if (typeof options.password !== 'string' || options.password.length === 0) {
    throw new Error('attempt store: password must be configured');
  }
  const queryTimeoutMs = options.queryTimeoutMs ?? DEFAULT_QUERY_TIMEOUT_MS;
  if (!(queryTimeoutMs > 0)) {
    throw new Error('attempt store: queryTimeoutMs must be a positive number of milliseconds');
  }
  return {
    host: options.host,
    port: options.port,
    database: options.database,
    user: options.user,
    password: options.password,
    queryTimeoutMs,
    pgFactory:
      options.pgFactory ??
      ((cfg: object): PgClientLike => new Client(cfg as ClientConfig) as unknown as PgClientLike),
    now: options.now,
  };
}

function isSafeKey(value: unknown, maxChars: number): value is string {
  return (
    typeof value === 'string' && value.length > 0 && value.length <= maxChars && !CONTROL_CHARS.test(value)
  );
}

function isValidNowMs(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= TIMESTAMP_MAX_MS;
}

function parseTimestampMs(raw: unknown): number {
  // Real pg returns timestamptz columns as Date objects; accept ISO strings
  // and epoch numbers at the boundary as well.
  let ms: number;
  if (raw instanceof Date) {
    ms = raw.getTime();
  } else if (typeof raw === 'string' && raw.length > 0) {
    ms = Date.parse(raw);
  } else if (typeof raw === 'number' && Number.isFinite(raw)) {
    ms = raw;
  } else {
    throw new Error('attempt row is missing a timestamp');
  }
  if (Number.isNaN(ms) || ms < 0 || ms > TIMESTAMP_MAX_MS) {
    throw new Error('attempt row has an invalid timestamp');
  }
  return ms;
}

function parseNullableTimestampMs(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  return parseTimestampMs(raw);
}

/**
 * Maps one raw operations.remediation_attempts row to the frozen contract
 * record. Throws on ANY deviation from the closed shape — callers catch and
 * map to null so a malformed row can never reach the executor.
 */
function mapAttemptRow(row: Record<string, unknown>): RemediationAttemptRecord {
  if (!isSafeKey(row.attempt_id, ATTEMPT_ID_MAX_CHARS)) throw new Error('invalid attempt_id');
  if (!isSafeKey(row.runbook_key, KEY_MAX_CHARS)) throw new Error('invalid runbook_key');
  if (!isSafeKey(row.runbook_version, KEY_MAX_CHARS)) throw new Error('invalid runbook_version');
  if (!isSafeKey(row.target_key, KEY_MAX_CHARS)) throw new Error('invalid target_key');
  if (!isSafeKey(row.issue_code, KEY_MAX_CHARS)) throw new Error('invalid issue_code');
  if (!isSafeKey(row.idempotency_key, KEY_MAX_CHARS)) throw new Error('invalid idempotency_key');
  if (typeof row.summary !== 'string' || row.summary.length > SUMMARY_MAX_CHARS) {
    throw new Error('invalid summary');
  }
  if (!isSafeKey(row.client_key, KEY_MAX_CHARS)) throw new Error('invalid client_key');
  if (!isSafeKey(row.environment_key, KEY_MAX_CHARS)) throw new Error('invalid environment_key');
  if (typeof row.status !== 'string' || !STATUSES.includes(row.status as AttemptStatus)) {
    throw new Error('invalid status');
  }
  const status = row.status as AttemptStatus;
  let resultCode: AttemptResultCode | null = null;
  if (row.result_code !== null && row.result_code !== undefined) {
    if (typeof row.result_code !== 'string' || !RESULT_CODES.includes(row.result_code)) {
      throw new Error('invalid result_code');
    }
    resultCode = row.result_code as AttemptResultCode;
  }
  const claimedAtMs = parseTimestampMs(row.claimed_at);
  const finishedAtMs = parseNullableTimestampMs(row.finished_at);
  // Lifecycle invariant (mirrors the 0015 table CHECK): RUNNING exactly when
  // unfinished. A row that disagrees is corrupt and must never surface.
  if ((status === 'RUNNING') !== (finishedAtMs === null)) {
    throw new Error('status/finished_at lifecycle mismatch');
  }
  return Object.freeze({
    attemptId: row.attempt_id,
    runbookKey: row.runbook_key,
    runbookVersion: row.runbook_version,
    targetKey: row.target_key,
    issueCode: row.issue_code,
    idempotencyKey: row.idempotency_key,
    status,
    resultCode,
    claimedAtMs,
    finishedAtMs,
    summary: row.summary,
  });
}

function mapSingleRow(rows: Record<string, unknown>[] | undefined): RemediationAttemptRecord | null {
  const row = rows?.[0];
  if (!row) return null;
  return mapAttemptRow(row);
}

export class PgAttemptStore implements AttemptStore {
  private readonly options: ResolvedPgAttemptStoreOptions;

  constructor(options: PgAttemptStoreOptions) {
    this.options = resolveOptions(options);
  }

  async claim(input: ClaimAttemptInput): Promise<RemediationAttemptRecord | null> {
    const nowMs = this.resolveNowMs(input?.nowMs);
    if (nowMs === null) return null;
    if (!isSafeKey(input.attemptId, ATTEMPT_ID_MAX_CHARS)) return null;
    if (!isSafeKey(input.runbookKey, KEY_MAX_CHARS)) return null;
    if (!isSafeKey(input.runbookVersion, KEY_MAX_CHARS)) return null;
    if (!isSafeKey(input.targetKey, KEY_MAX_CHARS)) return null;
    if (!isSafeKey(input.issueCode, KEY_MAX_CHARS)) return null;
    if (!isSafeKey(input.idempotencyKey, KEY_MAX_CHARS)) return null;
    const clientKey = this.scopeKey(input.clientKey);
    const environmentKey = this.scopeKey(input.environmentKey);
    if (clientKey === null || environmentKey === null) return null;
    const summary = 'attempt claimed';
    const rows = await this.runSafely(CLAIM_QUERY, [
      input.attemptId,
      input.runbookKey,
      input.runbookVersion,
      input.targetKey,
      input.issueCode,
      input.idempotencyKey,
      new Date(nowMs),
      summary,
      clientKey,
      environmentKey,
    ]);
    if (rows === null) return null;
    try {
      return mapSingleRow(rows);
    } catch {
      return null;
    }
  }

  async finish(
    attemptId: string,
    input: FinishAttemptInput,
  ): Promise<RemediationAttemptRecord | null> {
    const nowMs = this.resolveNowMs(input?.nowMs);
    if (nowMs === null) return null;
    if (!isSafeKey(attemptId, ATTEMPT_ID_MAX_CHARS)) return null;
    if (input.status !== 'SUCCEEDED' && input.status !== 'FAILED') return null;
    if (typeof input.resultCode !== 'string' || !RESULT_CODES.includes(input.resultCode)) {
      return null;
    }
    if (typeof input.summary !== 'string' || input.summary.length === 0) return null;
    const summary =
      input.summary.length <= SUMMARY_MAX_CHARS
        ? input.summary
        : input.summary.slice(0, SUMMARY_MAX_CHARS);
    const rows = await this.runSafely(FINISH_QUERY, [
      attemptId,
      input.status,
      input.resultCode,
      summary,
      new Date(nowMs),
    ]);
    if (rows === null) return null;
    try {
      return mapSingleRow(rows);
    } catch {
      return null;
    }
  }

  async finalizeStaleRunning(maxAgeMs: number, nowMs: number): Promise<readonly string[]> {
    const resolvedNow = this.resolveNowMs(nowMs);
    if (resolvedNow === null) return [];
    if (!Number.isFinite(maxAgeMs) || maxAgeMs <= 0) return [];
    const cutoffMs = resolvedNow - maxAgeMs;
    if (cutoffMs < 0) return [];
    const rows = await this.runSafely(FINALIZE_STALE_QUERY, [
      new Date(resolvedNow),
      new Date(cutoffMs),
    ]);
    if (rows === null) return [];
    const ids: string[] = [];
    for (const row of rows) {
      if (typeof row.attempt_id === 'string' && row.attempt_id.length <= ATTEMPT_ID_MAX_CHARS) {
        ids.push(row.attempt_id);
      }
    }
    return Object.freeze(ids);
  }

  async get(attemptId: string): Promise<RemediationAttemptRecord | null> {
    if (!isSafeKey(attemptId, ATTEMPT_ID_MAX_CHARS)) return null;
    const rows = await this.runSafely(GET_QUERY, [attemptId]);
    return this.mapSafely(rows);
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<RemediationAttemptRecord | null> {
    if (!isSafeKey(idempotencyKey, KEY_MAX_CHARS)) return null;
    const rows = await this.runSafely(FIND_BY_IDEMPOTENCY_KEY_QUERY, [idempotencyKey]);
    return this.mapSafely(rows);
  }

  private scopeKey(value: string | undefined): string | null {
    if (value === undefined) return FALLBACK_SCOPE_KEY;
    return isSafeKey(value, KEY_MAX_CHARS) ? value : null;
  }

  private resolveNowMs(value: unknown): number | null {
    if (isValidNowMs(value)) return value;
    if (this.options.now === undefined) return null;
    const fallback = this.options.now();
    return isValidNowMs(fallback) ? fallback : null;
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

  /**
   * Runs one statement on a fresh injected client. Returns the rows, or null
   * when ANYTHING failed — the caller maps null to its contract-level
   * "no-op" result. Never throws.
   */
  private async runSafely(
    text: string,
    values: unknown[],
  ): Promise<Record<string, unknown>[] | null> {
    const client = this.options.pgFactory(this.pgConfig());
    try {
      await client.connect();
      const result = await client.query(text, values);
      return result.rows;
    } catch {
      return null;
    } finally {
      try {
        await client.end();
      } catch {
        // A disconnect failure after a successful statement is harmless here:
        // rows are already in hand; the ledger state in PostgreSQL is what
        // matters, not the pooled connection.
      }
    }
  }

  private mapSafely(rows: Record<string, unknown>[] | null): RemediationAttemptRecord | null {
    if (rows === null) return null;
    try {
      return mapSingleRow(rows);
    } catch {
      return null;
    }
  }
}

export function createPgAttemptStore(options: PgAttemptStoreOptions): AttemptStore {
  return new PgAttemptStore(options);
}
