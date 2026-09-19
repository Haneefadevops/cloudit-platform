import { ManualClock } from '../../src/platform/clock';
import { DURABLE_OUTBOX, OutboxEntry } from '../../src/platform/outbox/durable-outbox';
import { InMemoryOutbox } from '../../src/platform/outbox/in-memory-outbox';

function entry(overrides: Partial<OutboxEntry> = {}): OutboxEntry {
  return {
    entryId: 'outbox-0001',
    aggregateType: 'agent_assessment',
    aggregateKey: 'synthetic-0001',
    payload: { assessment: 'GREEN' },
    occurredAt: '2026-09-21T10:00:00.000Z',
    ...overrides,
  };
}

describe('InMemoryOutbox (Worker C)', () => {
  it('appends entries, exposes pending work and confirms publication', () => {
    const outbox = new InMemoryOutbox();
    outbox.append(entry());
    outbox.append(entry({ entryId: 'outbox-0002', aggregateKey: 'synthetic-0002' }));
    expect(outbox.pendingEntries().length).toBe(2);
    expect(outbox.allEntries().length).toBe(2);

    expect(outbox.markPublished('outbox-0001')).toBe(true);
    expect(outbox.pendingEntries().map((e) => e.entryId)).toEqual(['outbox-0002']);
    const published = outbox.allEntries().find((e) => e.entryId === 'outbox-0001');
    expect(published?.publishedAt).toBeTruthy();
  });

  it('rejects duplicate entryIds (idempotent append) and unknown double-publish', () => {
    const outbox = new InMemoryOutbox();
    outbox.append(entry());
    expect(() => outbox.append(entry())).toThrow(/duplicate/);
    expect(outbox.markPublished('missing')).toBe(false);
    expect(outbox.markPublished('outbox-0001')).toBe(true);
    expect(outbox.markPublished('outbox-0001')).toBe(false);
  });

  it('stamps publication with the injected clock and keeps payload immutable', () => {
    const clock = new ManualClock(new Date('2026-09-21T12:00:00.000Z'));
    const outbox = new InMemoryOutbox({ clock });
    const stored = outbox.append(entry());
    expect(Object.isFrozen(stored)).toBe(true);
    expect(() => {
      (stored.payload as { assessment: string }).assessment = 'RED';
    }).toThrow();
    outbox.markPublished('outbox-0001');
    expect(outbox.allEntries()[0].publishedAt).toBe('2026-09-21T12:00:00.000Z');
  });

  it('exposes the DURABLE_OUTBOX injection token for the coordinator', () => {
    expect(typeof DURABLE_OUTBOX).toBe('symbol');
  });
});
