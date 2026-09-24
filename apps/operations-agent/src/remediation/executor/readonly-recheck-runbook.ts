/**
 * Frozen executable runbook contract for RB-READONLY-RECHECK-001 (Phase H,
 * first Tier A activated runbook).
 *
 * When deterministic supervision reports a non-critical evidence source as
 * stale/unknown, the runbook re-runs ONE read-only freshness re-check for
 * exactly that source via the existing read-only evidence port, then
 * independently verifies and records an append-only attempt. Zero external
 * side effects by construction.
 *
 * Everything on this contract is a closed enum or fixed safe text. Summary
 * templates are parameterized ONLY by target key and UTC calendar day —
 * never by evidence free text (no safeSummary passthrough).
 */

export const READONLY_RECHECK_RUNBOOK_KEY = 'RB-READONLY-RECHECK-001';
export const READONLY_RECHECK_RUNBOOK_VERSION = '1';
export const READONLY_RECHECK_RUNBOOK_TIER = 'A';

export const READONLY_RECHECK_ACCEPTED_ISSUE_CODES = [
  'STATUS_UNKNOWN',
  'EVIDENCE_STALE',
] as const;
export type ReadonlyRecheckIssueCode = (typeof READONLY_RECHECK_ACCEPTED_ISSUE_CODES)[number];

export const READONLY_RECHECK_ALLOWED_TARGETS = [
  'vercel-analytics',
  'imagekit-delivery',
] as const;
export type ReadonlyRecheckTargetKey = (typeof READONLY_RECHECK_ALLOWED_TARGETS)[number];

export const READONLY_RECHECK_EXPECTED_RESULT_CODES = [
  'RECOVERED',
  'CONFIRMED_STALE',
  'SOURCE_FAILED',
] as const;
export type ReadonlyRecheckResultCode = (typeof READONLY_RECHECK_EXPECTED_RESULT_CODES)[number];

/** At most one automatic attempt per (runbook, target, UTC day). */
export const READONLY_RECHECK_MAX_AUTOMATIC_ATTEMPTS = 1;

/** Upper bound for each bounded evidence read (recheck and verification). */
export const READONLY_RECHECK_TIMEOUT_MS = 10_000;

export const READONLY_RECHECK_PRECONDITIONS: readonly string[] = Object.freeze([
  'Deterministic supervision reported the target source as stale or unknown.',
  'The target source is a non-critical (analytics) evidence source.',
  'The per-runbook enable flag and the auto-remediation kill switch are both on.',
  'The circuit breaker is closed and no attempt was claimed for this UTC day.',
]);

export const READONLY_RECHECK_EXPECTED_IMPACT: string =
  'The freshness of one read-only evidence source is re-checked and independently ' +
  'verified; the append-only attempt record is the only durable effect.';

export const READONLY_RECHECK_VERIFICATION: readonly string[] = Object.freeze([
  'The recheck classification equals the independent verification classification.',
  'Exactly one attempt record exists for the idempotency key of this UTC day.',
  'No evidence payload, free text or provider value appears in any summary.',
]);

export const READONLY_RECHECK_ROLLBACK: readonly string[] = Object.freeze([
  'No mutation was performed; rollback is a no-op.',
]);

export const READONLY_RECHECK_SUMMARY_MAX_CHARS = 200;

/**
 * Fixed result-code-safe summary template. Parameterized only by the closed
 * target key, the UTC calendar day and the closed result code — the longest
 * possible value stays well under 200 characters.
 */
export function buildReadonlyRecheckSummary(
  targetKey: string,
  idempotencyDayUtc: string,
  resultCode: string,
): string {
  let summary = `${READONLY_RECHECK_RUNBOOK_KEY} target=${targetKey} day=${idempotencyDayUtc} result=${resultCode}`;
  if (summary.length > READONLY_RECHECK_SUMMARY_MAX_CHARS) {
    summary = summary.slice(0, READONLY_RECHECK_SUMMARY_MAX_CHARS);
  }
  return summary;
}

/** Fixed safe summary for gate denials that fire before any attempt exists. */
export function buildReadonlyRecheckGateSummary(reason: string): string {
  let summary = `${READONLY_RECHECK_RUNBOOK_KEY} gate=${reason}`;
  if (summary.length > READONLY_RECHECK_SUMMARY_MAX_CHARS) {
    summary = summary.slice(0, READONLY_RECHECK_SUMMARY_MAX_CHARS);
  }
  return summary;
}

export const READONLY_RECHECK_RUNBOOK = Object.freeze({
  runbookKey: READONLY_RECHECK_RUNBOOK_KEY,
  version: READONLY_RECHECK_RUNBOOK_VERSION,
  tier: READONLY_RECHECK_RUNBOOK_TIER,
  acceptedIssueCodes: READONLY_RECHECK_ACCEPTED_ISSUE_CODES,
  allowedTargets: READONLY_RECHECK_ALLOWED_TARGETS,
  expectedResultCodes: READONLY_RECHECK_EXPECTED_RESULT_CODES,
  maxAutomaticAttempts: READONLY_RECHECK_MAX_AUTOMATIC_ATTEMPTS,
  timeoutMs: READONLY_RECHECK_TIMEOUT_MS,
  preconditions: READONLY_RECHECK_PRECONDITIONS,
  expectedImpact: READONLY_RECHECK_EXPECTED_IMPACT,
  verification: READONLY_RECHECK_VERIFICATION,
  rollback: READONLY_RECHECK_ROLLBACK,
});
