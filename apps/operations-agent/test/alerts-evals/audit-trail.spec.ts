/**
 * Eval suite 8: audit trail (operator-plan 11.3 — append-only audit with safe
 * reason/result codes, not raw exceptions or provider responses).
 *
 * Every engine call records exactly one closed event whose reasonCode equals
 * the action taken, with a safe fixed summary; canary-laced verdicts and
 * sender error details must never leak into the event.
 */

import { detectCanaryLeak, SECRET_CANARY_FIXTURES } from '@cloudit/operations-agent-contracts';
import { AlertEngine } from '../../src/alerts';
import {
  buildEngineOptions,
  collectStrings,
  ENV_KEY,
  findReasonCode,
  makeDigestEntry,
  makeVerdict,
  RecordingAuditSink,
  SUBJECT_BACKUP_STALE,
  ThrowingSender,
} from './fixtures';

const RAW_ERROR_MARKER = 'SYNTHETIC_RAW_SENDER_ERROR_9d21f7';
const OUTAGE_ERROR = new Error(`sender exploded: ${RAW_ERROR_MARKER}`);

function expectEventCanaryFree(event: unknown): void {
  const report = detectCanaryLeak(JSON.stringify(event));
  expect(report.leaked).toBe(false);
  if (report.leaked) {
    throw new Error(`canary leak in audit event: ${report.matches.join(', ')}`);
  }
}

describe('AlertEngine — audit-trail evals', () => {
  it('records exactly one closed event per handle() call with reasonCode equal to the action', async () => {
    const audit = new RecordingAuditSink();
    const engine = new AlertEngine(buildEngineOptions({ audit }));

    const sent = await engine.handle(ENV_KEY, makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE }));
    await engine.handle(ENV_KEY, makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE }));

    expect(audit.events).toHaveLength(2);
    expect(findReasonCode(audit.events[0])).toBe(sent.action);
    expect(findReasonCode(audit.events[1])).toBe('SUPPRESSED_DUPLICATE');
  });

  it('covers every action class with a matching reasonCode', async () => {
    const audit = new RecordingAuditSink();
    const engine = new AlertEngine(buildEngineOptions({ audit, outageRetryMaxAttempts: 1 }));

    const actions: string[] = [];
    actions.push((await engine.handle(ENV_KEY, makeVerdict('AMBER'))).action); // SKIPPED_NOT_RED
    actions.push((await engine.handle(ENV_KEY, makeVerdict('RED', { issueCode: 'A1' }))).action); // SENT
    actions.push((await engine.handle(ENV_KEY, makeVerdict('RED', { issueCode: 'A1' }))).action); // SUPPRESSED_DUPLICATE
    actions.push((await engine.sendDigest(ENV_KEY, 'daily', [])).action); // SENT

    expect(audit.events).toHaveLength(actions.length);
    for (let i = 0; i < actions.length; i++) {
      expect(findReasonCode(audit.events[i])).toBe(actions[i]);
    }
  });

  it('sender-outage events carry no raw error or stack content', async () => {
    const audit = new RecordingAuditSink();
    const engine = new AlertEngine(
      buildEngineOptions({ sender: new ThrowingSender(OUTAGE_ERROR), audit, outageRetryMaxAttempts: 2 }),
    );

    await engine.handle(ENV_KEY, makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE }));

    expect(audit.events).toHaveLength(1);
    const serialized = JSON.stringify(audit.events[0]);
    expect(serialized).not.toContain(RAW_ERROR_MARKER);
    expect(serialized).not.toContain('at '); // no stack-trace lines
  });

  it('a canary-laced verdict never leaks into the audit event', async () => {
    const canary = SECRET_CANARY_FIXTURES[2].value;
    const audit = new RecordingAuditSink();
    const engine = new AlertEngine(buildEngineOptions({ audit }));

    await engine.handle(
      ENV_KEY,
      makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE, summary: `note: ${canary}` }),
    );

    expect(audit.events).toHaveLength(1);
    expectEventCanaryFree(audit.events[0]);
  });

  it('the audit summary is a safe fixed string, not the raw verdict summary', async () => {
    const rawMarker = 'SYNTHETIC_RAW_AUDIT_SUMMARY_31b7e0';
    const audit = new RecordingAuditSink();
    const engine = new AlertEngine(buildEngineOptions({ audit }));

    await engine.handle(
      ENV_KEY,
      makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE, summary: `raw: ${rawMarker}` }),
    );

    const strings = collectStrings(audit.events[0]);
    expect(strings.some((s) => s.includes(rawMarker))).toBe(false);
  });

  it('digest calls are audited exactly once with the digest action', async () => {
    const audit = new RecordingAuditSink();
    const engine = new AlertEngine(buildEngineOptions({ audit }));

    const decision = await engine.sendDigest(ENV_KEY, 'monthly', [makeDigestEntry()]);

    expect(audit.events).toHaveLength(1);
    expect(findReasonCode(audit.events[0])).toBe(decision.action);
  });
});
