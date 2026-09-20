import { AlertEngine, AlertMessage } from '../../src/alerts';
import {
  makeEngine,
  verdict,
  ENV,
  FIXED_NOW_MS,
  RecordingSender,
  RecordingOutbox,
} from './fakes';

describe('AlertEngine outage fallback', () => {
  it('appends to the outbox and returns QUEUED_OUTAGE when the sender rejects', async () => {
    const { engine, outbox, auditEvents } = makeEngine({
      sender: new RecordingSender(true),
    });

    const decision = await engine.handle(ENV, verdict());
    expect(decision.action).toBe('QUEUED_OUTAGE');
    expect(decision.message?.kind).toBe('red_alert');
    expect(outbox.entries).toHaveLength(1);
    expect(outbox.entries[0]).toEqual({
      entryId: `alert-outage-${ENV}-WF_STALE-${FIXED_NOW_MS}`,
      type: 'telegram_alert',
      payload: decision.message,
    });
    expect(auditEvents).toHaveLength(1);
  });

  it('bounds queued-outage appends per subject at outageRetryMaxAttempts', async () => {
    const { engine, outbox } = makeEngine({
      sender: new RecordingSender(true),
      outageRetryMaxAttempts: 2,
    });
    const v = () => verdict();

    expect((await engine.handle(ENV, v())).action).toBe('QUEUED_OUTAGE');
    expect((await engine.handle(ENV, v())).action).toBe('QUEUED_OUTAGE');
    const third = await engine.handle(ENV, v());
    expect(third.action).toBe('SUPPRESSED_OUTAGE_BOUND');
    expect(third.message).toBeUndefined();
    expect(outbox.entries).toHaveLength(2);
  });

  it('bounds per subject, not globally — other subjects keep queueing', async () => {
    const { engine, outbox } = makeEngine({
      sender: new RecordingSender(true),
      outageRetryMaxAttempts: 1,
    });

    await engine.handle(ENV, verdict({ issueCode: 'WF_A' }));
    expect((await engine.handle(ENV, verdict({ issueCode: 'WF_A' }))).action).toBe('SUPPRESSED_OUTAGE_BOUND');
    expect((await engine.handle(ENV, verdict({ issueCode: 'WF_B' }))).action).toBe('QUEUED_OUTAGE');
    expect(outbox.entries).toHaveLength(2);
  });

  it('returns SUPPRESSED_OUTAGE_BOUND when no outbox is provided', async () => {
    let current = FIXED_NOW_MS;
    const engine = new AlertEngine({
      gate: { assertEnabled: () => undefined },
      sender: new RecordingSender(true),
      maxAlertsPerHour: 6,
      outageRetryMaxAttempts: 3,
      now: () => current,
    });
    const decision = await engine.handle(ENV, verdict());
    expect(decision.action).toBe('SUPPRESSED_OUTAGE_BOUND');
    expect(decision.message).toBeUndefined();
  });

  it('queues digests on sender outage too', async () => {
    const { engine, outbox } = makeEngine({ sender: new RecordingSender(true) });
    const decision = await engine.sendDigest(ENV, 'daily', [
      { subjectKey: 'WF_A', category: 'RED', summary: 'ignored', lastOccurredAt: '2026-10-05T00:00:00Z' },
    ]);
    expect(decision.action).toBe('QUEUED_OUTAGE');
    expect(decision.message?.kind).toBe('digest');
    expect(outbox.entries[0].type).toBe('telegram_alert');
  });

  it('outage-queued messages are bounded by the digest subject key', async () => {
    const { engine, outbox } = makeEngine({
      sender: new RecordingSender(true),
      outageRetryMaxAttempts: 1,
    });
    const entries = [
      { subjectKey: 'WF_A', category: 'RED' as const, summary: 's', lastOccurredAt: '2026-10-05T00:00:00Z' },
    ];
    expect((await engine.sendDigest(ENV, 'daily', entries)).action).toBe('QUEUED_OUTAGE');
    expect((await engine.sendDigest(ENV, 'daily', entries)).action).toBe('SUPPRESSED_OUTAGE_BOUND');
    expect(outbox.entries).toHaveLength(1);
  });
});
