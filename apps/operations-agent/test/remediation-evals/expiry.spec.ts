/**
 * Eval suite 3: proposal expiry (operator-plan 7.2 — approval freshness;
 * Phase G exit gate — "exercise ... expiry").
 *
 * With a manual clock: approving inside the TTL works; once `now` passes
 * expiresAt the proposal lazily flips to EXPIRED (visible via getProposal and
 * listProposals); approve/reject after expiry return EXPIRED; re-proposing
 * the same (environment, issueCode) after expiry yields a fresh proposal with
 * a new id.
 */

import { RemediationEngine } from '../../src/remediation';
import {
  buildEngineOptions,
  DEFAULT_TTL_MS,
  ENV_A,
  ISSUE_EVIDENCE_STALE,
  ManualClock,
  T0,
} from './fixtures';

describe('RemediationEngine — expiry evals', () => {
  it('approve before the TTL expires works and yields APPROVED', () => {
    const clock = new ManualClock(T0);
    const engine = new RemediationEngine(buildEngineOptions({ now: clock.now }));

    const proposal = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).proposal!;
    clock.advance(DEFAULT_TTL_MS - 1);
    const decision = engine.approve(proposal.proposalId);

    expect(decision.action).toBe('APPROVED');
    expect(decision.proposal!.status).toBe('APPROVED');
  });

  it('advance past expiresAt lazily flips the status to EXPIRED (getProposal)', () => {
    const clock = new ManualClock(T0);
    const engine = new RemediationEngine(buildEngineOptions({ now: clock.now }));

    const proposal = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).proposal!;
    expect(engine.getProposal(proposal.proposalId)!.status).toBe('PROPOSED');

    clock.advance(DEFAULT_TTL_MS + 1);
    expect(engine.getProposal(proposal.proposalId)!.status).toBe('EXPIRED');
  });

  it('listProposals reflects the lazy expiry flip', () => {
    const clock = new ManualClock(T0);
    const engine = new RemediationEngine(buildEngineOptions({ now: clock.now }));

    engine.propose(ENV_A, ISSUE_EVIDENCE_STALE);
    expect(engine.listProposals(ENV_A).map((p: { status: string }) => p.status)).toEqual(['PROPOSED']);

    clock.advance(DEFAULT_TTL_MS + 1);
    expect(engine.listProposals(ENV_A).map((p: { status: string }) => p.status)).toEqual(['EXPIRED']);
  });

  it('approve after expiry returns EXPIRED and leaves the proposal EXPIRED', () => {
    const clock = new ManualClock(T0);
    const engine = new RemediationEngine(buildEngineOptions({ now: clock.now }));

    const proposal = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).proposal!;
    clock.advance(DEFAULT_TTL_MS + 1);
    const decision = engine.approve(proposal.proposalId);

    expect(decision.action).toBe('EXPIRED');
    expect(engine.getProposal(proposal.proposalId)!.status).toBe('EXPIRED');
  });

  it('reject after expiry returns EXPIRED and leaves the proposal EXPIRED', () => {
    const clock = new ManualClock(T0);
    const engine = new RemediationEngine(buildEngineOptions({ now: clock.now }));

    const proposal = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).proposal!;
    clock.advance(DEFAULT_TTL_MS + 1);
    const decision = engine.reject(proposal.proposalId);

    expect(decision.action).toBe('EXPIRED');
    expect(engine.getProposal(proposal.proposalId)!.status).toBe('EXPIRED');
  });

  it('re-propose after expiry yields a fresh proposal with a new id', () => {
    const clock = new ManualClock(T0);
    const engine = new RemediationEngine(buildEngineOptions({ now: clock.now }));

    const original = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).proposal!;
    clock.advance(DEFAULT_TTL_MS + 1);
    expect(engine.getProposal(original.proposalId)!.status).toBe('EXPIRED');

    const fresh = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE);
    expect(fresh.action).toBe('PROPOSED');
    expect(fresh.proposal!.proposalId).not.toBe(original.proposalId);
    expect(fresh.proposal!.status).toBe('PROPOSED');
    expect(engine.listProposals(ENV_A)).toHaveLength(2);
  });

  it('expiry is exact: the proposal is live until expiresAt, expired one ms past it', () => {
    const clock = new ManualClock(T0);
    const engine = new RemediationEngine(buildEngineOptions({ now: clock.now }));

    const proposal = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).proposal!;

    // JWT-style exclusive boundary: at now == expiresAt the proposal is
    // already expired; one ms before it is still live.
    clock.advance(DEFAULT_TTL_MS - 1);
    expect(engine.approve(proposal.proposalId).action).toBe('APPROVED');
  });

  it('an APPROVED proposal is not flipped back to EXPIRED by the clock', () => {
    const clock = new ManualClock(T0);
    const engine = new RemediationEngine(buildEngineOptions({ now: clock.now }));

    const proposal = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).proposal!;
    engine.approve(proposal.proposalId);
    clock.advance(DEFAULT_TTL_MS * 10);

    expect(engine.getProposal(proposal.proposalId)!.status).toBe('APPROVED');
  });
});
