/**
 * Eval suite 7: audit trail (operator-plan 11.3 — append-only audit with safe
 * reason/result codes; "store safe reason/result codes, not raw exceptions").
 *
 * Every propose/approve/reject records exactly one closed event whose
 * reasonCode equals the action, with a bounded safe summary free of
 * interpolated environment/issue text; a throwing audit sink never breaks
 * the engine; canary-laced keys never leak into the event.
 */

import { detectCanaryLeak, SECRET_CANARY_FIXTURES } from '@cloudit/operations-agent-contracts';
import { RemediationEngine } from '../../src/remediation';
import {
  buildEngineOptions,
  ENV_A,
  findProperty,
  ISSUE_EVIDENCE_STALE,
  RecordingAuditSink,
  ThrowingAuditSink,
} from './fixtures';

const RAW_ENV_MARKER = 'SYNTHETIC_RAW_ENV_MARKER_4c81d2';

function expectEventCanaryFree(event: unknown): void {
  const report = detectCanaryLeak(JSON.stringify(event));
  expect(report.leaked).toBe(false);
  if (report.leaked) {
    throw new Error(`canary leak in audit event: ${report.matches.join(', ')}`);
  }
}

describe('RemediationEngine — audit-trail evals', () => {
  it('records exactly one closed event per propose/approve/reject with reasonCode equal to the action', () => {
    const audit = new RecordingAuditSink();
    const engine = new RemediationEngine(buildEngineOptions({ audit }));

    const proposed = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE);
    const approved = engine.approve(proposed.proposal!.proposalId);
    const rejectedId = engine.propose(ENV_A, 'ALERT_DELIVERY_FAILURE').proposal!.proposalId;
    const rejected = engine.reject(rejectedId);

    expect(audit.events).toHaveLength(3);
    expect(findProperty(audit.events[0], 'reasonCode')).toBe(proposed.action);
    expect(findProperty(audit.events[1], 'reasonCode')).toBe(approved.action);
    expect(findProperty(audit.events[2], 'reasonCode')).toBe(rejected.action);
  });

  it('every event carries a resultCode mapping (safe machine-readable outcome)', () => {
    const audit = new RecordingAuditSink();
    const engine = new RemediationEngine(buildEngineOptions({ audit }));

    engine.propose(ENV_A, ISSUE_EVIDENCE_STALE);
    engine.propose(ENV_A, ISSUE_EVIDENCE_STALE); // REPLAY_IGNORED
    engine.approve('no-such-synthetic-id'); // EXPIRED

    expect(audit.events).toHaveLength(3);
    for (const event of audit.events) {
      expect(typeof findProperty(event, 'resultCode')).toBe('string');
    }
  });

  it('the event summary is bounded (<= 200 chars) and free of interpolated environment text', () => {
    const audit = new RecordingAuditSink();
    const engine = new RemediationEngine(buildEngineOptions({ audit }));

    engine.propose(`env_synthetic_${RAW_ENV_MARKER}`, ISSUE_EVIDENCE_STALE);

    const event = audit.events[0] as Record<string, unknown>;
    const summary = findProperty(event, 'summary');
    expect(typeof summary).toBe('string');
    expect((summary as string).length).toBeLessThanOrEqual(200);
    expect(summary as string).not.toContain(RAW_ENV_MARKER);
  });

  it('a canary-laced environmentKey and issueCode never leak into the serialized event', () => {
    const canary = SECRET_CANARY_FIXTURES[0].value;
    const canaryIssue = SECRET_CANARY_FIXTURES[1].value;
    const audit = new RecordingAuditSink();
    const engine = new RemediationEngine(buildEngineOptions({ audit }));

    engine.propose(`env_${canary}`, `ISSUE_${canaryIssue}`);

    expectEventCanaryFree(audit.events[0]);
  });

  it('a throwing audit sink never propagates and never blocks a decision', () => {
    const audit = new ThrowingAuditSink();
    const engine = new RemediationEngine(buildEngineOptions({ audit }));

    expect(() => engine.propose(ENV_A, ISSUE_EVIDENCE_STALE)).not.toThrow();
    const id = engine.listProposals(ENV_A)[0].proposalId;
    expect(() => engine.approve(id)).not.toThrow();
    expect(() => engine.reject(engine.propose(ENV_A, 'ALERT_DELIVERY_FAILURE').proposal!.proposalId)).not.toThrow();

    expect(engine.getProposal(id)!.status).toBe('APPROVED');
    expect(audit.attempts.length).toBeGreaterThanOrEqual(3);
  });
});
