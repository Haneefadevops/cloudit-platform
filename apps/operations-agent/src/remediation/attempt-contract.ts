/**
 * Durable remediation-attempt contract (Programme Phase H).
 *
 * A remediation attempt is the immutable record of exactly one execution of
 * an allowlisted Tier A runbook. The attempt store is the ONLY durable
 * exactly-once mechanism: the unique idempotency key lives in PostgreSQL, so
 * replays, concurrent claims and container restarts can never produce a
 * second attempt for the same logical repair.
 *
 * Coordinator-owned seam: Worker A (store + migration) and Worker B
 * (executor) both build against this exact file. Changes require
 * coordinator sign-off.
 */

export const REMEDIATION_ATTEMPT_RESULT_CODES = [
  'RECOVERED',
  'CONFIRMED_STALE',
  'SOURCE_FAILED',
  'PRECONDITION_FAILED',
  'BLOCKED_KILL_SWITCH',
  'TIMED_OUT',
  'INTERNAL_ERROR',
] as const;

export type AttemptResultCode = (typeof REMEDIATION_ATTEMPT_RESULT_CODES)[number];

export type AttemptStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface RemediationAttemptRecord {
  readonly attemptId: string;
  readonly runbookKey: string;
  readonly runbookVersion: string;
  readonly targetKey: string;
  readonly issueCode: string;
  readonly idempotencyKey: string;
  readonly status: AttemptStatus;
  readonly resultCode: AttemptResultCode | null;
  readonly claimedAtMs: number;
  readonly finishedAtMs: number | null;
  readonly summary: string;
}

export interface ClaimAttemptInput {
  readonly attemptId: string;
  readonly runbookKey: string;
  readonly runbookVersion: string;
  readonly targetKey: string;
  readonly issueCode: string;
  readonly idempotencyKey: string;
  readonly nowMs: number;
  /**
   * Tenant scoping stored on the durable row (Worker A addition, Phase H):
   * the migration's client_key/environment_key columns are NOT NULL. Optional
   * so existing callers keep compiling; the store persists them verbatim and
   * falls back to 'unknown' when absent.
   */
  readonly clientKey?: string;
  readonly environmentKey?: string;
}

export type FinishAttemptStatus = 'SUCCEEDED' | 'FAILED';

export interface FinishAttemptInput {
  readonly status: FinishAttemptStatus;
  readonly resultCode: AttemptResultCode;
  readonly summary: string;
  readonly nowMs: number;
}

/**
 * Durable, append-only attempt store. Implementations must be safe to call
 * concurrently; claim() must be atomic exactly-once (INSERT ... ON CONFLICT
 * DO NOTHING or equivalent).
 */
export interface AttemptStore {
  /**
   * Atomically claims a new attempt. Returns the stored record when this
   * caller won the claim; returns null when the idempotency key already
   * exists (replay or concurrent claim). Never throws.
   */
  claim(input: ClaimAttemptInput): Promise<RemediationAttemptRecord | null>;

  /**
   * Finishes a RUNNING attempt exactly once. Returns the updated record, or
   * null when the attempt is unknown or no longer RUNNING. Never throws.
   */
  finish(attemptId: string, input: FinishAttemptInput): Promise<RemediationAttemptRecord | null>;

  /**
   * Boot recovery: marks RUNNING attempts older than maxAgeMs as FAILED /
   * TIMED_OUT so a crash mid-attempt can never be resumed or re-executed.
   * Returns the affected attempt ids. Never throws.
   */
  finalizeStaleRunning(maxAgeMs: number, nowMs: number): Promise<readonly string[]>;

  get(attemptId: string): Promise<RemediationAttemptRecord | null>;

  findByIdempotencyKey(idempotencyKey: string): Promise<RemediationAttemptRecord | null>;
}

export const ATTEMPT_STORE = Symbol('ATTEMPT_STORE');
