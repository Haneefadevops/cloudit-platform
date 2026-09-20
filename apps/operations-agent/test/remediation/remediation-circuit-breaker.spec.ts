import { makeEngine, ENV, ISSUE } from './fakes';

describe('remediation circuit breaker', () => {
  it('opens after maxFailures recorded failures and blocks mutations', () => {
    const { engine } = makeEngine({ maxFailures: 2 });
    const id = engine.propose(ENV, ISSUE).proposal!.proposalId;

    engine.recordExecutionFailure(id);
    expect(engine.propose('env-x', 'WF_DRIFT_MISMATCH').action).toBe('PROPOSED'); // still closed

    engine.recordExecutionFailure(id); // second failure -> OPEN
    expect(engine.propose(ENV, 'WF_DRIFT_MISMATCH').action).toBe('CIRCUIT_OPEN');
    expect(engine.approve(id).action).toBe('CIRCUIT_OPEN');
    expect(engine.reject(id).action).toBe('CIRCUIT_OPEN');
    // No state change while open.
    expect(engine.getProposal(id)!.status).toBe('PROPOSED');
    expect(engine.listProposals()).toHaveLength(2); // id + the pre-open env-x proposal
  });

  it('reads always work while the circuit is open', () => {
    const { engine } = makeEngine({ maxFailures: 1 });
    const id = engine.propose(ENV, ISSUE).proposal!.proposalId;
    engine.recordExecutionFailure(id);
    expect(engine.propose(ENV, ISSUE).action).toBe('CIRCUIT_OPEN');
    expect(engine.getProposal(id)!.proposalId).toBe(id);
    expect(engine.listProposals(ENV)).toHaveLength(1);
  });

  it('half-opens after cooldownMs and closes on a successful transition', () => {
    const { engine, clock } = makeEngine({ maxFailures: 2, cooldownMs: 60_000 });
    const id = engine.propose(ENV, ISSUE).proposal!.proposalId;
    engine.recordExecutionFailure(id);
    engine.recordExecutionFailure(id);
    expect(engine.approve(id).action).toBe('CIRCUIT_OPEN');

    clock.advance(61_000); // cooldown elapsed -> half-open
    const decision = engine.approve(id);
    expect(decision.action).toBe('APPROVED');

    // Breaker closed again: subsequent mutations flow.
    const next = engine.propose(ENV, 'WF_DRIFT_MISMATCH');
    expect(next.action).toBe('PROPOSED');
  });

  it('a successful approve in half-open closes the breaker and resets the failure count', () => {
    const { engine, clock } = makeEngine({ maxFailures: 2, cooldownMs: 10_000 });
    const id = engine.propose(ENV, ISSUE).proposal!.proposalId;
    engine.recordExecutionFailure(id);
    engine.recordExecutionFailure(id);
    expect(engine.propose(ENV, 'WF_DRIFT_MISMATCH').action).toBe('CIRCUIT_OPEN');

    clock.advance(11_000);
    expect(engine.approve(id).action).toBe('APPROVED'); // success closes + resets

    // Count was reset: a single failure stays below maxFailures.
    engine.recordExecutionFailure(id);
    expect(engine.propose('env-z', 'INGESTION_GAP').action).toBe('PROPOSED');
  });

  it('half-open failures before cooldown do not allow calls through', () => {
    const { engine, clock } = makeEngine({ maxFailures: 2, cooldownMs: 60_000 });
    const id = engine.propose(ENV, ISSUE).proposal!.proposalId;
    engine.recordExecutionFailure(id);
    engine.recordExecutionFailure(id);
    clock.advance(30_000); // still within cooldown
    expect(engine.approve(id).action).toBe('CIRCUIT_OPEN');
    clock.advance(31_000); // now past cooldown
    expect(engine.approve(id).action).toBe('APPROVED');
  });

  it('recordExecutionFailure re-opens the breaker when it fires during half-open', () => {
    const { engine, clock } = makeEngine({ maxFailures: 2, cooldownMs: 60_000 });
    const id = engine.propose(ENV, ISSUE).proposal!.proposalId;
    engine.recordExecutionFailure(id);
    engine.recordExecutionFailure(id);
    clock.advance(61_000);
    engine.recordExecutionFailure(id); // feed during half-open: count now 3 >= 2 -> re-open
    expect(engine.approve(id).action).toBe('CIRCUIT_OPEN');
  });

  it('a replay (REPLAY_IGNORED) in half-open does not close the breaker', () => {
    const { engine, clock } = makeEngine({ maxFailures: 1, cooldownMs: 60_000 });
    engine.propose(ENV, ISSUE);
    engine.recordExecutionFailure('any');
    clock.advance(61_000);
    expect(engine.propose(ENV, ISSUE).action).toBe('REPLAY_IGNORED');
    // Not a success: breaker stays half-open. The NEXT mutating call is
    // allowed through and its success closes the breaker.
    expect(engine.propose('env-q', 'WF_DRIFT_MISMATCH').action).toBe('PROPOSED');
    expect(engine.propose('env-r', 'INGESTION_GAP').action).toBe('PROPOSED');
  });
});
