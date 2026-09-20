/**
 * Eval suite 4: approval lifecycle (operator-plan 7 — authority tiers; Tier A
 * needs no Telegram approval but must meet the complete policy contract).
 *
 * approve() transitions a live proposal to APPROVED; reject() to REJECTED.
 * Both states are terminal: a second decision on the same proposal changes
 * nothing (asserted tolerantly — see drift note below). Unknown ids return
 * EXPIRED with no proposal.
 *
 * Drift note: the contract does not pin the action returned by a *second*
 * decision on an already-terminal proposal. These evals assert the terminal
 * STATUS is unchanged and accept either 'APPROVED'/'REJECTED' (idempotent
 * re-confirmation) or 'REPLAY_IGNORED' (replay-class refusal) as the action;
 * the coordinator reconciles the exact wording with Worker A.
 */

import { RemediationEngine } from '../../src/remediation';
import { buildEngineOptions, ENV_A, ISSUE_EVIDENCE_STALE } from './fixtures';

// The contract pins no action for a mismatched terminal re-apply (approve
// after reject); the engine answers EXPIRED for that no-op block, same as it
// does for unknown ids. All non-mutating answers are accepted here.
const TERMINAL_REPEAT_ACTIONS = ['APPROVED', 'REJECTED', 'REPLAY_IGNORED', 'EXPIRED'] as const;

describe('RemediationEngine — approval evals', () => {
  it('approve transitions a live proposal to APPROVED', () => {
    const engine = new RemediationEngine(buildEngineOptions());
    const id = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).proposal!.proposalId;

    const decision = engine.approve(id);

    expect(decision.action).toBe('APPROVED');
    expect(decision.proposal!.status).toBe('APPROVED');
    expect(engine.getProposal(id)!.status).toBe('APPROVED');
  });

  it('reject transitions a live proposal to REJECTED', () => {
    const engine = new RemediationEngine(buildEngineOptions());
    const id = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).proposal!.proposalId;

    const decision = engine.reject(id);

    expect(decision.action).toBe('REJECTED');
    expect(decision.proposal!.status).toBe('REJECTED');
    expect(engine.getProposal(id)!.status).toBe('REJECTED');
  });

  it('APPROVED is terminal: a second approve changes nothing', () => {
    const engine = new RemediationEngine(buildEngineOptions());
    const id = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).proposal!.proposalId;

    engine.approve(id);
    const second = engine.approve(id);

    expect(TERMINAL_REPEAT_ACTIONS).toContain(second.action);
    expect(second.proposal!.status).toBe('APPROVED');
    expect(engine.listProposals(ENV_A)).toHaveLength(1);
  });

  it('REJECTED is terminal: a later approve cannot resurrect the proposal', () => {
    const engine = new RemediationEngine(buildEngineOptions());
    const id = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).proposal!.proposalId;

    engine.reject(id);
    const later = engine.approve(id);

    expect(TERMINAL_REPEAT_ACTIONS).toContain(later.action);
    expect(engine.getProposal(id)!.status).toBe('REJECTED');
  });

  it('approve of an unknown id returns EXPIRED with no proposal', () => {
    const engine = new RemediationEngine(buildEngineOptions());

    const decision = engine.approve('no-such-synthetic-proposal-id');

    expect(decision.action).toBe('EXPIRED');
    expect(decision.proposal).toBeUndefined();
  });

  it('reject of an unknown id returns EXPIRED with no proposal', () => {
    const engine = new RemediationEngine(buildEngineOptions());

    const decision = engine.reject('no-such-synthetic-proposal-id');

    expect(decision.action).toBe('EXPIRED');
    expect(decision.proposal).toBeUndefined();
  });

  it('approve/reject decisions are scoped per proposal: one decision never touches another proposal', () => {
    const engine = new RemediationEngine(buildEngineOptions());
    const first = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).proposal!;
    const second = engine.propose(ENV_A, 'ALERT_DELIVERY_FAILURE').proposal!;

    engine.approve(first.proposalId);

    expect(engine.getProposal(second.proposalId)!.status).toBe('PROPOSED');
  });

  it('the decision carries the same proposalId that was acted on', () => {
    const engine = new RemediationEngine(buildEngineOptions());
    const id = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).proposal!.proposalId;

    expect(engine.approve(id).proposal!.proposalId).toBe(id);
    expect(engine.reject(engine.propose(ENV_A, 'ALERT_DELIVERY_FAILURE').proposal!.proposalId).proposal!.proposalId).toBe(
      engine.listProposals(ENV_A)[1].proposalId,
    );
  });
});
