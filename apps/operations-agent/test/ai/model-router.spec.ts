import { ModelRouter, RoutingInput } from '../../src/ai';

const ROUTINE = 'gpt-5.6-luna';
const ESCALATION = 'gpt-5.6-terra';

function makeRouter(now: () => number, maxEscalationsPerDay = 3): ModelRouter {
  return new ModelRouter({
    routineModel: ROUTINE,
    escalationModel: ESCALATION,
    maxEscalationsPerDay,
    now,
  });
}

function input(overrides: Partial<RoutingInput> = {}): RoutingInput {
  return {
    deterministicStatus: 'RED',
    conflictingSignals: true,
    lowConfidence: false,
    ownerRequestedDeepExplanation: false,
    ...overrides,
  };
}

describe('ModelRouter (operator-plan 8.2)', () => {
  it('routes RED with conflicting signals to escalation (Terra)', () => {
    const decision = makeRouter(() => 0).decide(input());
    expect(decision).toEqual({ model: 'escalation', reason: 'CONFLICTING_RED_SIGNALS' });
  });

  it('routes RED alone to routine (Luna)', () => {
    const decision = makeRouter(() => 0).decide(input({ conflictingSignals: false }));
    expect(decision).toEqual({ model: 'routine' });
  });

  it('routes AMBER with conflicting signals to routine', () => {
    const decision = makeRouter(() => 0).decide(
      input({ deterministicStatus: 'AMBER', conflictingSignals: true }),
    );
    expect(decision).toEqual({ model: 'routine' });
  });

  it('routes GREEN with conflicting signals to routine', () => {
    const decision = makeRouter(() => 0).decide(
      input({ deterministicStatus: 'GREEN', conflictingSignals: true }),
    );
    expect(decision).toEqual({ model: 'routine' });
  });

  it('routes owner-requested deep explanation to escalation regardless of status', () => {
    const decision = makeRouter(() => 0).decide(
      input({ deterministicStatus: 'GREEN', conflictingSignals: false, ownerRequestedDeepExplanation: true }),
    );
    expect(decision).toEqual({ model: 'escalation', reason: 'OWNER_REQUESTED_DEEP_EXPLANATION' });
  });

  it('routes low-confidence output to escalation', () => {
    const decision = makeRouter(() => 0).decide(input({ conflictingSignals: false, lowConfidence: true }));
    expect(decision).toEqual({ model: 'escalation', reason: 'LOW_CONFIDENCE' });
  });

  it('falls back to routine on the 4th escalation in the same UTC day (cap 3)', () => {
    let now = Date.UTC(2026, 8, 28, 10, 0, 0);
    const router = makeRouter(() => now);
    const red = input();
    expect(router.decide(red).model).toBe('escalation');
    expect(router.decide(red).model).toBe('escalation');
    expect(router.decide(red).model).toBe('escalation');
    expect(router.decide(red)).toEqual({ model: 'routine' });
  });

  it('resets the escalation budget on the next UTC day', () => {
    let now = Date.UTC(2026, 8, 28, 10, 0, 0);
    const router = makeRouter(() => now);
    const red = input();
    router.decide(red);
    router.decide(red);
    router.decide(red);
    expect(router.decide(red).model).toBe('routine');
    now = Date.UTC(2026, 8, 29, 0, 30, 0); // next UTC day
    expect(router.decide(red)).toEqual({ model: 'escalation', reason: 'CONFLICTING_RED_SIGNALS' });
  });

  it('respects a custom escalation cap', () => {
    const router = makeRouter(() => 0, 1);
    const red = input();
    expect(router.decide(red).model).toBe('escalation');
    expect(router.decide(red)).toEqual({ model: 'routine' });
  });

  it('never throws on malformed input and degrades to routine', () => {
    const router = makeRouter(() => 0);
    expect(router.decide(undefined as unknown as RoutingInput)).toEqual({ model: 'routine' });
  });

  it('resolves configured model aliases', () => {
    const router = makeRouter(() => 0);
    expect(router.resolveModel({ model: 'routine' })).toBe(ROUTINE);
    expect(router.resolveModel({ model: 'escalation', reason: 'LOW_CONFIDENCE' })).toBe(ESCALATION);
  });
});
