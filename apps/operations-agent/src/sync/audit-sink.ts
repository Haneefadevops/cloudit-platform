import type { AuditEvent } from '@cloudit/operations-agent-contracts';

/**
 * Narrow audit port (operator plan section 11.3): append-only, safe codes
 * only. The coordinator binds this to the platform audit service at
 * integration; the in-memory implementation below is the offline default.
 */
export interface AuditSink {
  record(event: AuditEvent): void;
}

/** Offline audit sink: keeps events in memory for tests and local runs. */
export class InMemoryAuditSink implements AuditSink {
  private readonly stored: AuditEvent[] = [];

  record(event: AuditEvent): void {
    this.stored.push(event);
  }

  get events(): readonly AuditEvent[] {
    return this.stored;
  }
}
