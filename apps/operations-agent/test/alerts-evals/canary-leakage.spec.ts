/**
 * Eval suite 5: secret-canary leakage (operator-plan 11.2/14 — "secret, token,
 * email, URL, private-ID and PII canary leakage").
 *
 * A canary planted in verdict.summary, verdict.evidenceKeys or
 * issueCode-shaped text must never appear in any sent or queued message text:
 * the engine renders from a safe fixed template, not from raw verdict fields.
 * Proved with the shared detectCanaryLeak helper over message.text.
 */

import { detectCanaryLeak, SECRET_CANARY_FIXTURES } from '@cloudit/operations-agent-contracts';
import { AlertEngine } from '../../src/alerts';
import {
  buildEngineOptions,
  ENV_KEY,
  makeVerdict,
  RecordingOutbox,
  RecordingSender,
  SUBJECT_BACKUP_STALE,
  ThrowingSender,
} from './fixtures';

const OUTAGE_ERROR = new Error('synthetic sender outage');

function expectTextCanaryFree(text: string): void {
  const report = detectCanaryLeak(text);
  expect(report.leaked).toBe(false);
  if (report.leaked) {
    throw new Error(`canary leak in message text: ${report.matches.join(', ')}`);
  }
}

describe('AlertEngine — canary-leakage evals', () => {
  describe.each(SECRET_CANARY_FIXTURES.map((c) => [c.id, c.value] as const))(
    'canary in verdict.summary (%s)',
    (_id, canary) => {
      it('never appears in a sent red_alert text', async () => {
        const sender = new RecordingSender();
        const engine = new AlertEngine(buildEngineOptions({ sender }));

        const decision = await engine.handle(
          ENV_KEY,
          makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE, summary: `collector note: ${canary}` }),
        );

        expect(decision.action).toBe('SENT');
        expectTextCanaryFree(decision.message!.text);
        expect(decision.message!.text).not.toContain(`collector note: ${canary}`);
      });
    },
  );

  describe.each(SECRET_CANARY_FIXTURES.map((c) => [c.id, c.value] as const))(
    'canary in verdict.evidenceKeys (%s)',
    (_id, canary) => {
      it('never appears in a sent red_alert text', async () => {
        const sender = new RecordingSender();
        const engine = new AlertEngine(buildEngineOptions({ sender }));

        const decision = await engine.handle(
          ENV_KEY,
          makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE, evidenceKeys: ['ev.synthetic.1', canary] }),
        );

        expect(decision.action).toBe('SENT');
        expectTextCanaryFree(decision.message!.text);
        expect(decision.message!.text).not.toContain(canary);
      });
    },
  );

  describe.each(SECRET_CANARY_FIXTURES.map((c) => [c.id, c.value] as const))(
    'canary in issueCode-shaped text (%s)',
    (_id, canary) => {
      it('never appears in a sent red_alert text even though subjectKey passes through', async () => {
        const sender = new RecordingSender();
        const engine = new AlertEngine(buildEngineOptions({ sender }));

        const decision = await engine.handle(
          ENV_KEY,
          makeVerdict('RED', { issueCode: `BACKUP_STALE-${canary}` }),
        );

        expect(decision.action).toBe('SENT');
        // The subjectKey is the raw issueCode by contract; only the rendered
        // text must be canary-free.
        expect(decision.message!.subjectKey).toBe(`BACKUP_STALE-${canary}`);
        expectTextCanaryFree(decision.message!.text);
      });
    },
  );

  it('a canary in the summary never reaches queued-outage text either', async () => {
    const canary = SECRET_CANARY_FIXTURES[0].value;
    const sender = new ThrowingSender(OUTAGE_ERROR);
    const outbox = new RecordingOutbox();
    const engine = new AlertEngine(buildEngineOptions({ sender, outbox }));

    const decision = await engine.handle(
      ENV_KEY,
      makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE, summary: `queued note: ${canary}` }),
    );

    expect(decision.action).toBe('QUEUED_OUTAGE');
    if (decision.message) {
      expectTextCanaryFree(decision.message.text);
    }
    expectTextCanaryFree(JSON.stringify(outbox.entries));
  });

  it('a canary never reaches a recovery message text', async () => {
    const canary = SECRET_CANARY_FIXTURES[1].value;
    const sender = new RecordingSender();
    const engine = new AlertEngine(buildEngineOptions({ sender }));

    await engine.handle(ENV_KEY, makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE }));
    const recovery = await engine.handle(
      ENV_KEY,
      makeVerdict('GREEN', { issueCode: SUBJECT_BACKUP_STALE, summary: `recovered: ${canary}` }),
    );

    expect(recovery.action).toBe('SENT');
    expect(recovery.message!.kind).toBe('recovery');
    expectTextCanaryFree(recovery.message!.text);
  });

  it('a laced summary still alerts (safe template fallback, not a silent drop)', async () => {
    const laced = SECRET_CANARY_FIXTURES.map((c) => c.value).join(' ');
    const sender = new RecordingSender();
    const engine = new AlertEngine(buildEngineOptions({ sender }));

    const decision = await engine.handle(
      ENV_KEY,
      makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE, summary: `fully laced: ${laced}` }),
    );

    expect(decision.action).toBe('SENT');
    expectTextCanaryFree(decision.message!.text);
  });
});
