/**
 * Eval suite 5: circuit breaker (operator-plan 7.2 — circuit-breaker policy;
 * 12 — repeated failure stops the controller).
 *
 * After maxFailures recorded execution failures the breaker opens: every
 * mutating call (propose/approve/reject) returns CIRCUIT_OPEN with zero
 * state change, while read paths (getProposal/listProposals) still serve.
 * Once cooldownMs has elapsed the next mutating call passes through
 * (half-open); a successful transition closes the breaker and resets the
 * failure counter.
 */

import { RemediationEngine } from '../../src/remediation';
import {
  buildEngineOptions,
  ENV_A,
  ENV_B,
  ISSUE_EVIDENCE_STALE,
  ManualClock,
  T0,
} from './fixtures';

describe('RemediationEngine — circuit-breaker evals', () => {
  it('opens after maxFailures recorded failures: mutating calls return CIRCUIT_OPEN', () => {
    const engine = new RemediationEngine(buildEngineOptions({ maxFailures: 2 }));
    const id = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).proposal!.proposalId;

    engine.recordExecutionFailure(id);
    expect(engine.propose(ENV_B, ISSUE_EVIDENCE_STALE).action).toBe('PROPOSED');

    engine.recordExecutionFailure(id); // second failure reaches the cap
    expect(engine.propose(ENV_B, 'ALERT_DELIVERY_FAILURE').action).toBe('CIRCUIT_OPEN');
    expect(engine.approve(id).action).toBe('CIRCUIT_OPEN');
    expect(engine.reject(id).action).toBe('CIRCUIT_OPEN');
  });

  it('an open breaker makes zero state changes', () => {
    const engine = new RemediationEngine(buildEngineOptions({ maxFailures: 1 }));
    const id = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).proposal!;
    engine.recordExecutionFailure(id.proposalId);

    const before = JSON.stringify(engine.listProposals());
    engine.propose(ENV_B, ISSUE_EVIDENCE_STALE);
    engine.approve(id.proposalId);
    engine.reject(id.proposalId);

    expect(JSON.stringify(engine.listProposals())).toBe(before);
    expect(engine.listProposals(ENV_B)).toHaveLength(0);
    expect(engine.getProposal(id.proposalId)!.status).toBe('PROPOSED');
  });

  it('read paths still serve while the breaker is open', () => {
    const engine = new RemediationEngine(buildEngineOptions({ maxFailures: 1 }));
    const id = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).proposal!.proposalId;
    engine.recordExecutionFailure(id);

    expect(engine.getProposal(id)).toBeDefined();
    expect(engine.listProposals()).toHaveLength(1);
    expect(engine.listProposals(ENV_A)).toHaveLength(1);
  });

  it('after cooldownMs the next mutating call passes through (half-open) and closes the breaker', () => {
    const clock = new ManualClock(T0);
    const engine = new RemediationEngine(
      buildEngineOptions({ maxFailures: 1, cooldownMs: 60_000, now: clock.now }),
    );
    const id = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).proposal!.proposalId;
    engine.recordExecutionFailure(id);

    clock.advance(30_000);
    expect(engine.propose(ENV_B, ISSUE_EVIDENCE_STALE).action).toBe('CIRCUIT_OPEN');

    clock.advance(31_000); // cooldown elapsed
    expect(engine.approve(id).action).toBe('APPROVED'); // passes through

    // Closed again: new proposals flow.
    expect(engine.propose(ENV_B, ISSUE_EVIDENCE_STALE).action).toBe('PROPOSED');
  });

  it('a successful transition resets the failure counter', () => {
    const clock = new ManualClock(T0);
    const engine = new RemediationEngine(
      buildEngineOptions({ maxFailures: 2, cooldownMs: 60_000, now: clock.now }),
    );
    const first = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).proposal!.proposalId;

    engine.recordExecutionFailure(first);
    engine.recordExecutionFailure(first); // breaker opens at 2/2
    expect(engine.propose(ENV_B, ISSUE_EVIDENCE_STALE).action).toBe('CIRCUIT_OPEN');

    clock.advance(61_000);
    expect(engine.approve(first).action).toBe('APPROVED'); // success → close + reset

    // Counter was reset: a single new failure must NOT reopen the breaker.
    const second = engine.propose(ENV_B, ISSUE_EVIDENCE_STALE).proposal!.proposalId;
    engine.recordExecutionFailure(second);
    expect(engine.propose(ENV_B, 'ALERT_DELIVERY_FAILURE').action).toBe('PROPOSED');
  });

  it('failures below the cap do not open the breaker', () => {
    const engine = new RemediationEngine(buildEngineOptions({ maxFailures: 3 }));
    const id = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).proposal!.proposalId;

    engine.recordExecutionFailure(id);
    engine.recordExecutionFailure(id);

    expect(engine.approve(id).action).toBe('APPROVED');
  });
});
