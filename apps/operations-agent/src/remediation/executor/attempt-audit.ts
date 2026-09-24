/**
 * Closed audit record for a finished remediation attempt (Phase H).
 *
 * Exactly one event per finished attempt, mirroring the proposal-audit
 * conventions: safe machine-readable codes only; the summary is a fixed
 * bounded template (<= 200 chars); the evidenceKeys list carries the closed
 * target key, canary-redacted via detectCanaryLeak as defense in depth.
 */

import { detectCanaryLeak } from '@cloudit/operations-agent-contracts';
import type { AttemptResultCode } from '../attempt-contract';
import type { RemediationExecutionOutcome } from './executor-contract';

export const REMEDIATION_ATTEMPT_AUDIT_SUMMARY_MAX_CHARS = 200;

const REDACTED_TARGET = '[redacted-by-security-policy]';

function safeTarget(targetKey: string): string {
  try {
    return detectCanaryLeak(targetKey).leaked ? REDACTED_TARGET : targetKey;
  } catch {
    return REDACTED_TARGET;
  }
}

export interface RemediationAttemptAuditEvent {
  eventType: 'remediation_attempt';
  actor: 'agent:remediation';
  occurredAt: string;
  reasonCode: RemediationExecutionOutcome;
  resultCode: AttemptResultCode;
  summary: string;
  evidenceKeys: string[];
}

export function buildAttemptAuditEvent(
  outcome: RemediationExecutionOutcome,
  resultCode: AttemptResultCode,
  targetKey: string,
  occurredAtIso: string,
  summary: string,
): RemediationAttemptAuditEvent {
  const target = safeTarget(targetKey);
  let bounded = summary;
  if (bounded.length > REMEDIATION_ATTEMPT_AUDIT_SUMMARY_MAX_CHARS) {
    bounded = bounded.slice(0, REMEDIATION_ATTEMPT_AUDIT_SUMMARY_MAX_CHARS);
  }
  // Defense in depth: the summary is a fixed template, but scan it for
  // canary material anyway and redact exact matches before the event
  // crosses the audit boundary.
  try {
    const report = detectCanaryLeak(bounded);
    for (const match of report.matches) {
      bounded = bounded.split(match).join(REDACTED_TARGET);
    }
  } catch {
    bounded = REDACTED_TARGET;
  }
  return Object.freeze({
    eventType: 'remediation_attempt',
    actor: 'agent:remediation',
    occurredAt: occurredAtIso,
    reasonCode: outcome,
    resultCode,
    summary: bounded,
    evidenceKeys: Object.freeze([target]) as unknown as string[],
  });
}
