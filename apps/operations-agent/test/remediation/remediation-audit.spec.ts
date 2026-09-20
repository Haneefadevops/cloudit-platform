import { RemediationProposalAuditEvent } from '../../src/remediation';
import { makeEngine, ENV, ISSUE, FIXED_NOW_MS } from './fakes';

describe('remediation audit trail', () => {
  it('records exactly one closed event per mutating call with mapped result codes', () => {
    const { engine, auditEvents } = makeEngine();
    const id = engine.propose(ENV, ISSUE).proposal!.proposalId;
    engine.propose(ENV, ISSUE); // REPLAY_IGNORED
    engine.approve(id); // ACCEPTED
    engine.reject(id); // mismatched terminal -> EXPIRED
    engine.propose(ENV, 'UNKNOWN_CODE'); // EXPIRED (no runbook)

    expect(auditEvents).toHaveLength(5);
    const [proposed, replay, accepted, expired, norunbook] =
      auditEvents as RemediationProposalAuditEvent[];
    expect(proposed).toMatchObject({
      eventType: 'remediation_proposal',
      actor: 'agent:remediation',
      reasonCode: 'PROPOSED',
      resultCode: 'PROPOSED',
      evidenceKeys: [ISSUE],
    });
    expect(replay.resultCode).toBe('IGNORED');
    expect(accepted.resultCode).toBe('ACCEPTED');
    expect(expired.resultCode).toBe('BLOCKED');
    expect(norunbook.resultCode).toBe('BLOCKED');
    expect(norunbook.evidenceKeys).toEqual(['UNKNOWN_CODE']);
  });

  it('summary is a fixed bounded template (<=200 chars) with action and subjectKey', () => {
    const { engine, auditEvents } = makeEngine();
    engine.propose(ENV, ISSUE);
    const event = auditEvents[0] as RemediationProposalAuditEvent;
    expect(event.summary).toBe(`remediation proposal action=PROPOSED subject=${ISSUE}`);
    expect(event.summary.length).toBeLessThanOrEqual(200);
  });

  it('uses ISO-8601 UTC occurredAt from the injected clock', () => {
    const { engine, auditEvents } = makeEngine();
    engine.propose(ENV, ISSUE);
    expect((auditEvents[0] as RemediationProposalAuditEvent).occurredAt).toBe(
      new Date(FIXED_NOW_MS).toISOString(),
    );
  });

  it('never throws even when audit.record throws', () => {
    let current = FIXED_NOW_MS;
    const { RemediationEngine } = jest.requireActual<typeof import('../../src/remediation')>(
      '../../src/remediation',
    );
    const engine = new RemediationEngine({
      audit: {
        record: () => {
          throw new Error('audit sink down');
        },
      },
      now: () => current,
    });
    const decision = engine.propose(ENV, ISSUE);
    expect(decision.action).toBe('PROPOSED');
    const id = decision.proposal!.proposalId;
    expect(engine.approve(id).action).toBe('APPROVED');
    expect(engine.reject(id).action).toBe('EXPIRED');
  });

  it('records a BLOCKED audit event while the circuit is open', () => {
    const { engine, auditEvents } = makeEngine({ maxFailures: 1 });
    const id = engine.propose(ENV, ISSUE).proposal!.proposalId;
    engine.recordExecutionFailure(id);
    engine.approve(id);
    const last = auditEvents[auditEvents.length - 1] as RemediationProposalAuditEvent;
    expect(last.reasonCode).toBe('CIRCUIT_OPEN');
    expect(last.resultCode).toBe('BLOCKED');
  });
});
