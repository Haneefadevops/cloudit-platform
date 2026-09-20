/**
 * Eval suite 3: kill switch (operator-plan 11.4 — "the owner can disable all
 * AI/alert activity immediately").
 *
 * When the gate throws, every engine entry point resolves to
 * BLOCKED_KILL_SWITCH: zero sends, zero outbox appends, exactly one audit
 * event per call, and the engine itself never throws.
 */

import { AlertEngine } from '../../src/alerts';
import {
  buildEngineOptions,
  ENV_KEY,
  makeDigestEntry,
  makeVerdict,
  RecordingAuditSink,
  RecordingOutbox,
  RecordingSender,
  StubGate,
  SUBJECT_BACKUP_STALE,
} from './fixtures';

describe('AlertEngine — kill-switch evals', () => {
  it('handle() resolves to BLOCKED_KILL_SWITCH with zero sends when the gate throws', async () => {
    const sender = new RecordingSender();
    const gate = new StubGate(new Error('synthetic kill switch open'));
    const engine = new AlertEngine(buildEngineOptions({ sender, gate }));

    const promise = engine.handle(ENV_KEY, makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE }));

    await expect(promise).resolves.toBeDefined();
    const decision = await promise;
    expect(decision.action).toBe('BLOCKED_KILL_SWITCH');
    expect(decision.message).toBeUndefined();
    expect(sender.sent).toHaveLength(0);
  });

  it('sendDigest() resolves to BLOCKED_KILL_SWITCH with zero sends when the gate throws', async () => {
    const sender = new RecordingSender();
    const gate = new StubGate(new Error('synthetic kill switch open'));
    const engine = new AlertEngine(buildEngineOptions({ sender, gate }));

    const decision = await engine.sendDigest(ENV_KEY, 'daily', [makeDigestEntry()]);

    expect(decision.action).toBe('BLOCKED_KILL_SWITCH');
    expect(sender.sent).toHaveLength(0);
  });

  it('records exactly one audit event per blocked call', async () => {
    const audit = new RecordingAuditSink();
    const gate = new StubGate(new Error('synthetic kill switch open'));
    const engine = new AlertEngine(buildEngineOptions({ gate, audit }));

    await engine.handle(ENV_KEY, makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE }));
    await engine.sendDigest(ENV_KEY, 'weekly', [makeDigestEntry()]);

    expect(audit.events).toHaveLength(2);
  });

  it('never appends to the outbox on a blocked call', async () => {
    const outbox = new RecordingOutbox();
    const gate = new StubGate(new Error('synthetic kill switch open'));
    const engine = new AlertEngine(buildEngineOptions({ gate, outbox }));

    await engine.handle(ENV_KEY, makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE }));

    expect(outbox.entries).toHaveLength(0);
  });

  it('does not alert, queue or consume rate budget while the switch is open, and alerts normally once it closes', async () => {
    const sender = new RecordingSender();
    const gateError = new Error('synthetic kill switch open');
    const gate = new StubGate(gateError);
    const engine = new AlertEngine(buildEngineOptions({ sender, gate, maxAlertsPerHour: 1 }));

    await engine.handle(ENV_KEY, makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE }));
    expect(sender.sent).toHaveLength(0);

    // Close the switch: the same RED alert must now flow normally.
    gate.enable();
    const decision = await engine.handle(ENV_KEY, makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE }));
    expect(decision.action).toBe('SENT');
    expect(sender.sent).toHaveLength(1);
  });
});
