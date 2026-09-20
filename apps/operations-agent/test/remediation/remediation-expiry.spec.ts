import { RemediationRunbook } from '../../src/remediation';
import { makeEngine, ENV, ISSUE, FIXED_NOW_MS } from './fakes';

const SHORT_RUNBOOK: RemediationRunbook = {
  runbookKey: 'rb-short',
  tier: 'A',
  issueCode: ISSUE,
  summary: 'Synthetic short-ttl runbook.',
  preconditions: ['precondition one'],
  expectedImpact: 'impact one',
  verification: ['verification one'],
  rollback: ['rollback one'],
  ttlMs: 60_000,
};

describe('remediation lazy expiry', () => {
  it('flips an expired proposal to EXPIRED on getProposal (persisted)', () => {
    const { engine, clock } = makeEngine({ registry: [SHORT_RUNBOOK] });
    const decision = engine.propose(ENV, ISSUE);
    const id = decision.proposal!.proposalId;

    clock.advance(61_000);
    const read = engine.getProposal(id);
    expect(read!.status).toBe('EXPIRED');
    // Persisted: a later read before further time travel stays EXPIRED.
    clock.set(FIXED_NOW_MS + 62_000);
    expect(engine.getProposal(id)!.status).toBe('EXPIRED');
  });

  it('still PROPOSED just before expiresAt', () => {
    const { engine, clock } = makeEngine({ registry: [SHORT_RUNBOOK] });
    const decision = engine.propose(ENV, ISSUE);
    clock.advance(59_999);
    expect(engine.getProposal(decision.proposal!.proposalId)!.status).toBe('PROPOSED');
  });

  it('approve on an expired proposal returns EXPIRED with the proposal', () => {
    const { engine, clock } = makeEngine({ registry: [SHORT_RUNBOOK] });
    const id = engine.propose(ENV, ISSUE).proposal!.proposalId;
    clock.advance(61_000);
    const decision = engine.approve(id);
    expect(decision.action).toBe('EXPIRED');
    expect(decision.proposal!.status).toBe('EXPIRED');
  });

  it('reject on an expired proposal returns EXPIRED with the proposal', () => {
    const { engine, clock } = makeEngine({ registry: [SHORT_RUNBOOK] });
    const id = engine.propose(ENV, ISSUE).proposal!.proposalId;
    clock.advance(120_000);
    const decision = engine.reject(id);
    expect(decision.action).toBe('EXPIRED');
    expect(decision.proposal!.status).toBe('EXPIRED');
  });

  it('a new propose after expiry creates a fresh proposal', () => {
    const { engine, clock } = makeEngine({ registry: [SHORT_RUNBOOK] });
    const first = engine.propose(ENV, ISSUE);
    clock.advance(61_000);
    // The expired proposal no longer blocks: replay check ignores it.
    const second = engine.propose(ENV, ISSUE);
    expect(second.action).toBe('PROPOSED');
    expect(second.proposal!.proposalId).not.toBe(first.proposal!.proposalId);
    expect(second.proposal!.createdAt).toBe(new Date(FIXED_NOW_MS + 61_000).toISOString());
  });

  it('listProposals flips expired entries lazily and still lists them', () => {
    const { engine, clock } = makeEngine({ registry: [SHORT_RUNBOOK] });
    engine.propose(ENV, ISSUE);
    clock.advance(61_000);
    const listed = engine.listProposals(ENV);
    expect(listed).toHaveLength(1);
    expect(listed[0].status).toBe('EXPIRED');
  });
});
