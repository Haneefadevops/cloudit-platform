/**
 * AI-brain eval suite: contract-shape drift tripwires.
 *
 * The public surface of `src/ai/provider` and `src/ai/summaries` is frozen:
 *
 *   OpenAiResponsesLlmClient, OpenAiResponsesClientOptions,
 *   SummariesService, GetExplanationInput, GetExplanationResult,
 *   SummariesServiceOptions
 *
 * If any of these names is renamed, removed or re-typed, this suite must fail
 * at import/compile time (tsc --noEmit / ts-jest diagnostics) with the
 * offending identifier right in the error message. Runtime checks below keep
 * the failure loud even under transpile-only settings.
 */

import {
  OpenAiResponsesClientOptions,
  OpenAiResponsesLlmClient,
} from '../../src/ai/provider';
import {
  GetExplanationInput,
  GetExplanationResult,
  SummariesService,
  SummariesServiceOptions,
} from '../../src/ai/summaries';
import {
  buildSummariesOptions,
  FakeLlmClient,
  makeDeterministic,
  makeExplanationInput,
  RecordingBudget,
} from './fixtures';

const DUMMY_PROVIDER_KEY = 'sk-test-dummy-key-000000';

/** Runtime assertion for frozen class exports. */
function expectFrozenClass(value: unknown, name: string): void {
  expect(typeof value).toBe('function');
  expect((value as { name?: string }).name).toBe(name);
}

describe('AI-brain frozen export surface', () => {
  it('src/ai/provider keeps the frozen class and options type', () => {
    expectFrozenClass(OpenAiResponsesLlmClient, 'OpenAiResponsesLlmClient');

    // Compile-time binding of OpenAiResponsesClientOptions: constructing the
    // client with a fully-typed options object fails to build if the
    // interface drifts (renamed/reshaped).
    const options: OpenAiResponsesClientOptions = {
      apiKey: DUMMY_PROVIDER_KEY,
      baseUrl: 'https://api.openai.test',
      requestTimeoutMs: 5_000,
      maxRetries: 0,
      fetchImpl: (() =>
        Promise.resolve(new Response('{}', { status: 200 }))) as typeof fetch,
    };
    const client = new OpenAiResponsesLlmClient(options);
    expect(client).toBeInstanceOf(OpenAiResponsesLlmClient);
  });

  it('src/ai/summaries keeps the frozen service class and input/result/options types', async () => {
    expectFrozenClass(SummariesService, 'SummariesService');

    // Compile-time bindings of GetExplanationInput / SummariesServiceOptions:
    // annotated literals below fail to compile if any interface drifts.
    const deterministic = makeDeterministic('AMBER');
    const input: GetExplanationInput = {
      deterministic,
      findingSummary: 'synthetic finding excerpt',
      evidenceHash: 'sha256:shape-drift',
    };
    const budget = new RecordingBudget();
    budget.allowed = false; // force a deterministic fallback, no provider I/O
    const options: SummariesServiceOptions = {
      ...buildSummariesOptions({ budget, client: FakeLlmClient.respondWith('{}') }),
      now: () => Date.UTC(2026, 8, 28, 12, 0, 0),
    };
    const service = new SummariesService(options);
    expect(service).toBeInstanceOf(SummariesService);

    const result: GetExplanationResult = await service.getExplanation(input);
    expect(result.fallback).toBe(true);
    expect(result.model).toBe('deterministic');
    expect(result.assessment).toEqual(deterministic);
    // Result shape tripwire: every frozen field must still exist.
    expect(result).toEqual({
      assessment: expect.any(Object),
      explanation: expect.any(String),
      model: expect.any(String),
      fallback: expect.any(Boolean),
      costEur: expect.any(Number),
      tokensIn: expect.any(Number),
      tokensOut: expect.any(Number),
    });
  });

  it('makeExplanationInput stays structurally compatible with GetExplanationInput', () => {
    const input: GetExplanationInput = makeExplanationInput();
    expect(input.deterministic.assessment).toBeDefined();
    expect(typeof input.findingSummary).toBe('string');
    expect(typeof input.evidenceHash).toBe('string');
  });
});
