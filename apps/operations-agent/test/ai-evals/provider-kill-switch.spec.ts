/**
 * AI-brain eval suite: kill switch (AI disabled) through the SummariesService
 * provider path.
 *
 * Assertions:
 *  - gate disabled -> refusal path: no client invocation, deterministic
 *    fallback, one audit event carrying AI_DISABLED, costEur 0;
 *  - a real OpenAiResponsesLlmClient constructed WITH an API key but wired
 *    into a service whose gate is off never performs a fetch — proven with a
 *    recording fetchImpl (call count 0);
 *  - getExplanation resolves (never rejects) on the refusal path and no
 *    provider/key material ever reaches the audit trail.
 */

import { SummariesService } from '../../src/ai';
import { OpenAiResponsesLlmClient } from '../../src/ai/provider';
import {
  buildSummariesOptions,
  collectStrings,
  FakeLlmClient,
  makeExplanationInput,
  RecordingAuditSink,
  RecordingBudget,
  StubGate,
} from './fixtures';

const DUMMY_PROVIDER_KEY = 'sk-test-dummy-key-000000';

describe('SummariesService — provider kill-switch evals', () => {
  it('gate disabled -> refusal path: no client call, deterministic fallback, AI_DISABLED audit', async () => {
    const client = FakeLlmClient.fromAssessment(
      // Would be accepted if it were ever called.
      {
        assessment: 'AMBER',
        summary: 'synthetic model summary agreeing with the deterministic verdict',
        evidenceKeys: ['ev.synthetic.1'],
        confidence: 'HIGH',
        issueCode: 'NO_ISSUE',
        recommendedRunbook: 'none',
        automationEligibility: 'AUTO_SAFE',
      },
    );
    const budget = new RecordingBudget();
    const audit = new RecordingAuditSink();
    const service = new SummariesService(
      buildSummariesOptions({
        client,
        budget,
        audit,
        gate: new StubGate(new Error('AI disabled by kill switch')),
      }),
    );

    const result = await service.getExplanation(makeExplanationInput());

    // Resolves (never rejects) with the deterministic fallback.
    expect(result).toMatchObject({ fallback: true, model: 'deterministic', costEur: 0 });
    expect(result.fallback).toBe(true);
    expect(result.model).toBe('deterministic');
    expect(result.costEur).toBe(0);
    expect(client.calls).toHaveLength(0);
    expect(budget.records).toHaveLength(0);
    expect(audit.events).toHaveLength(1);
    const event = audit.events[0] as { reasonCode: string; resultCode: string; costEur: number };
    expect(event.reasonCode).toBe('AI_DISABLED');
    expect(event.resultCode).toBe('AI_FALLBACK_DETERMINISTIC');
    expect(event.costEur).toBe(0);
  });

  it('a keyed OpenAiResponsesLlmClient behind a disabled gate never performs a fetch', async () => {
    const fetchCalls: Array<{ url: unknown; init?: unknown }> = [];
    const recordingFetch = ((url: unknown, init?: unknown) => {
      fetchCalls.push({ url, init });
      return Promise.resolve(new Response('{}', { status: 200 }));
    }) as typeof fetch;

    const provider = new OpenAiResponsesLlmClient({
      apiKey: DUMMY_PROVIDER_KEY,
      baseUrl: 'https://api.openai.test',
      requestTimeoutMs: 5_000,
      fetchImpl: recordingFetch,
    });
    const budget = new RecordingBudget();
    const audit = new RecordingAuditSink();
    const service = new SummariesService(
      buildSummariesOptions({
        client: provider,
        budget,
        audit,
        gate: new StubGate(new Error('AI disabled by kill switch')),
      }),
    );

    const result = await service.getExplanation(makeExplanationInput());

    expect(fetchCalls).toHaveLength(0);
    expect(result.fallback).toBe(true);
    expect(result.model).toBe('deterministic');
    expect(result.costEur).toBe(0);
    expect(budget.records).toHaveLength(0);
    expect(audit.events).toHaveLength(1);
    expect((audit.events[0] as { reasonCode: string }).reasonCode).toBe('AI_DISABLED');
    // The injected key never leaks into the audit trail.
    for (const value of collectStrings(audit.events)) {
      expect(value).not.toContain(DUMMY_PROVIDER_KEY);
    }
  });
});
