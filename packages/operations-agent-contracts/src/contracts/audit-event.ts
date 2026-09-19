/**
 * AuditEvent - append-only audit record for scans, alerts, denials,
 * proposals, approvals, attempts, verifications, rollbacks and
 * circuit-breaker events (operator-plan section 11.3).
 *
 * Only safe reason/result codes and bounded summaries are stored - never
 * raw exceptions, provider responses, credentials or Telegram message
 * bodies. The event-type catalogue is a coordinator/Phase C deliverable;
 * here the type is shape-validated (charset + length), not membership.
 */

import { ACTOR_FIELD, ENVIRONMENT_KEY_FIELD, KEY_ID_FIELD, SAFE_CODE_FIELD, EVENT_TYPE_FIELD } from './fields';
import {
  buildValidator,
  EVIDENCE_KEYS_FIELD,
  requiredTimestamp,
  SUMMARY_FIELD,
  ValidationResult,
} from './validation';

export interface AuditEvent {
  eventId: string;
  environmentKey: string;
  /** Safe event type such as 'remediation_attempt' (shape-validated). */
  eventType: string;
  /** Runtime identity, e.g. 'system', 'agent:supervisor', 'controller'. */
  actor: string;
  occurredAt: string;
  /** Safe machine-readable reason code, e.g. 'ATTEMPT_STARTED'. */
  reasonCode: string;
  /** Safe machine-readable result code, e.g. 'ACCEPTED'. */
  resultCode: string;
  /** Bounded internal summary (policy-sanitized upstream, max 1000 chars). */
  summary: string;
  /** Safe evidence references; max 50 items. */
  evidenceKeys: string[];
}

export const AUDIT_EVENT_FIELDS = {
  eventId: KEY_ID_FIELD,
  environmentKey: ENVIRONMENT_KEY_FIELD,
  eventType: EVENT_TYPE_FIELD,
  actor: ACTOR_FIELD,
  occurredAt: requiredTimestamp(),
  reasonCode: SAFE_CODE_FIELD,
  resultCode: SAFE_CODE_FIELD,
  summary: SUMMARY_FIELD,
  evidenceKeys: EVIDENCE_KEYS_FIELD,
} as const;

export function validateAuditEvent(input: unknown): ValidationResult<AuditEvent> {
  return buildValidator<AuditEvent>('AuditEvent', AUDIT_EVENT_FIELDS)(input);
}
