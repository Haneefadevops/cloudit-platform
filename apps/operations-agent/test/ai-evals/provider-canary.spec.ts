/**
 * AI-brain eval suite: secret-canary leakage through the SummariesService
 * provider path (operator-plan 11.2, 14 — "secret, token, email, URL,
 * private-ID and PII canary leakage").
 *
 * Only the exact canary fixture values from the contracts security package
 * trigger detection; every one of them is exercised:
 *  - a fake client returning a schema-valid, category-agreeing assessment
 *    whose summary echoes a canary must collapse to the deterministic
 *    fallback with outcome LLM_SECRET_CANARY, costEur 0 and no budget record;
 *  - a canary planted in the untrusted finding excerpt must never reach an
 *    accepted explanation (proved with the shared detectCanaryLeak helper).
 */

import { detectCanaryLeak, SECRET_CANARY_FIXTURES } from '@cloudit/operations-agent-contracts';
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

function expectNoCanaryLeak(value: unknown): void {
  const report = detectCanaryLeak(JSON.stringify(value));
  expect(report.leaked).toBe(false);
  if (report.leaked) {
    throw new Error(`canary leak: ${report.matches.join(', ')}`);
  }
}

describe('SummariesService — provider secret-canary evals', () => {
  describe.each(SECRET_CANARY_FIXTURES.map((c) => [c.id, c.value] as const))(
    'schema-valid reply echoing the canary (%s)',
    (_id, canary) => {
      it('collapses to the deterministic fallback with the LLM_SECRET_CANARY outcome', async () => {
        const deterministic = makeDeterministic('AMBER');
        const client = FakeLlmClient.fromAssessment(
          makeModelOutput({ assessment: 'AMBER', summary: `verified credential ${canary}` }),
        );
        const budget = new RecordingBudget();
        const audit = new RecordingAuditSink();
        const service = new SummariesService(buildSummariesOptions({ client, budget, audit }));

        const result = await service.getExplanation(
          makeExplanationInput({ deterministic, evidenceHash: `sha256:canary-${_id}` }),
        );

        expect(result.fallback).toBe(true);
        expect(result.model).toBe('deterministic');
        expect(result.costEur).toBe(0);
        expect(result.tokensIn).toBe(0);
        expect(result.tokensOut).toBe(0);
        expect(result.assessment).toEqual(deterministic);
        expectNoCanaryLeak(result);
        expect(budget.records).toHaveLength(0);
        expect(audit.events).toHaveLength(1);
        const event = audit.events[0] as { reasonCode: string; resultCode: string; costEur: number };
        expect(event.reasonCode).toBe('LLM_SECRET_CANARY');
        expect(event.resultCode).toBe('AI_FALLBACK_DETERMINISTIC');
        expect(event.costEur).toBe(0);
      });
    },
  );

  describe.each(SECRET_CANARY_FIXTURES.map((c) => [c.id, c.value] as const))(
    'canary planted in the untrusted finding excerpt (%s)',
    (_id, canary) => {
      it('never reaches the accepted explanation or the audit trail', async () => {
        const deterministic = makeDeterministic('AMBER');
        const client = FakeLlmClient.fromAssessment(makeModelOutput({ assessment: 'AMBER' }));
        const audit = new RecordingAuditSink();
        const service = new SummariesService(buildSummariesOptions({ client, audit }));

        const result = await service.getExplanation(
          makeExplanationInput({
            deterministic,
            findingSummary: `collector note mentions ${canary}`,
            evidenceHash: `sha256:canary-excerpt-${_id}`,
          }),
        );

        expect(result.fallback).toBe(false);
        expect(result.explanation).not.toContain(canary);
        expectNoCanaryLeak(result);
        for (const value of [JSON.stringify(result.explanation), JSON.stringify(audit.events)]) {
          expectNoCanaryLeak(value);
        }
      });
    },
  );
});
