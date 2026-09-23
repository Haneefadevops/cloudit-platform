/**
 * AI-brain eval suite: budget-stop control through the SummariesService
 * provider path (operator-plan 8.3, 12, 14 — "budget exhausted / hard
 * cutoff").
 *
 * Assertions:
 *  - hard budget denial (canCall false): the client is never invoked, the
 *    result is the deterministic fallback with costEur 0, nothing is
 *    recorded to the budget, and the audit trail carries BUDGET_DENIED;
 *  - daily-call-cap simulation: once the cap is reached, further requests
 *    are served without touching the client and without recording spend;
 *  - routing stays within budget rules: routine-sufficient findings never
 *    select the escalation model, and once the daily escalation budget is
 *    exhausted the overflow is routed to the routine model.
 */

import { HealthAssessment } from '@cloudit/operations-agent-contracts';
import { SummariesService } from '../../src/ai';
import {
  buildSummariesOptions,
  ESCALATION_MODEL,
  FakeLlmClient,
  makeDeterministic,
  makeExplanationInput,
  makeModelOutput,
  RecordingAuditSink,
  RecordingBudget,
  ROUTINE_MODEL,
} from './fixtures';

interface RecordedSpend {
  model: string;
  tokensIn: number;
  tokensOut: number;
  estimatedEur: number;
}

/** Budget stub modelling a daily call cap: only the first `cap` calls pass. */
class DailyCallCapBudget {
  readonly records: RecordedSpend[] = [];
  private used = 0;

  constructor(private readonly cap: number) {}

  canCall(): boolean {
    return this.used < this.cap;
  }

  record(model: string, tokensIn: number, tokensOut: number, estimatedEur: number): void {
    this.used += 1;
    this.records.push({ model, tokensIn, tokensOut, estimatedEur });
  }
}

function agreeingClient(verdict: HealthAssessment['assessment']): FakeLlmClient {
  return FakeLlmClient.fromAssessment(makeModelOutput({ assessment: verdict }));
}

describe('SummariesService — provider budget-stop evals', () => {
  it('never invokes the client on hard budget denial: deterministic fallback, zero recorded spend', async () => {
    const deterministic = makeDeterministic('RED');
    const client = agreeingClient('RED');
    const budget = new RecordingBudget();
    budget.allowed = false;
    const audit = new RecordingAuditSink();
    const service = new SummariesService(buildSummariesOptions({ client, budget, audit }));

    const result = await service.getExplanation(makeExplanationInput({ deterministic }));

    expect(client.calls).toHaveLength(0);
    expect(result.fallback).toBe(true);
    expect(result.model).toBe('deterministic');
    expect(result.costEur).toBe(0);
    expect(result.assessment).toEqual(deterministic);
    expect(budget.records).toHaveLength(0);
    expect(audit.events).toHaveLength(1);
    const event = audit.events[0] as { reasonCode: string; costEur: number };
    expect(event.reasonCode).toBe('BUDGET_DENIED');
    expect(event.costEur).toBe(0);
  });

  it('serves requests beyond the daily call cap without touching the client again', async () => {
    const deterministic = makeDeterministic('GREEN');
    const client = agreeingClient('GREEN');
    const budget = new DailyCallCapBudget(2);
    const audit = new RecordingAuditSink();
    const service = new SummariesService(buildSummariesOptions({ client, budget, audit }));

    const first = await service.getExplanation(makeExplanationInput({ deterministic }));
    const second = await service.getExplanation(makeExplanationInput({ deterministic }));
    const third = await service.getExplanation(makeExplanationInput({ deterministic }));

    expect(first.fallback).toBe(false);
    expect(second.fallback).toBe(false);
    expect(third.fallback).toBe(true);
    expect(third.model).toBe('deterministic');
    expect(third.costEur).toBe(0);
    expect(third.assessment).toEqual(deterministic);

    expect(client.calls).toHaveLength(2);
    expect(budget.records).toHaveLength(2);
    expect(audit.events).toHaveLength(3);
    expect((audit.events[2] as { reasonCode: string }).reasonCode).toBe('BUDGET_DENIED');
  });

  it('never selects the escalation model when the routine model suffices', async () => {
    const client = agreeingClient('GREEN');
    const service = new SummariesService(buildSummariesOptions({ client }));

    // No LOW confidence and no owner-requested deep explanation: routine.
    const routineSufficient: Array<Partial<ReturnType<typeof makeExplanationInput>>> = [
      { deterministic: makeDeterministic('GREEN') },
      { deterministic: makeDeterministic('AMBER', { confidence: 'HIGH' }) },
      { deterministic: makeDeterministic('RED', { confidence: 'HIGH' }) },
      { deterministic: makeDeterministic('NO_DATA') },
      { deterministic: makeDeterministic('UNKNOWN') },
    ];

    for (const override of routineSufficient) {
      await service.getExplanation(makeExplanationInput(override));
    }

    expect(client.calls).toHaveLength(routineSufficient.length);
    for (const call of client.calls) {
      expect(call.model).toBe(ROUTINE_MODEL);
      expect(call.model).not.toBe(ESCALATION_MODEL);
    }
  });

  it('routes owner-requested overflow to the routine model once the daily escalation cap is spent', async () => {
    const deterministic = makeDeterministic('AMBER');
    const client = agreeingClient('AMBER');
    const audit = new RecordingAuditSink();
    const service = new SummariesService(
      buildSummariesOptions({ client, audit, ai: { maxEscalationsPerDay: 1 } }),
    );

    const first = await service.getExplanation(
      makeExplanationInput({ deterministic, ownerRequestedDeepExplanation: true }),
    );
    const second = await service.getExplanation(
      makeExplanationInput({ deterministic, ownerRequestedDeepExplanation: true }),
    );

    expect(first.fallback).toBe(false);
    expect(first.model).toBe(ESCALATION_MODEL);
    expect(second.fallback).toBe(false);
    expect(second.model).toBe(ROUTINE_MODEL);
    expect(client.calls.map((call) => call.model)).toEqual([ESCALATION_MODEL, ROUTINE_MODEL]);
    expect(audit.events).toHaveLength(2);
    expect((audit.events[0] as { reasonCode: string }).reasonCode).toBe('AI_ACCEPTED');
    expect((audit.events[1] as { reasonCode: string }).reasonCode).toBe('AI_ACCEPTED');
  });
});
