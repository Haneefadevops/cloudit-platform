/**
 * Eval suite 6: cost-limit exhaustion (operator-plan 8.3, 12, 14 — "budget
 * exhausted / budget warning and hard cutoff").
 *
 * When the budget reports it cannot absorb another call, the adapter must not
 * invoke the client at all: zero client invocations, fallback true, zero
 * recorded cost and the deterministic verdict retained.
 */

import { AiAdapterService } from '../../src/ai';
import { buildAdapterOptions, FakeLlmClient, makeDeterministic, RecordingBudget } from './fixtures';

describe('AiAdapterService — cost-limit evals', () => {
  it('never invokes the client when budget.canCall() is false', async () => {
    const client = FakeLlmClient.fromJson(makeDeterministic('AMBER'));
    const budget = new RecordingBudget();
    budget.allowed = false;
    const service = new AiAdapterService(buildAdapterOptions({ client, budget }));

    const result = await service.assess({
      deterministic: makeDeterministic('AMBER'),
      conflictingSignals: true,
      evidenceHash: 'sha256:budget-cutoff',
    });

    expect(client.calls).toHaveLength(0);
    expect(result.fallback).toBe(true);
    expect(result.costEur).toBe(0);
    expect(result.assessment.assessment).toBe('AMBER');
  });

  it('records nothing to the budget on a cutoff call', async () => {
    const client = FakeLlmClient.fromJson(makeDeterministic('RED'));
    const budget = new RecordingBudget();
    budget.allowed = false;
    const service = new AiAdapterService(buildAdapterOptions({ client, budget }));

    await service.assess({
      deterministic: makeDeterministic('RED'),
      conflictingSignals: true,
      evidenceHash: 'sha256:budget-cutoff-records',
    });

    expect(budget.records).toHaveLength(0);
  });

  it('still serves a cutoff fallback when the deterministic verdict is GREEN', async () => {
    const client = FakeLlmClient.fromJson(makeDeterministic('GREEN'));
    const budget = new RecordingBudget();
    budget.allowed = false;
    const service = new AiAdapterService(buildAdapterOptions({ client, budget }));

    const result = await service.assess({
      deterministic: makeDeterministic('GREEN'),
      conflictingSignals: false,
      evidenceHash: 'sha256:budget-cutoff-green',
    });

    expect(client.calls).toHaveLength(0);
    expect(result.fallback).toBe(true);
    expect(result.assessment.assessment).toBe('GREEN');
    expect(result.costEur).toBe(0);
  });
});
