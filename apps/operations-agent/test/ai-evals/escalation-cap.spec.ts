/**
 * Eval suite 9: escalation cap (operator-plan 8.2/8.3 — Terra only by policy,
 * maximum three Terra escalations per day).
 *
 * The fourth owner-requested escalation inside one UTC day must be routed to
 * the routine model; the cap resets on the UTC calendar-day boundary.
 * Adapter-level behaviour must stay consistent with the router policy.
 */

import { AiAdapterService, ModelRouter } from '../../src/ai';
import {
  buildAdapterOptions,
  buildRouterOptions,
  ESCALATION_MODEL,
  FakeLlmClient,
  makeDeterministic,
  ManualClock,
  ROUTINE_MODEL,
} from './fixtures';

const DAY_START = Date.UTC(2026, 8, 28, 0, 0, 0, 0); // 2026-09-28T00:00:00.000Z
const DAY_END = Date.UTC(2026, 8, 28, 23, 59, 59, 999); // still 2026-09-28 UTC
const NEXT_DAY = Date.UTC(2026, 8, 29, 0, 0, 0, 0); // 2026-09-29T00:00:00.000Z

const ESCALATION_INPUT = {
  deterministicStatus: 'RED',
  conflictingSignals: true,
  lowConfidence: false,
  ownerRequestedDeepExplanation: true,
} as const;

describe('ModelRouter — escalation-cap evals', () => {
  it('allows the first three owner-requested escalations and routes the fourth to routine', () => {
    const router = new ModelRouter(buildRouterOptions({ maxEscalationsPerDay: 3 }));

    for (let i = 0; i < 3; i++) {
      expect(router.decide({ ...ESCALATION_INPUT }).model).toBe('escalation');
    }
    const fourth = router.decide({ ...ESCALATION_INPUT });
    expect(fourth.model).toBe('routine');
  });

  it('keeps the cap closed until the UTC day boundary, then resets it', () => {
    const clock = new ManualClock(DAY_START);
    const router = new ModelRouter(buildRouterOptions({ maxEscalationsPerDay: 3, now: clock.now }));

    for (let i = 0; i < 3; i++) {
      expect(router.decide({ ...ESCALATION_INPUT }).model).toBe('escalation');
    }

    clock.set(DAY_END);
    expect(router.decide({ ...ESCALATION_INPUT }).model).toBe('routine');

    clock.set(NEXT_DAY);
    expect(router.decide({ ...ESCALATION_INPUT }).model).toBe('escalation');
  });

  it('counts only escalations: routine decisions do not consume the cap', () => {
    const router = new ModelRouter(buildRouterOptions({ maxEscalationsPerDay: 1 }));
    const routineInput = {
      deterministicStatus: 'GREEN',
      conflictingSignals: false,
      lowConfidence: false,
      ownerRequestedDeepExplanation: false,
    } as const;

    expect(router.decide(routineInput).model).toBe('routine');
    expect(router.decide({ ...ESCALATION_INPUT }).model).toBe('escalation');
    expect(router.decide({ ...ESCALATION_INPUT }).model).toBe('routine');
  });

  it('routes non-owner RED+conflicting cases to the escalation model without an owner request', () => {
    const router = new ModelRouter(buildRouterOptions({ maxEscalationsPerDay: 3 }));

    const decision = router.decide({
      deterministicStatus: 'RED',
      conflictingSignals: true,
      lowConfidence: false,
      ownerRequestedDeepExplanation: false,
    });

    expect(decision.model).toBe('escalation');
  });
});

describe('AiAdapterService — escalation-cap consistency', () => {
  it('serves every one of four same-day owner-requested RED calls without throwing and retains the verdict', async () => {
    const clock = new ManualClock(DAY_START);
    const client = FakeLlmClient.fromJson(makeDeterministic('RED'));
    const service = new AiAdapterService(
      buildAdapterOptions({ client, now: clock.now, ai: { maxEscalationsPerDay: 3 } }),
    );

    for (let i = 0; i < 4; i++) {
      const result = await service.assess({
        deterministic: makeDeterministic('RED'),
        conflictingSignals: true,
        ownerRequestedDeepExplanation: true,
        evidenceHash: `sha256:escalation-cap-${i}`,
      });

      expect(result.assessment.assessment).toBe('RED');
    }
    expect(client.calls).toHaveLength(4);
  });

  it('never selects the escalation alias more than the configured daily cap', async () => {
    const clock = new ManualClock(DAY_START);
    const client = FakeLlmClient.fromJson(makeDeterministic('RED'));
    const service = new AiAdapterService(
      buildAdapterOptions({ client, now: clock.now, ai: { maxEscalationsPerDay: 3 } }),
    );

    for (let i = 0; i < 6; i++) {
      await service.assess({
        deterministic: makeDeterministic('RED'),
        conflictingSignals: true,
        ownerRequestedDeepExplanation: true,
        evidenceHash: `sha256:escalation-alias-${i}`,
      });
    }

    const escalationCalls = client.calls.filter((call) => call.model === ESCALATION_MODEL);
    const routineCalls = client.calls.filter((call) => call.model === ROUTINE_MODEL);
    expect(escalationCalls).toHaveLength(3);
    expect(routineCalls).toHaveLength(3);
  });
});
