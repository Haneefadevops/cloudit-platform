/**
 * Eval suite 5: malformed structured output (operator-plan 8.1, 12, 14 —
 * "malformed schema"). Every malformed class must be discarded and replaced
 * by the deterministic fallback without throwing: fallback true, deterministic
 * verdict retained.
 */

import { AiAdapterService } from '../../src/ai';
import { buildAdapterOptions, FakeLlmClient, makeDeterministic, makeModelOutput } from './fixtures';

const DETERMINISTIC_VERDICT = 'AMBER' as const;
const MALFORMED_CASES: ReadonlyArray<{ id: string; reply: string }> = [
  { id: 'non-json text', reply: 'the database seems fine, no action needed' },
  { id: 'json array instead of object', reply: JSON.stringify([{ assessment: 'AMBER' }]) },
  {
    id: 'json missing required fields',
    reply: JSON.stringify({ assessment: 'AMBER', summary: 'partial object only' }),
  },
  {
    id: 'wrong enum values',
    reply: JSON.stringify({
      assessment: 'PURPLE',
      summary: 'synthetic wrong-enum reply',
      evidenceKeys: ['ev.synthetic.1'],
      confidence: 'CERTAIN',
      issueCode: 'NO_ISSUE',
      recommendedRunbook: 'none',
      automationEligibility: 'WHATEVER',
    }),
  },
  {
    id: 'control characters in summary',
    reply: JSON.stringify({
      ...makeModelOutput({ assessment: DETERMINISTIC_VERDICT }),
      summary: 'synthetic reply with \u0000nul and \u001b[31mansi\u001b[0m escapes',
    }),
  },
  {
    id: 'summary over the 1000-char bound',
    reply: JSON.stringify({
      ...makeModelOutput({ assessment: DETERMINISTIC_VERDICT }),
      summary: 'x'.repeat(5_000),
    }),
  },
  {
    id: 'empty string reply',
    reply: '',
  },
];

describe('AiAdapterService — malformed-output evals', () => {
  it.each(MALFORMED_CASES.map((c) => [c.id, c.reply] as const))(
    'discards "%s" and falls back to the deterministic verdict without throwing',
    async (_id, reply) => {
      const client = FakeLlmClient.respondWith(reply);
      const service = new AiAdapterService(buildAdapterOptions({ client }));

      const promise = service.assess({
        deterministic: makeDeterministic(DETERMINISTIC_VERDICT),
        conflictingSignals: true,
        evidenceHash: 'sha256:malformed',
      });

      await expect(promise).resolves.toBeDefined();
      const result = await promise;
      expect(result.fallback).toBe(true);
      expect(result.assessment.assessment).toBe(DETERMINISTIC_VERDICT);
      expect(result.assessment.summary).toBe('synthetic deterministic assessment');
    },
  );

  it('rejects a structurally valid reply with an out-of-contract verdict enum', async () => {
    const client = FakeLlmClient.fromJson({
      ...makeModelOutput(),
      assessment: 'GREEN-ish',
    });
    const service = new AiAdapterService(buildAdapterOptions({ client }));

    const result = await service.assess({
      deterministic: makeDeterministic(DETERMINISTIC_VERDICT),
      conflictingSignals: true,
      evidenceHash: 'sha256:malformed-verdict-enum',
    });

    expect(result.fallback).toBe(true);
    expect(result.assessment.assessment).toBe(DETERMINISTIC_VERDICT);
  });
});
