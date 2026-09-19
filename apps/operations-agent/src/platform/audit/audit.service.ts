/**
 * Append-only in-memory audit service (operator-plan section 11.3).
 *
 * Every event is validated through the shared contract validator before it is
 * stored; invalid events are rejected and never retained. Stored events are
 * deeply frozen and the service exposes no update or delete API, so the
 * in-memory store is immutable from the outside. This is the Phase C offline
 * stand-in for the append-only operations-PostgreSQL `audit_events` table; a
 * later durable sink can implement AuditSink without changing callers.
 *
 * Only safe reason/result codes and bounded summaries may be recorded - never
 * raw exceptions, provider responses or Telegram message bodies.
 */

import { Injectable } from '@nestjs/common';
import { AuditEvent, validateAuditEvent, ValidationResult } from '@cloudit/operations-agent-contracts';

/**
 * Sink interface the coordinator can bind other modules to. Deliberately
 * narrow: recording and reading. Implementations must be append-only.
 */
export interface AuditSink {
  record(event: unknown): ValidationResult<AuditEvent>;
  getEvents(): readonly AuditEvent[];
}

@Injectable()
export class AuditService implements AuditSink {
  private readonly events: AuditEvent[] = [];

  /**
   * Validates the event against the AuditEvent contract and appends a frozen
   * copy. Returns the validation errors on rejection; never throws on bad
   * input (fail-closed validation lives in the contracts package).
   */
  record(event: unknown): ValidationResult<AuditEvent> {
    const result = validateAuditEvent(event);
    if (!result.ok) {
      return result;
    }
    const stored: AuditEvent = Object.freeze({
      ...result.value,
      evidenceKeys: Object.freeze([...result.value.evidenceKeys]) as string[],
    });
    this.events.push(stored);
    return { ok: true, value: stored };
  }

  /** Read-only snapshot of everything recorded so far. */
  getEvents(): readonly AuditEvent[] {
    return Object.freeze([...this.events]);
  }

  count(): number {
    return this.events.length;
  }
}
