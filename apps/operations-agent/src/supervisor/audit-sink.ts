/**
 * AuditSink - the narrow outbound port the supervisor uses for auditability
 * (operator-plan section 11.3). The coordinator binds this port to the
 * platform audit service at integration; the supervisor never imports from
 * src/platform.
 *
 * Contract: implementations receive exactly one validated AuditEvent per
 * supervisor run, containing safe reason/result codes and bounded summaries
 * only - never raw exceptions, provider responses or payloads.
 */

import { AuditEvent, validateAuditEvent } from '@cloudit/operations-agent-contracts';

export interface AuditSink {
  record(event: AuditEvent): void;
}

export const AUDIT_SINK = Symbol('AUDIT_SINK');

/**
 * Default in-process sink. Validates every event against the AuditEvent
 * contract before storing and throws on a contract violation, so a malformed
 * event can never be silently recorded.
 */
export class InMemoryAuditSink implements AuditSink {
  private readonly stored: AuditEvent[] = [];

  record(event: AuditEvent): void {
    const result = validateAuditEvent(event);
    if (!result.ok) {
      throw new Error(`AuditEvent failed contract validation: ${result.errors.join('; ')}`);
    }
    this.stored.push(result.value);
  }

  get events(): readonly AuditEvent[] {
    return [...this.stored];
  }
}
