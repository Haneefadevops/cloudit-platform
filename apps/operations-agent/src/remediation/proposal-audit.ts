/**
 * Closed audit record for the remediation engine (Phase G).
 *
 * Exactly one event per propose()/approve()/reject() call. Safe
 * machine-readable codes only; the summary is a fixed bounded template
 * (<= 200 chars) with the action and subjectKey — never runbook free text.
 * Defense in depth: a subjectKey that trips the secret-canary scan (out-of-
 * contract input, since issueCode is closed-code validated upstream) is
 * redacted in the summary and evidenceKeys so no channel can leak. The
 * coordinator adapts this into the contracts AuditEvent later; do NOT add
 * eventId/environmentKey here.
 */

import { detectCanaryLeak } from '@cloudit/operations-agent-contracts';
import type { ProposalAction } from './remediation-engine';

export const REMEDIATION_AUDIT_SUMMARY_MAX_CHARS = 200;

const REDACTED_SUBJECT = '[redacted-by-security-policy]';

function safeSubject(subjectKey: string): string {
  try {
    return detectCanaryLeak(subjectKey).leaked ? REDACTED_SUBJECT : subjectKey;
  } catch {
    return REDACTED_SUBJECT;
  }
}

export type RemediationAuditResultCode = 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'IGNORED' | 'BLOCKED';

export interface RemediationProposalAuditEvent {
  eventType: 'remediation_proposal';
  actor: 'agent:remediation';
  occurredAt: string;
  reasonCode: ProposalAction;
  resultCode: RemediationAuditResultCode;
  summary: string;
  evidenceKeys: string[];
}

export function resultCodeOf(action: ProposalAction): RemediationAuditResultCode {
  switch (action) {
    case 'PROPOSED':
      return 'PROPOSED';
    case 'APPROVED':
      return 'ACCEPTED';
    case 'REJECTED':
      return 'REJECTED';
    case 'REPLAY_IGNORED':
      return 'IGNORED';
    case 'EXPIRED':
    case 'CIRCUIT_OPEN':
      return 'BLOCKED';
  }
}

export function buildRemediationAuditEvent(
  action: ProposalAction,
  subjectKey: string,
  occurredAtIso: string,
): RemediationProposalAuditEvent {
  const subject = safeSubject(subjectKey);
  let summary = `remediation proposal action=${action} subject=${subject}`;
  if (summary.length > REMEDIATION_AUDIT_SUMMARY_MAX_CHARS) {
    summary = summary.slice(0, REMEDIATION_AUDIT_SUMMARY_MAX_CHARS);
  }
  return {
    eventType: 'remediation_proposal',
    actor: 'agent:remediation',
    occurredAt: occurredAtIso,
    reasonCode: action,
    resultCode: resultCodeOf(action),
    summary,
    evidenceKeys: [subject],
  };
}
