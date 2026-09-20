/**
 * Closed audit record for the alert engine (Phase F).
 *
 * Exactly one event per handle()/sendDigest() call. Safe machine-readable
 * codes only; the summary is a fixed bounded template (<= 200 chars) with the
 * action and subjectKey — never verdict text, model output or raw errors.
 * The coordinator adapts this into the contracts AuditEvent later; do NOT add
 * eventId/environmentKey here.
 */

import type { AlertAction } from './alert-engine';

export const ALERT_AUDIT_SUMMARY_MAX_CHARS = 200;

export type AlertAuditResultCode = 'SENT' | 'SUPPRESSED' | 'QUEUED';

export interface AlertDispatchAuditEvent {
  eventType: 'alert_dispatch';
  actor: 'agent:alerts';
  occurredAt: string;
  reasonCode: AlertAction;
  resultCode: AlertAuditResultCode;
  summary: string;
  evidenceKeys: string[];
}

export function resultCodeOf(action: AlertAction): AlertAuditResultCode {
  if (action === 'SENT') return 'SENT';
  if (action === 'QUEUED_OUTAGE') return 'QUEUED';
  return 'SUPPRESSED';
}

export function buildAlertAuditEvent(
  action: AlertAction,
  subjectKey: string,
  occurredAtIso: string,
): AlertDispatchAuditEvent {
  let summary = `alert dispatch action=${action} subject=${subjectKey}`;
  if (summary.length > ALERT_AUDIT_SUMMARY_MAX_CHARS) {
    summary = summary.slice(0, ALERT_AUDIT_SUMMARY_MAX_CHARS);
  }
  return {
    eventType: 'alert_dispatch',
    actor: 'agent:alerts',
    occurredAt: occurredAtIso,
    reasonCode: action,
    resultCode: resultCodeOf(action),
    summary,
    evidenceKeys: [subjectKey],
  };
}
