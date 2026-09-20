/**
 * Eval suite 8: tenant isolation (operator-plan 10 — every tenant-scoped
 * record requires client_id, composite tenant-safe keys; 14 — "cross-tenant
 * read/write denial").
 *
 * Proposals for environment A are invisible to listProposals(environment B)
 * and vice versa; the same issueCode proposed in two environments yields two
 * fully independent proposals; the environment key is never interpolated
 * into runbook-defined text.
 */

import { RemediationEngine } from '../../src/remediation';
import {
  buildEngineOptions,
  deepFreeze,
  DEFAULT_REGISTRY,
  ENV_A,
  ENV_B,
  ISSUE_ALERT_DELIVERY,
  ISSUE_EVIDENCE_STALE,
} from './fixtures';

const ENV_MARKER = 'env_synthetic_tenant_marker_6e5b09';

describe('RemediationEngine — tenant-isolation evals', () => {
  it('proposals for env A are invisible to listProposals(env B)', () => {
    const engine = new RemediationEngine(buildEngineOptions());

    engine.propose(ENV_A, ISSUE_EVIDENCE_STALE);
    engine.propose(ENV_A, ISSUE_ALERT_DELIVERY);

    expect(engine.listProposals(ENV_B)).toHaveLength(0);
    expect(engine.listProposals(ENV_A)).toHaveLength(2);
  });

  it('listProposals() without a filter returns everything, but per-env filters stay strict', () => {
    const engine = new RemediationEngine(buildEngineOptions());

    engine.propose(ENV_A, ISSUE_EVIDENCE_STALE);
    engine.propose(ENV_B, ISSUE_EVIDENCE_STALE);

    expect(engine.listProposals()).toHaveLength(2);
    expect(engine.listProposals(ENV_A)).toHaveLength(1);
    expect(engine.listProposals(ENV_B)).toHaveLength(1);
    expect(engine.listProposals(ENV_A)[0].environmentKey).toBe(ENV_A);
    expect(engine.listProposals(ENV_B)[0].environmentKey).toBe(ENV_B);
  });

  it('the same issueCode in two environments produces two independent proposals', () => {
    const engine = new RemediationEngine(buildEngineOptions());

    const inA = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).proposal!;
    const inB = engine.propose(ENV_B, ISSUE_EVIDENCE_STALE).proposal!;

    expect(inA.proposalId).not.toBe(inB.proposalId);
    expect(inA.environmentKey).toBe(ENV_A);
    expect(inB.environmentKey).toBe(ENV_B);

    // Approving one must not touch the other.
    engine.approve(inA.proposalId);
    expect(engine.getProposal(inB.proposalId)!.status).toBe('PROPOSED');
  });

  it('approving in env A cannot mutate a proposal belonging to env B', () => {
    const engine = new RemediationEngine(buildEngineOptions());
    const inB = engine.propose(ENV_B, ISSUE_EVIDENCE_STALE).proposal!;

    // Replay/dedup is per (environment, issueCode), so env A gets its own id...
    const inA = engine.propose(ENV_A, ISSUE_EVIDENCE_STALE).proposal!;
    engine.approve(inA.proposalId);

    expect(engine.getProposal(inB.proposalId)!.status).toBe('PROPOSED');
  });

  it('environmentKey is never interpolated into runbook-defined proposal text', () => {
    const engine = new RemediationEngine(buildEngineOptions());
    const markedEnv = `env_prefix_${ENV_MARKER}`;

    const proposal = engine.propose(markedEnv, ISSUE_EVIDENCE_STALE).proposal!;
    const runbook = DEFAULT_REGISTRY.find((r) => r.issueCode === ISSUE_EVIDENCE_STALE)!;

    expect(proposal.expectedImpact).toBe(runbook.expectedImpact);
    expect(proposal.preconditions).toEqual([...runbook.preconditions]);
    expect(proposal.verification).toEqual([...runbook.verification]);
    expect(proposal.rollback).toEqual([...runbook.rollback]);
    expect(JSON.stringify([proposal.preconditions, proposal.expectedImpact, proposal.verification, proposal.rollback])).not.toContain(ENV_MARKER);
  });

  it('a foreign-shaped environmentKey is carried opaquely and does not break isolation', () => {
    const engine = new RemediationEngine(buildEngineOptions());
    const foreign = 'ten_other-env/live#42';

    const decision = engine.propose(foreign, ISSUE_EVIDENCE_STALE);

    expect(decision.action).toBe('PROPOSED');
    expect(decision.proposal!.environmentKey).toBe(foreign);
    expect(engine.listProposals(ENV_A)).toHaveLength(0);
    expect(engine.listProposals(foreign)).toHaveLength(1);
  });

  it('deep-frozen engine inputs survive a full cross-environment flow', () => {
    const engine = new RemediationEngine(buildEngineOptions({}));
    const registrySnapshot = JSON.stringify(DEFAULT_REGISTRY);

    engine.propose(deepFreeze(ENV_A) as string, deepFreeze(ISSUE_EVIDENCE_STALE) as string);
    engine.propose(ENV_B, ISSUE_EVIDENCE_STALE);

    expect(JSON.stringify(DEFAULT_REGISTRY)).toBe(registrySnapshot);
    expect(engine.listProposals(ENV_A)).toHaveLength(1);
    expect(engine.listProposals(ENV_B)).toHaveLength(1);
  });
});
