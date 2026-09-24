/**
 * Tier A remediation executor contract (Programme Phase H).
 *
 * The executor is the ONLY path by which an allowlisted Tier A runbook may
 * perform its fixed, non-destructive action. It is gated by, in order:
 * runbook contract validation, the per-runbook enable flag, the
 * auto-remediation kill switch, the circuit breaker, and the durable
 * exactly-once attempt claim. It never throws.
 *
 * Coordinator-owned seam: Worker B implements against this file; Worker C
 * evaluates it. Changes require coordinator sign-off.
 */

import type { AttemptResultCode } from '../attempt-contract';

export const REMEDIATION_EXECUTION_OUTCOMES = [
  'EXECUTED',
  'ALREADY_CLAIMED',
  'BLOCKED_KILL_SWITCH',
  'PRECONDITION_FAILED',
  'CIRCUIT_OPEN',
  'INTERNAL_ERROR',
] as const;

export type RemediationExecutionOutcome = (typeof REMEDIATION_EXECUTION_OUTCOMES)[number];

export interface RemediationExecutionRequest {
  readonly proposalId: string;
  readonly runbookKey: string;
  readonly runbookVersion: string;
  readonly issueCode: string;
  readonly targetKey: string;
  readonly clientKey: string;
  readonly environmentKey: string;
  /** UTC calendar day in YYYY-MM-DD form; part of the idempotency key. */
  readonly idempotencyDayUtc: string;
  /**
   * Evidence sources the runbook must verify (used by the recovery-verify
   * runbook, RB-INCIDENT-RECOVERY-VERIFY-001). When absent or empty, the
   * runbook verifies every record in the projection. Coordinator seam
   * addition, Phase H runbook 2; additive and optional.
   */
  readonly evidenceKeys?: readonly string[];
  readonly nowMs: number;
}

export interface RemediationExecutionResult {
  readonly outcome: RemediationExecutionOutcome;
  readonly attemptId: string | null;
  readonly resultCode: AttemptResultCode | null;
  /** Fixed-template, canary-safe summary; never evidence free text. */
  readonly summary: string;
}

export interface RemediationExecutor {
  execute(request: RemediationExecutionRequest): Promise<RemediationExecutionResult>;
}

export const REMEDIATION_EXECUTOR = Symbol('REMEDIATION_EXECUTOR');
