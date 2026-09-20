import { validateHealthAssessment } from '@cloudit/operations-agent-contracts';
import {
  AiAdapterResult,
  AiAdapterService,
  AiAssessmentAuditEvent,
  AiGate,
  BudgetGate,
  LlmClient,
  LlmError,
  LlmErrorCode,
  LlmRequest,
  LlmResponse,
} from '../../src/ai';
import { DETERMINISTIC_RED, EVIDENCE_HASH, FIXED_NOW, aiExplanation } from './fixtures';

const ROUTINE = 'gpt-5.6-luna';
const ESCALATION = 'gpt-5.6-terra';

class FakeLlmClient implements LlmClient {
  calls: LlmRequest[] = [];
  constructor(private readonly handler: (request: LlmRequest) => Promise<LlmResponse>) {}
  complete(request: LlmRequest): Promise<LlmResponse> {
    this.calls.push(request);
    return this.handler(request);
  }
}

class FakeBudgetGate implements BudgetGate {
  allowed = true;
  records: Array<{ model: string; tokensIn: number; tokensOut: number; estimatedEur: number }> = [];
  canCall(): boolean {
    return this.allowed;
  }
  record(model: string, tokensIn: number, tokensOut: number, estimatedEur: number): void {
    this.records.push({ model, tokensIn, tokensOut, estimatedEur });
  }
}

class EnabledGate implements AiGate {
  constructor(private readonly enabled = true) {}
  assertEnabled(): void {
    if (!this.enabled) throw new Error('capability "ai" is disabled by kill switch (AI_DISABLED)');
  }
}

interface AdapterHarness {
  service: AiAdapterService;
  client: FakeLlmClient;
  budget: FakeBudgetGate;
  auditEvents: unknown[];
}

function makeAdapter(
  handler: (request: LlmRequest) => Promise<LlmResponse>,
  overrides: {
    gate?: AiGate;
    budget?: FakeBudgetGate;
    ai?: Partial<ConstructorParameters<typeof AiAdapterService>[0]['ai']>;
  } = {},
): AdapterHarness {
  const client = new FakeLlmClient(handler);
  const budget = overrides.budget ?? new FakeBudgetGate();
  const auditEvents: unknown[] = [];
  const service = new AiAdapterService({
    ai: {
      routineModel: ROUTINE,
      escalationModel: ESCALATION,
      requestTimeoutMs: 5_000,
      maxInputTokens: 8_000,
      maxOutputTokens: 1_000,
      maxEscalationsPerDay: 3,
      ...overrides.ai,
    },
    client,
    budget,
    gate: overrides.gate ?? new EnabledGate(),
    audit: { record: (event: unknown) => auditEvents.push(event) },
    now: FIXED_NOW,
  });
  return { service, client, budget, auditEvents };
}

function okResponse(assessment = aiExplanation(), tokensIn = 120, tokensOut = 40): LlmResponse {
  return { text: JSON.stringify(assessment), inputTokens: tokensIn, outputTokens: tokensOut };
}

function expectFallbackShape(
  result: AiAdapterResult,
  deterministic = DETERMINISTIC_RED,
): void {
  expect(result.fallback).toBe(true);
  expect(result.model).toBe('deterministic');
  expect(result.costEur).toBe(0);
  expect(result.tokensIn).toBe(0);
  expect(result.tokensOut).toBe(0);
  // The deterministic verdict is retained verbatim; AI-owned fields collapse
  // to the fixed safe fallback template.
  expect(result.assessment.assessment).toBe(deterministic.assessment);
  expect(result.assessment.evidenceKeys).toEqual(deterministic.evidenceKeys);
  expect(result.assessment.issueCode).toBe(deterministic.issueCode);
}

describe('AiAdapterService shadow mode', () => {
  describe('happy path', () => {
    it('passes through a valid non-contradicting assessment', async () => {
      const explanation = aiExplanation();
      const { service, budget, auditEvents } = makeAdapter(async () => okResponse(explanation));

      const result = await service.assess({
        deterministic: DETERMINISTIC_RED,
        conflictingSignals: true,
        evidenceHash: EVIDENCE_HASH,
      });

      expect(result.fallback).toBe(false);
      expect(result.model).toBe(ESCALATION); // RED + conflicting signals -> Terra
      expect(result.assessment).toEqual(explanation);
      expect(validateHealthAssessment(result.assessment).ok).toBe(true);
      expect(result.tokensIn).toBe(120);
      expect(result.tokensOut).toBe(40);
      expect(result.costEur).toBeGreaterThan(0);

      expect(budget.records).toHaveLength(1);
      expect(budget.records[0]).toMatchObject({
        model: ESCALATION,
        tokensIn: 120,
        tokensOut: 40,
      });
      expect(budget.records[0].estimatedEur).toBeCloseTo(result.costEur, 6);

      expect(auditEvents).toHaveLength(1);
      const event = auditEvents[0] as AiAssessmentAuditEvent;
      expect(event.resultCode).toBe('AI_ACCEPTED');
      expect(event.reasonCode).toBe('AI_ACCEPTED');
      expect(event.model).toBe(ESCALATION);
      expect(event.evidenceKeys).toEqual([EVIDENCE_HASH]);
    });

    it('routes non-escalation input to the routine model', async () => {
      const { service, client } = makeAdapter(async () =>
        okResponse(aiExplanation({ assessment: 'AMBER' })),
      );
      const result = await service.assess({
        deterministic: { ...DETERMINISTIC_RED, assessment: 'AMBER' },
        conflictingSignals: false,
        evidenceHash: EVIDENCE_HASH,
      });
      expect(result.fallback).toBe(false);
      expect(result.model).toBe(ROUTINE);
      expect(client.calls).toHaveLength(1);
      expect(client.calls[0].model).toBe(ROUTINE);
    });

    it('accepts a fenced JSON response', async () => {
      const { service } = makeAdapter(async () => ({
        text: '```json\n' + JSON.stringify(aiExplanation()) + '\n```',
        inputTokens: 10,
        outputTokens: 5,
      }));
      const result = await service.assess({
        deterministic: DETERMINISTIC_RED,
        conflictingSignals: false,
        evidenceHash: EVIDENCE_HASH,
      });
      expect(result.fallback).toBe(false);
    });

    it('times out a slow client and falls back (LLM_TIMEOUT)', async () => {
      const { service } = makeAdapter(
        () =>
          new Promise<LlmResponse>(() => {
            /* never resolves */
          }),
        { ai: { requestTimeoutMs: 10 } },
      );
      const result = await service.assess({
        deterministic: DETERMINISTIC_RED,
        conflictingSignals: false,
        evidenceHash: EVIDENCE_HASH,
      });
      expectFallbackShape(result);
    });
  });

  describe('fallback paths — all produce deterministic fallback, cost 0, no model output', () => {
    const fallbackCases: Array<{
      name: string;
      gate?: AiGate;
      budget?: FakeBudgetGate;
      handler?: (request: LlmRequest) => Promise<LlmResponse>;
      expectedReason: string;
      expectClientCalled?: boolean;
    }> = [
      {
        name: 'kill switch denies (gate.assertEnabled throws)',
        gate: new EnabledGate(false),
        handler: async () => okResponse(),
        expectedReason: 'AI_DISABLED',
        expectClientCalled: false,
      },
      {
        name: 'budget denies',
        budget: (() => {
          const b = new FakeBudgetGate();
          b.allowed = false;
          return b;
        })(),
        handler: async () => okResponse(),
        expectedReason: 'BUDGET_DENIED',
        expectClientCalled: false,
      },
      ...(['timeout', 'rate_limited', 'server', 'refused', 'network', 'invalid_response'] as LlmErrorCode[]).map(
        (code) => ({
          name: `client throws LlmError('${code}')`,
          handler: async (): Promise<LlmResponse> => {
            throw new LlmError(code);
          },
          expectedReason:
            {
              timeout: 'LLM_TIMEOUT',
              rate_limited: 'LLM_RATE_LIMITED',
              server: 'LLM_SERVER_ERROR',
              refused: 'LLM_REFUSED',
              network: 'LLM_NETWORK_ERROR',
              invalid_response: 'LLM_INVALID_RESPONSE',
            }[code],
        }),
      ),
      {
        name: 'client throws an unexpected non-LlmError',
        handler: async (): Promise<LlmResponse> => {
          throw new Error('boom with internal details');
        },
        expectedReason: 'UNEXPECTED_ERROR',
      },
      {
        name: 'client returns malformed JSON',
        handler: async () => ({ text: 'this is not json', inputTokens: 5, outputTokens: 2 }),
        expectedReason: 'LLM_MALFORMED_JSON',
      },
      {
        name: 'client returns output failing validateHealthAssessment',
        handler: async () => ({
          text: JSON.stringify({ assessment: 'PURPLE', summary: 'x' }),
          inputTokens: 5,
          outputTokens: 2,
        }),
        expectedReason: 'LLM_INVALID_ASSESSMENT',
      },
      {
        name: 'client output contradicts deterministic RED (claims GREEN)',
        handler: async () => ({
          text: JSON.stringify(aiExplanation({ assessment: 'GREEN' })),
          inputTokens: 5,
          outputTokens: 2,
        }),
        expectedReason: 'LLM_CONTRADICTS_DETERMINISTIC',
      },
    ];

    for (const testCase of fallbackCases) {
      it(testCase.name, async () => {
        const { service, client, budget, auditEvents } = makeAdapter(
          testCase.handler ?? (async () => okResponse()),
          { gate: testCase.gate, budget: testCase.budget },
        );

        const result = await service.assess({
          deterministic: DETERMINISTIC_RED,
          conflictingSignals: false,
          evidenceHash: EVIDENCE_HASH,
        });

        expectFallbackShape(result);
        expect(budget.records).toHaveLength(0);
        if (testCase.expectClientCalled === false) {
          expect(client.calls).toHaveLength(0);
        }
        expect(auditEvents).toHaveLength(1);
        const event = auditEvents[0] as AiAssessmentAuditEvent;
        expect(event.resultCode).toBe('AI_FALLBACK_DETERMINISTIC');
        expect(event.reasonCode).toBe(testCase.expectedReason);
        expect(event.costEur).toBe(0);
      });
    }

    it('never rejects even when the gate throws a typed safe error', async () => {
      const { service } = makeAdapter(async () => okResponse(), { gate: new EnabledGate(false) });
      await expect(
        service.assess({
          deterministic: DETERMINISTIC_RED,
          conflictingSignals: false,
          evidenceHash: EVIDENCE_HASH,
        }),
      ).resolves.toMatchObject({ fallback: true, model: 'deterministic' });
    });
  });

  describe('deterministic fallback builder integration', () => {
    it('fallback assessment keeps the deterministic verdict fields and supervisor summary', async () => {
      const { service } = makeAdapter(async (): Promise<LlmResponse> => {
        throw new LlmError('network');
      });
      const result = await service.assess({
        deterministic: DETERMINISTIC_RED,
        conflictingSignals: false,
        evidenceHash: EVIDENCE_HASH,
      });
      expect(result.assessment).toEqual({
        ...DETERMINISTIC_RED,
        confidence: 'LOW',
        recommendedRunbook: 'none',
        automationEligibility: 'OWNER_REQUIRED',
      });
    });
  });

  describe('prompt construction sent to the client', () => {
    it('separates system instructions from the untrusted evidence section', async () => {
      const { service, client } = makeAdapter(async () => okResponse());
      await service.assess({
        deterministic: DETERMINISTIC_RED,
        conflictingSignals: true,
        evidenceHash: EVIDENCE_HASH,
      });
      expect(client.calls).toHaveLength(1);
      const request = client.calls[0];
      expect(request.maxOutputTokens).toBe(1_000);
      expect(request.system).toContain('shadow mode');
      expect(request.system).not.toContain(DETERMINISTIC_RED.summary);
      expect(request.input).toContain('[UNTRUSTED-DATA-BEGIN]');
    });
  });
});
