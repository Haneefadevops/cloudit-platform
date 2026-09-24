/**
 * Frozen executable runbook contract for RB-INCIDENT-RECOVERY-VERIFY-001
 * (Phase H runbook 2 — independent recovery verification).
 *
 * When the alert engine declares a subject recovered, this runbook
 * independently verifies the recovery against real read-only evidence before
 * it is durably trusted: TWO bounded reads through the existing read-only
 * evidence port must agree on the classification of every checked source.
 * A checked source is healthy only when its status is 'OK' AND its
 * freshUntil is still in the future. All checked sources healthy (both reads
 * agreeing) → RECOVERED; any source not healthy → CONFIRMED_STALE; a read
 * fault, timeout, projection-contract violation or classification
 * disagreement → SOURCE_FAILED (fail closed). Zero external side effects by
 * construction; the append-only attempt record is the only durable effect.
 *
 * Everything on this contract is a closed enum, a fixed pattern or fixed
 * safe text. Summary templates are parameterized ONLY by target key, the
 * UTC calendar day and the closed result code — never by evidence free
 * text (no safeSummary passthrough).
 */

export const RECOVERY_VERIFY_RUNBOOK_KEY = 'RB-INCIDENT-RECOVERY-VERIFY-001';
export const RECOVERY_VERIFY_RUNBOOK_VERSION = '1';
export const RECOVERY_VERIFY_RUNBOOK_TIER = 'A';

/**
 * The live supervisor issue codes (src/supervisor/rule-engine.ts). Verified
 * against the rule engine: EVIDENCE_MISSING, EVIDENCE_STALE, SOURCE_DEGRADED,
 * STATUS_UNKNOWN, REPEATED_FAILURES, SOURCE_FAILED.
 */
export const RECOVERY_VERIFY_ACCEPTED_ISSUE_CODES = [
  'EVIDENCE_MISSING',
  'EVIDENCE_STALE',
  'SOURCE_DEGRADED',
  'STATUS_UNKNOWN',
  'REPEATED_FAILURES',
  'SOURCE_FAILED',
] as const;
export type RecoveryVerifyIssueCode = (typeof RECOVERY_VERIFY_ACCEPTED_ISSUE_CODES)[number];

/**
 * Subject keys are issue-code-like: an uppercase letter followed by 2-63
 * uppercase letters, digits or underscores (3-64 chars total).
 */
export const RECOVERY_VERIFY_TARGET_PATTERN = /^[A-Z][A-Z0-9_]{2,63}$/;

/** Fail-closed validator for recovery-verify subject keys. */
export function isRecoveryVerifyTargetKey(value: unknown): boolean {
  return typeof value === 'string' && RECOVERY_VERIFY_TARGET_PATTERN.test(value);
}

export const RECOVERY_VERIFY_EXPECTED_RESULT_CODES = [
  'RECOVERED',
  'CONFIRMED_STALE',
  'SOURCE_FAILED',
] as const;
export type RecoveryVerifyResultCode = (typeof RECOVERY_VERIFY_EXPECTED_RESULT_CODES)[number];

/** At most one automatic attempt per (runbook, subject, UTC day). */
export const RECOVERY_VERIFY_MAX_AUTOMATIC_ATTEMPTS = 1;

/** Upper bound for each bounded evidence read (recheck and verification). */
export const RECOVERY_VERIFY_TIMEOUT_MS = 10_000;

export const RECOVERY_VERIFY_PRECONDITIONS: readonly string[] = Object.freeze([
  'The alert engine declared the subject recovered.',
  'The subject key matches the closed runbook target pattern.',
  'The per-runbook enable flag and the auto-remediation kill switch are both on.',
  'The circuit breaker is closed and no attempt was claimed for this UTC day.',
]);

export const RECOVERY_VERIFY_EXPECTED_IMPACT: string =
  'The declared recovery of one subject is independently verified against ' +
  'read-only evidence by two agreeing bounded reads; the append-only ' +
  'attempt record is the only durable effect.';

export const RECOVERY_VERIFY_VERIFICATION: readonly string[] = Object.freeze([
  'Both bounded reads classify every checked source, and the two classifications agree.',
  'A source counts as healthy only when its status is OK and its freshUntil is in the future.',
  'Exactly one attempt record exists for the idempotency key of this UTC day.',
  'No evidence payload, free text or provider value appears in any summary.',
]);

export const RECOVERY_VERIFY_ROLLBACK: readonly string[] = Object.freeze([
  'No mutation was performed; rollback is a no-op.',
]);

export const RECOVERY_VERIFY_SUMMARY_MAX_CHARS = 200;

/**
 * Fixed result-code-safe summary template. Parameterized only by the closed
 * target key, the UTC calendar day and the closed result code — the longest
 * possible value stays well under 200 characters.
 */
export function buildRecoveryVerifySummary(
  targetKey: string,
  idempotencyDayUtc: string,
  resultCode: string,
): string {
  let summary = `${RECOVERY_VERIFY_RUNBOOK_KEY} target=${targetKey} day=${idempotencyDayUtc} result=${resultCode}`;
  if (summary.length > RECOVERY_VERIFY_SUMMARY_MAX_CHARS) {
    summary = summary.slice(0, RECOVERY_VERIFY_SUMMARY_MAX_CHARS);
  }
  return summary;
}

/** Fixed safe summary for gate denials that fire before any attempt exists. */
export function buildRecoveryVerifyGateSummary(reason: string): string {
  let summary = `${RECOVERY_VERIFY_RUNBOOK_KEY} gate=${reason}`;
  if (summary.length > RECOVERY_VERIFY_SUMMARY_MAX_CHARS) {
    summary = summary.slice(0, RECOVERY_VERIFY_SUMMARY_MAX_CHARS);
  }
  return summary;
}

export const RECOVERY_VERIFY_RUNBOOK = Object.freeze({
  runbookKey: RECOVERY_VERIFY_RUNBOOK_KEY,
  version: RECOVERY_VERIFY_RUNBOOK_VERSION,
  tier: RECOVERY_VERIFY_RUNBOOK_TIER,
  acceptedIssueCodes: RECOVERY_VERIFY_ACCEPTED_ISSUE_CODES,
  targetPattern: RECOVERY_VERIFY_TARGET_PATTERN,
  expectedResultCodes: RECOVERY_VERIFY_EXPECTED_RESULT_CODES,
  maxAutomaticAttempts: RECOVERY_VERIFY_MAX_AUTOMATIC_ATTEMPTS,
  timeoutMs: RECOVERY_VERIFY_TIMEOUT_MS,
  preconditions: RECOVERY_VERIFY_PRECONDITIONS,
  expectedImpact: RECOVERY_VERIFY_EXPECTED_IMPACT,
  verification: RECOVERY_VERIFY_VERIFICATION,
  rollback: RECOVERY_VERIFY_ROLLBACK,
});
