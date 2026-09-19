/**
 * DurableOutbox port.
 *
 * Transactional outbox for events that must survive restarts (operator-plan
 * section 9: PostgreSQL-backed durable jobs/outbox). Phase C ships only the
 * in-memory implementation; the production contract is fixed here so the
 * later Postgres implementation is a drop-in replacement.
 *
 * POSTGRES IMPLEMENTATION REQUIREMENTS (at-least-once semantics):
 *
 * 1. The outbox record MUST be written in the SAME database transaction as
 *    the business-state change it announces. A crash after the business
 *    commit but before the outbox write is the classic dual-write bug this
 *    pattern exists to prevent.
 * 2. A relay process polls `pendingEntries()` and publishes each entry to
 *    consumers, then calls `markPublished(entryId, publishedAt)` in a
 *    SEPARATE transaction. A crash between publish and mark therefore
 *    redelivers the entry: delivery is AT LEAST ONCE, never exactly once.
 * 3. Consumers MUST be idempotent: dedupe on a stable unique key
 *    (aggregateType + aggregateKey + entryId). Enforce a unique index on
 *    entryId in Postgres so redelivery cannot create a second row.
 * 4. Rows are append-only: payloads are immutable once written; retention
 *    and archival follow the existing operations-PostgreSQL audit policy.
 * 5. No secret values, raw provider payloads or Telegram bodies may enter
 *    an outbox payload - only contract-validated, sanitized data.
 */

export interface OutboxEntry {
  /** Globally unique, idempotency-bearing entry identifier. */
  readonly entryId: string;
  /** Bounded aggregate type, e.g. 'agent_assessment'. */
  readonly aggregateType: string;
  /** Idempotency key scoped to the aggregate type. */
  readonly aggregateKey: string;
  /** Sanitized, contract-validated payload. */
  readonly payload: unknown;
  /** ISO-8601 timestamp of the business event. */
  readonly occurredAt: string;
  /** Set by markPublished; null while the entry is pending. */
  readonly publishedAt?: string | null;
}

export interface DurableOutbox {
  /** Appends an entry. Implementations must reject duplicate entryIds. */
  append(entry: OutboxEntry): OutboxEntry;
  /**
   * Marks an entry as published. Returns false for unknown or already
   * published entryIds; redelivery after a crash must remain observable as
   * still-pending until this call commits.
   */
  markPublished(entryId: string): boolean;
  /** Entries not yet confirmed published, oldest first. */
  pendingEntries(): readonly OutboxEntry[];
  /** Read-only snapshot of every entry, oldest first. */
  allEntries(): readonly OutboxEntry[];
}

export const DURABLE_OUTBOX = Symbol('DURABLE_OUTBOX');
