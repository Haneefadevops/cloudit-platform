/**
 * Eval suite 10: happy path (operator-plan 8.1).
 *
 * A schema-valid model output that agrees with the deterministic verdict is
 * accepted: no fallback, the routine model alias is used, the budget is
 * recorded exactly once and token counts propagate.
 */

import { AiAdapterService } from '../../src/ai';
import {
  buildAdapterOptions,
  FakeLlmClient,
  makeDeterministic,
  makeModelOutput,
  RecordingAuditSink,
  RecordingBudget,
  ROUTINE_MODEL,
} from './fixtures';

describe('AiAdapterService — happy-path eval', () => {
  it('accepts a valid agreeing assessment: no fallback, routine alias, budget and tokens propagated', async () => {
    const modelOutput = makeModelOutput({
      assessment: 'GREEN',
      summary: 'synthetic model summary agreeing with the deterministic verdict',
    });
    const client = FakeLlmClient.fromAssessment(modelOutput).withTokens(321, 123);
    const budget = new RecordingBudget();
    const audit = new RecordingAuditSink();
    const service = new AiAdapterService(buildAdapterOptions({ client, budget, audit }));

    const result = await service.assess({
      deterministic: makeDeterministic('GREEN'),
      conflictingSignals: false,
      evidenceHash: 'sha256:happy-path',
    });

    expect(result.fallback).toBe(false);
    expect(result.model).toBe(ROUTINE_MODEL);
    expect(result.tokensIn).toBe(321);
    expect(result.tokensOut).toBe(123);
    expect(result.assessment.assessment).toBe('GREEN');
    expect(result.assessment.summary).toBe(modelOutput.summary);
    expect(result.assessment.confidence).toBe(modelOutput.confidence);
    expect(result.assessment.issueCode).toBe(modelOutput.issueCode);
  });

  it('records exactly one budget entry with the routine model and the propagated tokens', async () => {
    const client = FakeLlmClient.fromAssessment(makeModelOutput({ assessment: 'AMBER' })).withTokens(200, 80);
    const budget = new RecordingBudget();
    const service = new AiAdapterService(buildAdapterOptions({ client, budget }));

    await service.assess({
      deterministic: makeDeterministic('AMBER'),
      conflictingSignals: true,
      evidenceHash: 'sha256:happy-path-budget',
    });

    expect(budget.records).toHaveLength(1);
    expect(budget.records[0].model).toBe(ROUTINE_MODEL);
    expect(budget.records[0].tokensIn).toBe(200);
    expect(budget.records[0].tokensOut).toBe(80);
    expect(budget.records[0].estimatedEur).toBeGreaterThanOrEqual(0);
  });

  it('invokes the client exactly once on the happy path and audits the run', async () => {
    const client = FakeLlmClient.fromAssessment(makeModelOutput());
    const audit = new RecordingAuditSink();
    const service = new AiAdapterService(buildAdapterOptions({ client, audit }));

    await service.assess({
      deterministic: makeDeterministic('GREEN'),
      conflictingSignals: false,
      evidenceHash: 'sha256:happy-path-audit',
    });

    expect(client.calls).toHaveLength(1);
    expect(audit.events.length).toBeGreaterThanOrEqual(1);
    expect(client.calls[0].model).toBe(ROUTINE_MODEL);
    expect(client.calls[0].maxOutputTokens).toBe(1_000);
  });

  it('respects the owner-requested deep explanation on a RED case within the cap by using the escalation alias', async () => {
    const client = FakeLlmClient.fromAssessment(makeModelOutput({ assessment: 'RED' }));
    const budget = new RecordingBudget();
    const service = new AiAdapterService(buildAdapterOptions({ client, budget }));

    const result = await service.assess({
      deterministic: makeDeterministic('RED'),
      conflictingSignals: true,
      ownerRequestedDeepExplanation: true,
      evidenceHash: 'sha256:happy-path-escalation',
    });

    expect(result.fallback).toBe(false);
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].model).toBe('gpt-5.6-terra');
    expect(budget.records[0].model).toBe('gpt-5.6-terra');
  });
});
