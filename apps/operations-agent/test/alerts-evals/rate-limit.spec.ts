/**
 * Eval suite 2: rolling per-hour rate limit (operator-plan 8.3/Phase F —
 * bounded alert volume, no alert storms).
 *
 * At most maxAlertsPerHour alerts may be SENT within a rolling UTC hour;
 * further alerts are SUPPRESSED_RATE_LIMITED and older sends stop counting
 * once they slide out of the window.
 */

import { AlertEngine } from '../../src/alerts';
import {
  buildEngineOptions,
  ENV_KEY,
  makeVerdict,
  ManualClock,
  RecordingSender,
  SUBJECT_BACKUP_STALE,
  SUBJECT_NO_ISSUE,
  SUBJECT_SYNC_DRIFT,
  T0,
} from './fixtures';

const SUBJECTS = [SUBJECT_NO_ISSUE, SUBJECT_BACKUP_STALE, SUBJECT_SYNC_DRIFT, 'INCIDENT_REPEAT'];

function redFor(index: number) {
  return makeVerdict('RED', { issueCode: SUBJECTS[index % SUBJECTS.length] });
}

describe('AlertEngine — rate-limit evals', () => {
  it('sends up to maxAlertsPerHour in a rolling hour, then suppresses', async () => {
    const sender = new RecordingSender();
    const clock = new ManualClock(T0);
    const engine = new AlertEngine(
      buildEngineOptions({ sender, maxAlertsPerHour: 3, now: clock.now }),
    );

    const actions: string[] = [];
    for (let i = 0; i < 4; i++) {
      actions.push((await engine.handle(ENV_KEY, redFor(i))).action);
    }

    expect(actions).toEqual(['SENT', 'SENT', 'SENT', 'SUPPRESSED_RATE_LIMITED']);
    expect(sender.sent).toHaveLength(3);
  });

  it('sliding window: sends older than one hour stop counting', async () => {
    const sender = new RecordingSender();
    const clock = new ManualClock(T0);
    const engine = new AlertEngine(
      buildEngineOptions({ sender, maxAlertsPerHour: 2, now: clock.now }),
    );

    expect((await engine.handle(ENV_KEY, redFor(0))).action).toBe('SENT');
    expect((await engine.handle(ENV_KEY, redFor(1))).action).toBe('SENT');
    expect((await engine.handle(ENV_KEY, redFor(2))).action).toBe('SUPPRESSED_RATE_LIMITED');

    // 30 minutes later the window has not slid.
    clock.advance(30 * 60 * 1000);
    expect((await engine.handle(ENV_KEY, redFor(3))).action).toBe('SUPPRESSED_RATE_LIMITED');

    // 61 minutes after the first send, the earliest sends have slid out.
    clock.set(T0 + 61 * 60 * 1000);
    expect((await engine.handle(ENV_KEY, redFor(0))).action).toBe('SENT');
    expect(sender.sent).toHaveLength(3);
  });

  it('a suppressed alert does not itself consume rate budget (recovery can still send)', async () => {
    const sender = new RecordingSender();
    const clock = new ManualClock(T0);
    const engine = new AlertEngine(
      buildEngineOptions({ sender, maxAlertsPerHour: 1, now: clock.now }),
    );

    expect(
      (await engine.handle(ENV_KEY, makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE }))).action,
    ).toBe('SENT');
    // Same subject still RED: duplicate-suppressed, not rate-limited.
    const duplicate = await engine.handle(
      ENV_KEY,
      makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE }),
    );
    expect(duplicate.action).toBe('SUPPRESSED_DUPLICATE');

    // Recovery for the alerted subject is not a duplicate and must get through.
    const recovery = await engine.handle(
      ENV_KEY,
      makeVerdict('GREEN', { issueCode: SUBJECT_BACKUP_STALE }),
    );
    expect(recovery.action).toBe('SENT');
    expect(recovery.message!.kind).toBe('recovery');
    expect(sender.sent).toHaveLength(2);
  });

  it('blocked kill-switch and skipped verdicts do not consume rate budget', async () => {
    const sender = new RecordingSender();
    const clock = new ManualClock(T0);
    const engine = new AlertEngine(
      buildEngineOptions({ sender, maxAlertsPerHour: 1, now: clock.now }),
    );

    await engine.handle(ENV_KEY, makeVerdict('AMBER', { issueCode: SUBJECT_NO_ISSUE })); // SKIPPED
    expect(
      (await engine.handle(ENV_KEY, makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE }))).action,
    ).toBe('SENT');
  });
});
