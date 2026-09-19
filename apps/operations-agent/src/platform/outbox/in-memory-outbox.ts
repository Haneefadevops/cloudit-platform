/**
 * In-memory DurableOutbox implementation for the offline Phase C runtime.
 * See durable-outbox.ts for the at-least-once Postgres contract this must
 * honour when swapped for the durable implementation.
 */

import { Clock, SystemClock } from '../clock';
import { DurableOutbox, OutboxEntry } from './durable-outbox';

export interface InMemoryOutboxOptions {
  readonly clock?: Clock;
}

export class InMemoryOutbox implements DurableOutbox {
  private readonly clock: Clock;
  private readonly entries: OutboxEntry[] = [];

  constructor(options: InMemoryOutboxOptions = {}) {
    this.clock = options.clock ?? new SystemClock();
  }

  append(entry: OutboxEntry): OutboxEntry {
    if (!entry.entryId || entry.entryId.length > 128) {
      throw new Error('outbox entry requires a non-empty entryId (max 128 chars)');
    }
    if (this.entries.some((e) => e.entryId === entry.entryId)) {
      throw new Error(`duplicate outbox entryId: ${entry.entryId}`);
    }
    const stored: OutboxEntry = Object.freeze({ publishedAt: null, ...entry, payload: Object.freeze(entry.payload) });
    this.entries.push(stored);
    return stored;
  }

  markPublished(entryId: string): boolean {
    const index = this.entries.findIndex((e) => e.entryId === entryId);
    if (index < 0) return false;
    const current = this.entries[index];
    if (current.publishedAt !== null && current.publishedAt !== undefined) return false;
    const published: OutboxEntry = Object.freeze({
      ...current,
      publishedAt: this.clock.now().toISOString(),
    });
    this.entries[index] = published;
    return true;
  }

  pendingEntries(): readonly OutboxEntry[] {
    return Object.freeze(
      this.entries.filter((e) => e.publishedAt === null || e.publishedAt === undefined),
    );
  }

  allEntries(): readonly OutboxEntry[] {
    return Object.freeze([...this.entries]);
  }
}
