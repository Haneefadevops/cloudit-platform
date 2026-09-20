import {
  DEFAULT_TIER_A_RUNBOOKS,
  RemediationRunbook,
} from '../../src/remediation';
import { makeEngine, ENV, ISSUE, FIXED_NOW_MS } from './fakes';

const RUNBOOK = DEFAULT_TIER_A_RUNBOOKS.find((r) => r.issueCode === ISSUE)!;

describe('remediation registry mapping and propose', () => {
  it('ships at least three synthetic tier-A runbooks with all display fields', () => {
    expect(DEFAULT_TIER_A_RUNBOOKS.length).toBeGreaterThanOrEqual(3);
    for (const runbook of DEFAULT_TIER_A_RUNBOOKS) {
      expect(runbook.tier).toBe('A');
      expect(runbook.runbookKey).toContain('rb-');
      expect(runbook.issueCode.length).toBeGreaterThan(0);
      expect(runbook.preconditions.length).toBeGreaterThan(0);
      expect(runbook.expectedImpact.length).toBeGreaterThan(0);
      expect(runbook.verification.length).toBeGreaterThan(0);
      expect(runbook.rollback.length).toBeGreaterThan(0);
      expect(runbook.ttlMs).toBeGreaterThan(0);
    }
  });

  it('creates a PROPOSED proposal carrying the exact registry display text', () => {
    const { engine } = makeEngine();
    const decision = engine.propose(ENV, ISSUE);

    expect(decision.action).toBe('PROPOSED');
    const p = decision.proposal!;
    expect(p.proposalId).toBe(`rem-${ISSUE}-${ENV}-${FIXED_NOW_MS}-1`);
    expect(p.environmentKey).toBe(ENV);
    expect(p.subjectKey).toBe(ISSUE);
    expect(p.runbookKey).toBe(RUNBOOK.runbookKey);
    expect(p.status).toBe('PROPOSED');
    expect(p.createdAt).toBe(new Date(FIXED_NOW_MS).toISOString());
    expect(p.expiresAt).toBe(new Date(FIXED_NOW_MS + RUNBOOK.ttlMs).toISOString());
    expect(p.preconditions).toEqual(RUNBOOK.preconditions);
    expect(p.expectedImpact).toBe(RUNBOOK.expectedImpact);
    expect(p.verification).toEqual(RUNBOOK.verification);
    expect(p.rollback).toEqual(RUNBOOK.rollback);
  });

  it('returns EXPIRED with no proposal for an unknown issueCode', () => {
    const { engine, auditEvents } = makeEngine();
    const decision = engine.propose(ENV, 'NO_SUCH_ISSUE');
    expect(decision.action).toBe('EXPIRED');
    expect(decision.proposal).toBeUndefined();
    expect(engine.listProposals()).toHaveLength(0);
    expect(auditEvents).toHaveLength(1);
  });

  it('uses a custom registry when provided', () => {
    const custom: RemediationRunbook = {
      runbookKey: 'rb-custom',
      tier: 'A',
      issueCode: 'CUSTOM_ISSUE',
      summary: 'Custom synthetic runbook.',
      preconditions: ['custom precondition'],
      expectedImpact: 'custom impact',
      verification: ['custom verification'],
      rollback: ['custom rollback'],
      ttlMs: 60_000,
    };
    const { engine } = makeEngine({ registry: [custom] });
    const decision = engine.propose(ENV, 'CUSTOM_ISSUE');
    expect(decision.action).toBe('PROPOSED');
    expect(decision.proposal!.runbookKey).toBe('rb-custom');
    expect(engine.propose(ENV, ISSUE).action).toBe('EXPIRED');
  });

  it('never interpolates environmentKey/issueCode into runbook text', () => {
    const { engine } = makeEngine();
    const decision = engine.propose('env-very-specific', ISSUE);
    const p = decision.proposal!;
    expect(JSON.stringify([p.preconditions, p.expectedImpact, p.verification, p.rollback])).not.toContain(
      'env-very-specific',
    );
  });

  it('generates unique proposalIds even at a fixed clock', () => {
    const { engine } = makeEngine();
    const ids = new Set<string>();
    for (let i = 0; i < 5; i += 1) {
      const decision = engine.propose(ENV, ISSUE);
      if (decision.action === 'PROPOSED') ids.add(decision.proposal!.proposalId);
      // Move each proposal to a terminal state so the next propose is fresh.
      engine.reject(decision.proposal!.proposalId);
    }
    expect(ids.size).toBe(5);
  });
});
