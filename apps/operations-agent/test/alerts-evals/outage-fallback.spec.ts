/**
 * Eval suite 4: sender-outage fallback (operator-plan 12 — "Telegram
 * unavailable: bounded retry, no duplicate repair").
 *
 * When the sender rejects, the alert is QUEUED_OUTAGE with exactly one
 * outbox append per attempt and idempotent unique entryIds; per-subject
 * queued-outage attempts are bounded by outageRetryMaxAttempts before the
 * engine reports SUPPRESSED_OUTAGE_BOUND; without an outbox the engine goes
 * straight to SUPPRESSED_OUTAGE_BOUND; queued sends count toward the hourly
 * rate limit.
 */

import { AlertEngine } from '../../src/alerts';
import {
  buildEngineOptions,
  ENV_KEY,
  makeVerdict,
  ManualClock,
  RecordingOutbox,
  RecordingSender,
  SUBJECT_BACKUP_STALE,
  SUBJECT_NO_ISSUE,
  SUBJECT_SYNC_DRIFT,
  T0,
  ThrowingSender,
} from './fixtures';

const OUTAGE_ERROR = new Error('synthetic sender outage');

describe('AlertEngine — outage-fallback evals', () => {
  it('queues a failed send as QUEUED_OUTAGE with exactly one outbox append', async () => {
    const sender = new ThrowingSender(OUTAGE_ERROR);
    const outbox = new RecordingOutbox();
    const engine = new AlertEngine(buildEngineOptions({ sender, outbox }));

    const decision = await engine.handle(
      ENV_KEY,
      makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE }),
    );

    expect(decision.action).toBe('QUEUED_OUTAGE');
    expect(outbox.entries).toHaveLength(1);
    expect(typeof outbox.entries[0].entryId).toBe('string');
    expect(outbox.entries[0].entryId.length).toBeGreaterThan(0);
  });

  it('bounds per-subject queued-outage attempts at outageRetryMaxAttempts, then SUPPRESSED_OUTAGE_BOUND', async () => {
    const sender = new ThrowingSender(OUTAGE_ERROR);
    const outbox = new RecordingOutbox();
    const engine = new AlertEngine(
      buildEngineOptions({ sender, outbox, outageRetryMaxAttempts: 2 }),
    );
    const red = makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE });

    expect((await engine.handle(ENV_KEY, red)).action).toBe('QUEUED_OUTAGE');
    expect((await engine.handle(ENV_KEY, red)).action).toBe('QUEUED_OUTAGE');
    expect((await engine.handle(ENV_KEY, red)).action).toBe('SUPPRESSED_OUTAGE_BOUND');
    expect(outbox.entries).toHaveLength(2);
  });

  it('assigns a unique entryId to every queued-outage append (no outbox duplicates)', async () => {
    const sender = new ThrowingSender(OUTAGE_ERROR);
    const outbox = new RecordingOutbox();
    const engine = new AlertEngine(
      buildEngineOptions({ sender, outbox, outageRetryMaxAttempts: 5 }),
    );
    const red = makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE });

    for (let i = 0; i < 3; i++) {
      await engine.handle(ENV_KEY, red);
    }

    const ids = outbox.entries.map((entry) => entry.entryId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resets the per-subject outage bound after a successful send for that subject', async () => {
    const outbox = new RecordingOutbox();
    const flaky = {
      failing: true,
      attempted: [] as Array<{ kind: string; subjectKey: string }>,
      async send(message: { kind: string; subjectKey: string }): Promise<void> {
        this.attempted.push({ ...message });
        if (this.failing) throw OUTAGE_ERROR;
      },
    };
    const engine = new AlertEngine(
      buildEngineOptions({ sender: flaky, outbox, outageRetryMaxAttempts: 1 }),
    );
    const red = makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE });

    expect((await engine.handle(ENV_KEY, red)).action).toBe('QUEUED_OUTAGE');
    expect((await engine.handle(ENV_KEY, red)).action).toBe('SUPPRESSED_OUTAGE_BOUND');

    flaky.failing = false;
    await engine.handle(ENV_KEY, makeVerdict('GREEN', { issueCode: SUBJECT_BACKUP_STALE }));
    // Recovery succeeded; a fresh RED for the subject queues again rather than
    // staying outage-bound.
    expect((await engine.handle(ENV_KEY, red)).action).toBe('SENT');
  });

  it('goes straight to SUPPRESSED_OUTAGE_BOUND when no outbox is configured', async () => {
    const sender = new ThrowingSender(OUTAGE_ERROR);
    const engine = new AlertEngine(
      buildEngineOptions({ sender, outageRetryMaxAttempts: 3 }),
    );

    const decision = await engine.handle(
      ENV_KEY,
      makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE }),
    );

    expect(decision.action).toBe('SUPPRESSED_OUTAGE_BOUND');
  });

  it('queued-outage sends count toward the hourly rate limit', async () => {
    const sender = new ThrowingSender(OUTAGE_ERROR);
    const outbox = new RecordingOutbox();
    const clock = new ManualClock(T0);
    const engine = new AlertEngine(
      buildEngineOptions({ sender, outbox, maxAlertsPerHour: 1, now: clock.now }),
    );

    // First subject fails and is queued: consumes the single hourly slot.
    expect(
      (await engine.handle(ENV_KEY, makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE }))).action,
    ).toBe('QUEUED_OUTAGE');

    // Second subject is rate-limited even though nothing was actually delivered.
    const second = await engine.handle(
      ENV_KEY,
      makeVerdict('RED', { issueCode: SUBJECT_SYNC_DRIFT }),
    );
    expect(second.action).toBe('SUPPRESSED_RATE_LIMITED');
    expect(outbox.entries).toHaveLength(1);
  });

  it('a queued-outage subject is not duplicate-suppressed while still RED', async () => {
    const sender = new ThrowingSender(OUTAGE_ERROR);
    const outbox = new RecordingOutbox();
    const engine = new AlertEngine(
      buildEngineOptions({ sender, outbox, outageRetryMaxAttempts: 3 }),
    );
    const red = makeVerdict('RED', { issueCode: SUBJECT_NO_ISSUE });

    expect((await engine.handle(ENV_KEY, red)).action).toBe('QUEUED_OUTAGE');
    const second = await engine.handle(ENV_KEY, red);
    expect(second.action).toBe('QUEUED_OUTAGE');
    expect(outbox.entries).toHaveLength(2);
  });
});
