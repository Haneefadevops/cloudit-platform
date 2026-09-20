/**
 * Eval suite 7: digests (operator-plan Phase F — reviewed daily/weekly/
 * monthly summaries).
 *
 * Daily, weekly and monthly digests render with the correct entry counts and
 * period subject lines; an empty entries digest still renders; digests
 * respect the kill switch and the hourly rate limit; exactly one audit event
 * is recorded per digest call.
 */

import { AlertEngine } from '../../src/alerts';
import {
  buildEngineOptions,
  ENV_KEY,
  makeDigestEntry,
  makeVerdict,
  ManualClock,
  RecordingAuditSink,
  RecordingSender,
  StubGate,
  SUBJECT_BACKUP_STALE,
  T0,
} from './fixtures';

describe('AlertEngine — digest evals', () => {
  it.each(['daily', 'weekly', 'monthly'] as const)(
    'renders a %s digest with the correct count and period in the subject/text',
    async (period) => {
      const sender = new RecordingSender();
      const engine = new AlertEngine(buildEngineOptions({ sender }));
      const entries = [
        makeDigestEntry(),
        makeDigestEntry({ subjectKey: 'SYNC_DRIFT', category: 'RED' }),
        makeDigestEntry({ subjectKey: 'NO_ISSUE', category: 'GREEN' }),
      ];

      const decision = await engine.sendDigest(ENV_KEY, period, entries);

      expect(decision.action).toBe('SENT');
      expect(decision.message).toBeDefined();
      expect(decision.message!.kind).toBe('digest');
      expect(decision.message!.environmentKey).toBe(ENV_KEY);
      const text = decision.message!.text.toLowerCase();
      expect(text).toContain(period);
      expect(decision.message!.text).toContain(String(entries.length));
      expect(Number.isNaN(Date.parse(decision.message!.occurredAt))).toBe(false);
    },
  );

  it('renders an empty-entries digest without throwing', async () => {
    const sender = new RecordingSender();
    const engine = new AlertEngine(buildEngineOptions({ sender }));

    const decision = await engine.sendDigest(ENV_KEY, 'daily', []);

    expect(decision.action).toBe('SENT');
    expect(decision.message!.kind).toBe('digest');
    expect(decision.message!.text).toContain('0');
    expect(sender.sent).toHaveLength(1);
  });

  it('a digest is blocked by the kill switch with zero sends', async () => {
    const sender = new RecordingSender();
    const gate = new StubGate(new Error('synthetic kill switch open'));
    const engine = new AlertEngine(buildEngineOptions({ sender, gate }));

    const decision = await engine.sendDigest(ENV_KEY, 'daily', [makeDigestEntry()]);

    expect(decision.action).toBe('BLOCKED_KILL_SWITCH');
    expect(sender.sent).toHaveLength(0);
  });

  it('digests respect the hourly rate limit once the cap is reached', async () => {
    const sender = new RecordingSender();
    const clock = new ManualClock(T0);
    const engine = new AlertEngine(
      buildEngineOptions({ sender, maxAlertsPerHour: 1, now: clock.now }),
    );

    await engine.handle(ENV_KEY, makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE }));
    const decision = await engine.sendDigest(ENV_KEY, 'daily', [makeDigestEntry()]);

    expect(decision.action).toBe('SUPPRESSED_RATE_LIMITED');
    expect(sender.sent).toHaveLength(1);
  });

  it('records exactly one audit event per digest call', async () => {
    const audit = new RecordingAuditSink();
    const engine = new AlertEngine(buildEngineOptions({ audit }));

    await engine.sendDigest(ENV_KEY, 'daily', [makeDigestEntry()]);
    await engine.sendDigest(ENV_KEY, 'monthly', []);

    expect(audit.events).toHaveLength(2);
  });

  it('digest entries with every category render without leaking raw summaries', async () => {
    const sender = new RecordingSender();
    const engine = new AlertEngine(buildEngineOptions({ sender }));
    const rawMarker = 'SYNTHETIC_RAW_DIGEST_SUMMARY_51c8a2';
    const entries = (['RED', 'AMBER', 'GREEN', 'NO_DATA', 'UNKNOWN'] as const).map((category) =>
      makeDigestEntry({ category, summary: `raw: ${rawMarker}` }),
    );

    const decision = await engine.sendDigest(ENV_KEY, 'weekly', entries);

    expect(decision.action).toBe('SENT');
    expect(decision.message!.text).not.toContain(rawMarker);
  });
});
