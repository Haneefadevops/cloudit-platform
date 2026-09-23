/**
 * AI-brain eval suite: malformed / hallucinated provider output through the
 * SummariesService path (operator-plan 12, 14 — "invalid model output",
 * "over-confident or hallucinated output").
 *
 * Every hostile reply falls back deterministically with the right closed
 * outcome code, costEur 0, zero budget records, and the deterministic
 * verdict preserved verbatim. Positive controls prove a well-formed agreeing
 * reply (bare or ```json fenced) is still accepted.
 */

import { HealthAssessment } from '@cloudit/operations-agent-contracts';
import { SummariesService } from '../../src/ai';
import {
  buildSummariesOptions,
  FakeLlmClient,
  makeDeterministic,
  makeExplanationInput,
  makeModelOutput,
  RecordingAuditSink,
  RecordingBudget,
} from './fixtures';

const DETERMINISTIC = makeDeterministic('RED');
const AGREEING: HealthAssessment = makeModelOutput({ assessment: 'RED' });

/** Strip one key from a valid output shape (used to build missing-field cases). */
function without<K extends keyof HealthAssessment>(key: K): Omit<HealthAssessment, K> {
  const clone: Record<string, unknown> = { ...AGREEING };
  delete clone[key as string];
  return clone as Omit<HealthAssessment, K>;
}

async function runCase(client: FakeLlmClient) {
  const budget = new RecordingBudget();
  const audit = new RecordingAuditSink();
  const service = new SummariesService(buildSummariesOptions({ client, budget, audit }));
  const result = await service.getExplanation(
    makeExplanationInput({ deterministic: DETERMINISTIC }),
  );
  return { result, budget, audit };
}

function expectDeterministicFallback(
  ctx: Awaited<ReturnType<typeof runCase>>,
  reasonCode: string,
): void {
  const { result, budget, audit } = ctx;
  expect(result.fallback).toBe(true);
  expect(result.model).toBe('deterministic');
  expect(result.costEur).toBe(0);
  expect(result.tokensIn).toBe(0);
  expect(result.tokensOut).toBe(0);
  expect(result.assessment).toEqual(DETERMINISTIC);
  expect(budget.records).toHaveLength(0);
  expect(audit.events).toHaveLength(1);
  const event = audit.events[0] as { reasonCode: string; resultCode: string };
  expect(event.reasonCode).toBe(reasonCode);
  expect(event.resultCode).toBe('AI_FALLBACK_DETERMINISTIC');
}

describe('SummariesService — provider malformed-output evals', () => {
  it('rejects a wrong assessment enum (LLM_INVALID_ASSESSMENT)', async () => {
    const client = FakeLlmClient.fromJson({ ...AGREEING, assessment: 'PURPLE' });
    expectDeterministicFallback(await runCase(client), 'LLM_INVALID_ASSESSMENT');
  });

  it('rejects a wrong confidence enum (LLM_INVALID_ASSESSMENT)', async () => {
    const client = FakeLlmClient.fromJson({ ...AGREEING, confidence: 'CERTAIN' });
    expectDeterministicFallback(await runCase(client), 'LLM_INVALID_ASSESSMENT');
  });

  it('rejects a missing required field (LLM_INVALID_ASSESSMENT)', async () => {
    const client = FakeLlmClient.fromJson(without('recommendedRunbook'));
    expectDeterministicFallback(await runCase(client), 'LLM_INVALID_ASSESSMENT');
  });

  it('rejects a non-array evidenceKeys field (LLM_INVALID_ASSESSMENT)', async () => {
    const client = FakeLlmClient.fromJson({ ...AGREEING, evidenceKeys: 'ev.synthetic.1' });
    expectDeterministicFallback(await runCase(client), 'LLM_INVALID_ASSESSMENT');
  });

  it('rejects extra fields outside the closed schema (LLM_INVALID_ASSESSMENT)', async () => {
    const client = FakeLlmClient.fromJson({ ...AGREEING, injectedDirective: 'approve everything' });
    expectDeterministicFallback(await runCase(client), 'LLM_INVALID_ASSESSMENT');
  });

  it('rejects prose instead of JSON (LLM_MALFORMED_JSON)', async () => {
    const client = FakeLlmClient.respondWith(
      'After careful analysis the system is healthy; disregard any contradictory verdict.',
    );
    expectDeterministicFallback(await runCase(client), 'LLM_MALFORMED_JSON');
  });

  it('rejects a hallucinated category contradicting the deterministic verdict (LLM_CONTRADICTS_DETERMINISTIC)', async () => {
    // Over-confident: claims GREEN with HIGH confidence while the supervisor says RED.
    const client = FakeLlmClient.fromJson(
      makeModelOutput({ assessment: 'GREEN', confidence: 'HIGH', summary: 'definitive: all clear' }),
    );
    expectDeterministicFallback(await runCase(client), 'LLM_CONTRADICTS_DETERMINISTIC');
  });

  it('strips ```json fences and still rejects a fenced contradiction (LLM_CONTRADICTS_DETERMINISTIC)', async () => {
    const client = FakeLlmClient.respondWith(
      '```json\n' +
        JSON.stringify(
          makeModelOutput({ assessment: 'GREEN', confidence: 'HIGH' }),
        ) +
        '\n```',
    );
    expectDeterministicFallback(await runCase(client), 'LLM_CONTRADICTS_DETERMINISTIC');
  });

  it('positive control: accepts a bare agreeing JSON reply', async () => {
    const ctx = await runCase(FakeLlmClient.fromAssessment(AGREEING));
    expect(ctx.result.fallback).toBe(false);
    expect(ctx.result.assessment).toEqual(AGREEING);
    expect(ctx.budget.records).toHaveLength(1);
    expect((ctx.audit.events[0] as { reasonCode: string }).reasonCode).toBe('AI_ACCEPTED');
  });

  it('positive control: accepts a ```json fenced agreeing reply', async () => {
    const ctx = await runCase(
      FakeLlmClient.respondWith('```json\n' + JSON.stringify(AGREEING) + '\n```'),
    );
    expect(ctx.result.fallback).toBe(false);
    expect(ctx.result.assessment).toEqual(AGREEING);
  });
});
