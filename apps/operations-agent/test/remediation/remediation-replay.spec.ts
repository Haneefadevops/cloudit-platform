import { makeEngine, ENV, ISSUE, FIXED_NOW_MS } from './fakes';

describe('remediation replay idempotency', () => {
  it('returns REPLAY_IGNORED with the existing proposal on duplicate propose', () => {
    const { engine } = makeEngine();
    const first = engine.propose(ENV, ISSUE);
    const second = engine.propose(ENV, ISSUE);

    expect(second.action).toBe('REPLAY_IGNORED');
    expect(second.proposal!.proposalId).toBe(first.proposal!.proposalId);
    expect(engine.listProposals()).toHaveLength(1);
  });

  it('scopes replay per environmentKey', () => {
    const { engine } = makeEngine();
    engine.propose(ENV, ISSUE);
    const other = engine.propose('env-other', ISSUE);
    expect(other.action).toBe('PROPOSED');
    expect(engine.listProposals()).toHaveLength(2);
  });

  it('scopes replay per issueCode', () => {
    const { engine } = makeEngine();
    engine.propose(ENV, ISSUE);
    const other = engine.propose(ENV, 'WF_DRIFT_MISMATCH');
    expect(other.action).toBe('PROPOSED');
  });

  it('allows a fresh propose after the live proposal reaches a terminal state', () => {
    const { engine } = makeEngine();
    const first = engine.propose(ENV, ISSUE);
    engine.approve(first.proposal!.proposalId);
    const second = engine.propose(ENV, ISSUE);
    expect(second.action).toBe('PROPOSED');
    expect(second.proposal!.proposalId).not.toBe(first.proposal!.proposalId);
  });

  it('replay still returns the live proposal when the clock is at proposal time', () => {
    const { engine, clock } = makeEngine();
    const first = engine.propose(ENV, ISSUE);
    clock.advance(1_000);
    const second = engine.propose(ENV, ISSUE);
    expect(second.action).toBe('REPLAY_IGNORED');
    expect(second.proposal!.proposalId).toBe(first.proposal!.proposalId);
    expect(second.proposal!.createdAt).toBe(new Date(FIXED_NOW_MS).toISOString());
  });
});
