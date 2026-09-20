/**
 * Eval suite 1: issue-code → runbook mapping (operator-plan 7.3 — fixed,
 * versioned, allowlisted runbooks only).
 *
 * The default registry proposes for its own issueCodes and carries the
 * runbook's preconditions, expected impact, verification and rollback
 * verbatim into the proposal. An unknown issueCode produces EXPIRED with no
 * proposal. A custom registry replaces the default entirely.
 */

import { RemediationEngine } from '../../src/remediation';
import {
  buildEngineOptions,
  DEFAULT_REGISTRY,
  deepFreeze,
  ENV_A,
  ISSUE_ALERT_DELIVERY,
  ISSUE_EVIDENCE_STALE,
  ISSUE_UNKNOWN,
  makeRunbook,
  RB_ALERT_RETRY_KEY,
  RB_RECHECK_KEY,
} from './fixtures';

describe('RemediationEngine — mapping evals', () => {
  it.each(DEFAULT_REGISTRY.map((r) => [r.runbookKey, r.issueCode] as const))(
    'proposes via default registry runbook %s for issueCode %s',
    (runbookKey, issueCode) => {
      const engine = new RemediationEngine(buildEngineOptions());

      const decision = engine.propose(ENV_A, issueCode);

      expect(decision.action).toBe('PROPOSED');
      const proposal = decision.proposal!;
      expect(proposal.runbookKey).toBe(runbookKey);
      expect(proposal.subjectKey).toBe(issueCode);
      expect(proposal.environmentKey).toBe(ENV_A);
      expect(proposal.status).toBe('PROPOSED');
    },
  );

  it('carries preconditions, expectedImpact, verification and rollback verbatim', () => {
    const engine = new RemediationEngine(buildEngineOptions());
    const runbook = DEFAULT_REGISTRY.find((r) => r.issueCode === ISSUE_EVIDENCE_STALE)!;

    const decision = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE);
    const proposal = decision.proposal!;

    expect(proposal.preconditions).toEqual([...runbook.preconditions]);
    expect(proposal.expectedImpact).toBe(runbook.expectedImpact);
    expect(proposal.verification).toEqual([...runbook.verification]);
    expect(proposal.rollback).toEqual([...runbook.rollback]);
  });

  it('stamps createdAt/expiresAt as ISO timestamps separated by the runbook ttlMs', () => {
    const engine = new RemediationEngine(buildEngineOptions());

    const proposal = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).proposal!;
    const createdAt = Date.parse(proposal.createdAt);
    const expiresAt = Date.parse(proposal.expiresAt);

    expect(Number.isNaN(createdAt)).toBe(false);
    expect(Number.isNaN(expiresAt)).toBe(false);
    expect(expiresAt - createdAt).toBe(DEFAULT_REGISTRY[0].ttlMs);
  });

  it('unknown issueCode → EXPIRED with no proposal and nothing listed', () => {
    const engine = new RemediationEngine(buildEngineOptions());

    const decision = engine.propose(ENV_A, ISSUE_UNKNOWN);

    expect(decision.action).toBe('EXPIRED');
    expect(decision.proposal).toBeUndefined();
    expect(engine.listProposals(ENV_A)).toHaveLength(0);
  });

  it('custom registry replaces the default (default issueCodes no longer propose)', () => {
    const custom = [makeRunbook({ runbookKey: 'RB-SYNTHETIC-CUSTOM-001', issueCode: 'CUSTOM_FIX' })];
    const engine = new RemediationEngine(buildEngineOptions({ registry: custom }));

    expect(engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).action).toBe('EXPIRED');
    expect(engine.propose(ENV_A, 'CUSTOM_FIX').action).toBe('PROPOSED');
  });

  it('deep-frozen custom registry is accepted and never mutated', () => {
    const custom = deepFreeze([
      makeRunbook({ runbookKey: 'RB-SYNTHETIC-FROZEN-001' }),
    ]);
    const snapshot = JSON.stringify(custom);
    const engine = new RemediationEngine(buildEngineOptions({ registry: custom }));

    engine.propose(ENV_A, ISSUE_EVIDENCE_STALE);
    engine.propose(ENV_A, ISSUE_EVIDENCE_STALE);

    expect(JSON.stringify(custom)).toBe(snapshot);
  });

  it('proposal ids are non-empty strings', () => {
    const engine = new RemediationEngine(buildEngineOptions());

    const proposal = engine.propose(ENV_A, ISSUE_ALERT_DELIVERY).proposal!;

    expect(typeof proposal.proposalId).toBe('string');
    expect(proposal.proposalId.length).toBeGreaterThan(0);
    expect(proposal.runbookKey).toBe(RB_ALERT_RETRY_KEY);
    expect(proposal.runbookKey).not.toBe(RB_RECHECK_KEY);
  });
});
