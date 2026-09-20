import { makeEngine, ENV, ISSUE } from './fakes';

describe('remediation approve/reject transitions', () => {
  it('approve transitions PROPOSED -> APPROVED and returns the updated proposal', () => {
    const { engine } = makeEngine();
    const id = engine.propose(ENV, ISSUE).proposal!.proposalId;
    const decision = engine.approve(id);
    expect(decision.action).toBe('APPROVED');
    expect(decision.proposal!.status).toBe('APPROVED');
    expect(engine.getProposal(id)!.status).toBe('APPROVED');
  });

  it('reject transitions PROPOSED -> REJECTED', () => {
    const { engine } = makeEngine();
    const id = engine.propose(ENV, ISSUE).proposal!.proposalId;
    const decision = engine.reject(id);
    expect(decision.action).toBe('REJECTED');
    expect(engine.getProposal(id)!.status).toBe('REJECTED');
  });

  it('approve/reject on an unknown proposalId returns EXPIRED with no proposal', () => {
    const { engine } = makeEngine();
    expect(engine.approve('rem-missing')).toEqual({ action: 'EXPIRED' });
    expect(engine.reject('rem-missing')).toEqual({ action: 'EXPIRED' });
  });

  it('terminal states are stable: approve after reject does not transition', () => {
    const { engine } = makeEngine();
    const id = engine.propose(ENV, ISSUE).proposal!.proposalId;
    engine.reject(id);
    const decision = engine.approve(id);
    expect(decision.action).not.toBe('APPROVED');
    expect(decision.proposal!.status).toBe('REJECTED');
  });

  it('terminal states are stable: reject after approve does not transition', () => {
    const { engine } = makeEngine();
    const id = engine.propose(ENV, ISSUE).proposal!.proposalId;
    engine.approve(id);
    const decision = engine.reject(id);
    expect(decision.action).not.toBe('REJECTED');
    expect(decision.proposal!.status).toBe('APPROVED');
  });

  it('re-applying the same terminal decision is idempotent', () => {
    const { engine } = makeEngine();
    const id = engine.propose(ENV, ISSUE).proposal!.proposalId;
    engine.approve(id);
    const again = engine.approve(id);
    expect(again.action).toBe('APPROVED');
    expect(again.proposal!.status).toBe('APPROVED');
  });

  it('decisions carry the same proposalId and display text as the store', () => {
    const { engine } = makeEngine();
    const id = engine.propose(ENV, ISSUE).proposal!.proposalId;
    const decision = engine.approve(id);
    const stored = engine.getProposal(id)!;
    expect(decision.proposal).toEqual(stored);
    expect(decision.proposal!.verification.length).toBeGreaterThan(0);
    expect(decision.proposal!.rollback.length).toBeGreaterThan(0);
  });

  it('returned proposals are copies: external mutation does not corrupt state', () => {
    const { engine } = makeEngine();
    const id = engine.propose(ENV, ISSUE).proposal!.proposalId;
    const decision = engine.approve(id);
    (decision.proposal as { status: string }).status = 'REJECTED';
    (decision.proposal!.preconditions as string[]).push('injected');
    expect(engine.getProposal(id)!.status).toBe('APPROVED');
    expect(engine.getProposal(id)!.preconditions).not.toContain('injected');
  });
});
