/**
 * Eval suite 6: template safety (operator-plan 6.3/11.2 — Telegram messages
 * contain only safe identifiers, status, timestamps, evidence keys and
 * bounded summaries).
 *
 * Rendered alert text must never embed verdict.summary or raw evidence-key
 * strings, must stay within the 400-character bound, and digest text must
 * never embed entry summaries.
 */

import { AlertEngine } from '../../src/alerts';
import {
  buildEngineOptions,
  ENV_KEY,
  makeDigestEntry,
  makeVerdict,
  RecordingSender,
  SUBJECT_BACKUP_STALE,
} from './fixtures';

const RAW_SUMMARY_MARKER = 'SYNTHETIC_RAW_SUMMARY_MARKER_7f3a9b1c';
const RAW_EVIDENCE_KEY = 'ev.synthetic.raw-marker-7f3a9b1c';

function expectSafeAlertText(text: string): void {
  expect(text.length).toBeLessThanOrEqual(400);
  expect(text).not.toContain(RAW_SUMMARY_MARKER);
  expect(text).not.toContain(RAW_EVIDENCE_KEY);
}

describe('AlertEngine — template-safety evals', () => {
  it('red_alert text never contains the raw verdict summary or raw evidence keys and is <= 400 chars', async () => {
    const sender = new RecordingSender();
    const engine = new AlertEngine(buildEngineOptions({ sender }));

    await engine.handle(
      ENV_KEY,
      makeVerdict('RED', {
        issueCode: SUBJECT_BACKUP_STALE,
        summary: `raw: ${RAW_SUMMARY_MARKER}`,
        evidenceKeys: [RAW_EVIDENCE_KEY],
      }),
    );

    expect(sender.sent).toHaveLength(1);
    expectSafeAlertText(sender.sent[0].text);
  });

  it('recovery text never contains the raw verdict summary and is <= 400 chars', async () => {
    const sender = new RecordingSender();
    const engine = new AlertEngine(buildEngineOptions({ sender }));

    await engine.handle(ENV_KEY, makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE }));
    await engine.handle(
      ENV_KEY,
      makeVerdict('GREEN', { issueCode: SUBJECT_BACKUP_STALE, summary: `raw: ${RAW_SUMMARY_MARKER}` }),
    );

    const recovery = sender.sent.find((m) => m.kind === 'recovery');
    expect(recovery).toBeDefined();
    expectSafeAlertText(recovery!.text);
  });

  it('a maximal verdict (long summary, 50 evidence keys) still renders a bounded safe message', async () => {
    const sender = new RecordingSender();
    const engine = new AlertEngine(buildEngineOptions({ sender }));

    await engine.handle(
      ENV_KEY,
      makeVerdict('RED', {
        issueCode: SUBJECT_BACKUP_STALE,
        summary: RAW_SUMMARY_MARKER.repeat(200), // far beyond any template budget
        evidenceKeys: Array.from({ length: 50 }, (_, i) => `${RAW_EVIDENCE_KEY}.${i}`),
      }),
    );

    expect(sender.sent).toHaveLength(1);
    expectSafeAlertText(sender.sent[0].text);
  });

  it('digest text never contains entry summaries', async () => {
    const sender = new RecordingSender();
    const engine = new AlertEngine(buildEngineOptions({ sender }));

    await engine.sendDigest(ENV_KEY, 'daily', [
      makeDigestEntry({ summary: `raw digest summary: ${RAW_SUMMARY_MARKER}` }),
      makeDigestEntry({ subjectKey: 'SYNC_DRIFT', summary: `another raw: ${RAW_SUMMARY_MARKER}` }),
    ]);

    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].kind).toBe('digest');
    expect(sender.sent[0].text).not.toContain(RAW_SUMMARY_MARKER);
  });

  it('subject keys that legitimately appear in text are the closed issue codes, not evidence keys', async () => {
    const sender = new RecordingSender();
    const engine = new AlertEngine(buildEngineOptions({ sender }));

    await engine.handle(
      ENV_KEY,
      makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE, evidenceKeys: [RAW_EVIDENCE_KEY] }),
    );

    expect(sender.sent[0].subjectKey).toBe(SUBJECT_BACKUP_STALE);
    expect(sender.sent[0].text).not.toContain(RAW_EVIDENCE_KEY);
  });

  it('occurredAt is an ISO timestamp, never raw verdict content', async () => {
    const sender = new RecordingSender();
    const engine = new AlertEngine(buildEngineOptions({ sender }));

    await engine.handle(
      ENV_KEY,
      makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE, summary: `raw: ${RAW_SUMMARY_MARKER}` }),
    );

    const occurredAt = sender.sent[0].occurredAt;
    expect(Number.isNaN(Date.parse(occurredAt))).toBe(false);
    expect(occurredAt).not.toContain(RAW_SUMMARY_MARKER);
    expect(occurredAt).not.toContain(RAW_EVIDENCE_KEY);
  });
});
