/**
 * Eval suite 2: replay protection (operator-plan 7.2 — idempotency key;
 * Phase G exit gate — "exercise ... replay").
 *
 * Proposing the same (environmentKey, issueCode) twice returns REPLAY_IGNORED
 * with the SAME proposalId and never creates a duplicate entry; different
 * environments or issueCodes create fully independent proposals; sequential
 * creates at a fixed clock still get unique proposalIds.
 */

import { RemediationEngine } from '../../src/remediation';
import {
  buildEngineOptions,
  ENV_A,
  ENV_B,
  ISSUE_ALERT_DELIVERY,
  ISSUE_EVIDENCE_STALE,
  makeRunbook,
  T0,
  ManualClock,
} from './fixtures';

describe('RemediationEngine — replay evals', () => {
  it('second propose of the same (environment, issueCode) is REPLAY_IGNORED with the same proposalId', () => {
    const engine = new RemediationEngine(buildEngineOptions());

    const first = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE);
    const second = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE);

    expect(first.action).toBe('PROPOSED');
    expect(second.action).toBe('REPLAY_IGNORED');
    expect(second.proposal).toBeDefined();
    expect(second.proposal!.proposalId).toBe(first.proposal!.proposalId);
  });

  it('a replay creates no duplicate in listProposals', () => {
    const engine = new RemediationEngine(buildEngineOptions());

    engine.propose(ENV_A, ISSUE_EVIDENCE_STALE);
    engine.propose(ENV_A, ISSUE_EVIDENCE_STALE);
    engine.propose(ENV_A, ISSUE_EVIDENCE_STALE);

    expect(engine.listProposals(ENV_A)).toHaveLength(1);
  });

  it('replays return the live proposal while it is non-terminal; a terminal approval ends dedup', () => {
    const engine = new RemediationEngine(buildEngineOptions());

    const first = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE);
    const replay = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE);
    expect(replay.action).toBe('REPLAY_IGNORED');
    expect(replay.proposal!.proposalId).toBe(first.proposal!.proposalId);
    expect(replay.proposal!.status).toBe('PROPOSED');

    // A terminal decision ends replay dedup: the same issueCode afterwards is
    // a new occurrence and mints a fresh proposal.
    engine.approve(first.proposal!.proposalId);
    const after = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE);
    expect(after.action).toBe('PROPOSED');
    expect(after.proposal!.proposalId).not.toBe(first.proposal!.proposalId);
    expect(engine.listProposals(ENV_A)).toHaveLength(2);
  });

  it('the same issueCode in a different environment is an independent proposal', () => {
    const engine = new RemediationEngine(buildEngineOptions());

    const inA = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE);
    const inB = engine.propose(ENV_B, ISSUE_EVIDENCE_STALE);

    expect(inB.action).toBe('PROPOSED');
    expect(inB.proposal!.proposalId).not.toBe(inA.proposal!.proposalId);
    expect(engine.listProposals(ENV_A)).toHaveLength(1);
    expect(engine.listProposals(ENV_B)).toHaveLength(1);
  });

  it('a different issueCode in the same environment is an independent proposal', () => {
    const engine = new RemediationEngine(buildEngineOptions());

    const first = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE);
    const second = engine.propose(ENV_A, ISSUE_ALERT_DELIVERY);

    expect(second.action).toBe('PROPOSED');
    expect(second.proposal!.proposalId).not.toBe(first.proposal!.proposalId);
    expect(engine.listProposals(ENV_A)).toHaveLength(2);
  });

  it('unique proposalIds across rapid sequential creates at a fixed clock', () => {
    const clock = new ManualClock(T0);
    const registry = [
      makeRunbook({ runbookKey: 'RB-SYN-001', issueCode: 'ISSUE_001' }),
      makeRunbook({ runbookKey: 'RB-SYN-002', issueCode: 'ISSUE_002' }),
      makeRunbook({ runbookKey: 'RB-SYN-003', issueCode: 'ISSUE_003' }),
      makeRunbook({ runbookKey: 'RB-SYN-004', issueCode: 'ISSUE_004' }),
      makeRunbook({ runbookKey: 'RB-SYN-005', issueCode: 'ISSUE_005' }),
    ];
    const custom = new RemediationEngine(buildEngineOptions({ registry, now: clock.now }));

    const ids = [
      custom.propose(ENV_A, 'ISSUE_001').proposal!.proposalId,
      custom.propose(ENV_A, 'ISSUE_002').proposal!.proposalId,
      custom.propose(ENV_A, 'ISSUE_003').proposal!.proposalId,
      custom.propose(ENV_B, 'ISSUE_001').proposal!.proposalId,
      custom.propose(ENV_A, 'ISSUE_004').proposal!.proposalId,
      custom.propose(ENV_A, 'ISSUE_005').proposal!.proposalId,
    ];

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('approve/reject are idempotent-safe: acting twice on one proposal never creates a second proposal', () => {
    const engine = new RemediationEngine(buildEngineOptions());

    const proposal = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).proposal!;
    engine.approve(proposal.proposalId);
    engine.approve(proposal.proposalId);
    engine.reject(proposal.proposalId);

    expect(engine.listProposals(ENV_A)).toHaveLength(1);
    expect(engine.getProposal(proposal.proposalId)!.status).toBe('APPROVED');
  });
});
