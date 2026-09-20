/**
 * Eval suite 1: alert deduplication and recovery semantics (operator-plan
 * Phase F — "prove alert deduplication, recovery").
 *
 * First RED for a subject sends; a repeat RED for the same subject is
 * suppressed; a GREEN for a previously-alerted subject sends a recovery and
 * clears the alert state so a later RED re-alerts; independent subjects alert
 * independently; a non-RED verdict with no prior state is skipped.
 */

import { AlertEngine } from '../../src/alerts';
import {
  buildEngineOptions,
  ENV_KEY,
  makeVerdict,
  RecordingAuditSink,
  RecordingSender,
  SUBJECT_BACKUP_STALE,
  SUBJECT_NO_ISSUE,
  SUBJECT_SYNC_DRIFT,
} from './fixtures';

describe('AlertEngine — dedup evals', () => {
  it('sends the first RED for a subject as a red_alert and carries environment/subject keys', async () => {
    const sender = new RecordingSender();
    const engine = new AlertEngine(buildEngineOptions({ sender }));

    const decision = await engine.handle(ENV_KEY, makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE }));

    expect(decision.action).toBe('SENT');
    expect(decision.message).toBeDefined();
    expect(decision.message!.kind).toBe('red_alert');
    expect(decision.message!.environmentKey).toBe(ENV_KEY);
    expect(decision.message!.subjectKey).toBe(SUBJECT_BACKUP_STALE);
    expect(sender.sent).toHaveLength(1);
    expect(Number.isNaN(Date.parse(decision.message!.occurredAt))).toBe(false);
  });

  it('suppresses a repeat RED for the same subject without sending again', async () => {
    const sender = new RecordingSender();
    const engine = new AlertEngine(buildEngineOptions({ sender }));
    const verdict = makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE });

    await engine.handle(ENV_KEY, verdict);
    const repeat = await engine.handle(ENV_KEY, verdict);

    expect(repeat.action).toBe('SUPPRESSED_DUPLICATE');
    expect(sender.sent).toHaveLength(1);
  });

  it('sends a recovery when a previously-alerted subject turns GREEN, and clears the state', async () => {
    const sender = new RecordingSender();
    const engine = new AlertEngine(buildEngineOptions({ sender }));
    const red = makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE });

    await engine.handle(ENV_KEY, red);
    const recovery = await engine.handle(
      ENV_KEY,
      makeVerdict('GREEN', { issueCode: SUBJECT_BACKUP_STALE }),
    );

    expect(recovery.action).toBe('SENT');
    expect(recovery.message!.kind).toBe('recovery');
    expect(recovery.message!.subjectKey).toBe(SUBJECT_BACKUP_STALE);
    expect(sender.sent.map((m) => m.kind)).toEqual(['red_alert', 'recovery']);
  });

  it('re-alerts when the same subject goes RED again after a recovery', async () => {
    const sender = new RecordingSender();
    const engine = new AlertEngine(buildEngineOptions({ sender }));
    const red = makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE });

    await engine.handle(ENV_KEY, red);
    await engine.handle(ENV_KEY, makeVerdict('GREEN', { issueCode: SUBJECT_BACKUP_STALE }));
    const reAlert = await engine.handle(ENV_KEY, red);

    expect(reAlert.action).toBe('SENT');
    expect(reAlert.message!.kind).toBe('red_alert');
    expect(sender.sent).toHaveLength(3);
  });

  it('alerts independent subjects independently (no cross-subject suppression)', async () => {
    const sender = new RecordingSender();
    const engine = new AlertEngine(buildEngineOptions({ sender }));

    await engine.handle(ENV_KEY, makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE }));
    const other = await engine.handle(ENV_KEY, makeVerdict('RED', { issueCode: SUBJECT_SYNC_DRIFT }));
    const repeatFirst = await engine.handle(
      ENV_KEY,
      makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE }),
    );

    expect(other.action).toBe('SENT');
    expect(repeatFirst.action).toBe('SUPPRESSED_DUPLICATE');
    expect(sender.sent).toHaveLength(2);
  });

  it.each(['AMBER', 'GREEN', 'NO_DATA', 'UNKNOWN'] as const)(
    'skips a %s verdict with no prior alert state as SKIPPED_NOT_RED',
    async (verdict) => {
      const sender = new RecordingSender();
      const engine = new AlertEngine(buildEngineOptions({ sender }));

      const decision = await engine.handle(
        ENV_KEY,
        makeVerdict(verdict, { issueCode: SUBJECT_NO_ISSUE }),
      );

      expect(decision.action).toBe('SKIPPED_NOT_RED');
      expect(decision.message).toBeUndefined();
      expect(sender.sent).toHaveLength(0);
    },
  );

  it('keeps dedup state per environment: the same subject in another environment alerts independently', async () => {
    const sender = new RecordingSender();
    const engine = new AlertEngine(buildEngineOptions({ sender }));
    const red = makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE });

    await engine.handle(ENV_KEY, red);
    const otherEnv = await engine.handle('env_synthetic_other', red);

    expect(otherEnv.action).toBe('SENT');
    expect(sender.sent).toHaveLength(2);
  });

  it('suppresses a repeat RED even across intervening unrelated activity', async () => {
    const sender = new RecordingSender();
    const audit = new RecordingAuditSink();
    const engine = new AlertEngine(buildEngineOptions({ sender, audit }));
    const red = makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE });

    await engine.handle(ENV_KEY, red);
    await engine.handle(ENV_KEY, makeVerdict('AMBER', { issueCode: SUBJECT_SYNC_DRIFT }));
    const repeat = await engine.handle(ENV_KEY, red);

    expect(repeat.action).toBe('SUPPRESSED_DUPLICATE');
    expect(sender.sent).toHaveLength(1);
  });
});
