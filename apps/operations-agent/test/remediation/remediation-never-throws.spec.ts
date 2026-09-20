import { ProposalDecision, RemediationEngine } from '../../src/remediation';
import { makeEngine, ENV, ISSUE, FIXED_NOW_MS } from './fakes';

const ACTIONS: ProposalDecision['action'][] = [
  'PROPOSED',
  'REPLAY_IGNORED',
  'EXPIRED',
  'APPROVED',
  'REJECTED',
  'CIRCUIT_OPEN',
];

describe('remediation never-throws property pass', () => {
  it('exposes no execute/run/apply/dispatch method (execute-nothing)', () => {
    const engine: unknown = new RemediationEngine();
    expect(typeof (engine as RemediationEngine).propose).toBe('function');
    expect(typeof (engine as RemediationEngine).approve).toBe('function');
    expect(typeof (engine as RemediationEngine).reject).toBe('function');
    expect(typeof (engine as RemediationEngine).getProposal).toBe('function');
    expect(typeof (engine as RemediationEngine).listProposals).toBe('function');
    expect(typeof (engine as RemediationEngine).recordExecutionFailure).toBe('function');
    for (const forbidden of ['execute', 'run', 'apply', 'dispatch', 'perform']) {
      expect((engine as Record<string, unknown>)[forbidden]).toBeUndefined();
    }
  });

  it('always returns a valid decision action across adversarial inputs', () => {
    const { engine } = makeEngine();
    const decisions: ProposalDecision[] = [
      engine.propose(ENV, ISSUE),
      engine.propose(ENV, ISSUE),
      engine.propose(ENV, 'NOPE'),
      engine.propose('', ''),
      engine.propose(null as never, undefined as never),
      engine.approve('missing'),
      engine.approve(''),
      engine.approve(null as never),
      engine.reject(undefined as never),
      engine.propose(ENV, 'WF_DRIFT_MISMATCH'),
    ];
    for (const decision of decisions) {
      expect(ACTIONS).toContain(decision.action);
    }
    expect(engine.getProposal(null as never)).toBeUndefined();
    expect(Array.isArray(engine.listProposals(null as never))).toBe(true);
    expect(() => engine.recordExecutionFailure(null as never)).not.toThrow();
  });

  it('synchronous API: no promises anywhere', () => {
    const { engine } = makeEngine();
    const proposed = engine.propose(ENV, ISSUE);
    expect(proposed).not.toBeInstanceOf(Promise);
    const approved = engine.approve(proposed.proposal!.proposalId);
    expect(approved).not.toBeInstanceOf(Promise);
    expect(engine.getProposal(proposed.proposal!.proposalId)).not.toBeInstanceOf(Promise);
    expect(engine.listProposals()).not.toBeInstanceOf(Promise);
  });

  it('survives a hostile clock (NaN / negative / jumping)', () => {
    let current = FIXED_NOW_MS;
    const engine = new RemediationEngine({ now: () => current });
    const id = engine.propose(ENV, ISSUE).proposal!.proposalId;
    current = Number.NaN;
    expect(ACTIONS).toContain(engine.approve(id).action);
    current = -5;
    expect(ACTIONS).toContain(engine.propose(ENV, 'INGESTION_GAP').action);
    current = Number.MAX_SAFE_INTEGER;
    expect(Array.isArray(engine.listProposals())).toBe(true);
    expect(() => engine.recordExecutionFailure(id)).not.toThrow();
  });

  it('survives a randomized sequence of operations', () => {
    const { engine, clock } = makeEngine({ maxFailures: 3 });
    let seed = 7;
    const rand = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    const issues = ['WF_STALE_SNAPSHOT', 'WF_DRIFT_MISMATCH', 'INGESTION_GAP', 'UNKNOWN'];
    const ids: string[] = [];
    for (let i = 0; i < 150; i += 1) {
      const op = rand();
      if (op < 0.45) {
        const d = engine.propose(ENV, issues[Math.floor(rand() * issues.length)]);
        expect(ACTIONS).toContain(d.action);
        if (d.proposal) ids.push(d.proposal.proposalId);
      } else if (op < 0.7 && ids.length > 0) {
        const d = engine.approve(ids[Math.floor(rand() * ids.length)]);
        expect(ACTIONS).toContain(d.action);
      } else if (op < 0.85 && ids.length > 0) {
        const d = engine.reject(ids[Math.floor(rand() * ids.length)]);
        expect(ACTIONS).toContain(d.action);
      } else {
        engine.recordExecutionFailure(ids[0] ?? 'none');
      }
      clock.advance(Math.floor(rand() * 5_000));
    }
    expect(Array.isArray(engine.listProposals())).toBe(true);
  });
});
