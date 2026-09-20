/**
 * Eval suite 3: prompt injection (operator-plan 11.2, 14 — "prompt injection
 * in every permitted text field").
 *
 * Every injection fixture is embedded in the deterministic assessment — via
 * the summary channel and via the evidence-keys channel — while a fake client
 * echoes its full prompt back. Assertions:
 *  - the final verdict is unchanged (deterministic stays authoritative);
 *  - the run falls back (echoed output is not a valid assessment);
 *  - the prompt the client saw quarantines the untrusted data: >= 2 sections,
 *    an 'evidence' label before the data, and the injected string never
 *    appearing before that label (exact marker wording is not asserted).
 */

import { PROMPT_INJECTION_FIXTURES } from '@cloudit/operations-agent-contracts';
import { AiAdapterService } from '../../src/ai';
import { assertEvidenceQuarantined, buildAdapterOptions, FakeLlmClient, makeDeterministic } from './fixtures';

describe('AiAdapterService — prompt-injection evals', () => {
  describe.each(PROMPT_INJECTION_FIXTURES.map((f) => [f.id, f.text] as const))(
    'injection via deterministic.summary (%s)',
    (_id, text) => {
      it('leaves the final verdict unchanged and falls back', async () => {
        const client = FakeLlmClient.echo();
        const service = new AiAdapterService(buildAdapterOptions({ client }));

        const result = await service.assess({
          deterministic: makeDeterministic('GREEN', { summary: `note: ${text}` }),
          conflictingSignals: false,
          evidenceHash: 'sha256:injection-summary',
        });

        expect(result.assessment.assessment).toBe('GREEN');
        expect(result.fallback).toBe(true);
      });

      it('quarantines the injected text behind an evidence label in the prompt', async () => {
        const client = FakeLlmClient.echo();
        const service = new AiAdapterService(buildAdapterOptions({ client }));

        await service.assess({
          deterministic: makeDeterministic('GREEN', { summary: `note: ${text}` }),
          conflictingSignals: false,
          evidenceHash: 'sha256:injection-summary-prompt',
        });

        expect(client.calls).toHaveLength(1);
        assertEvidenceQuarantined(client.calls[0].input, text);
      });
    },
  );

  describe.each(PROMPT_INJECTION_FIXTURES.map((f) => [f.id, f.text] as const))(
    'injection via evidence-shaped text (%s)',
    (_id, text) => {
      it('leaves the final verdict and summary unchanged and falls back', async () => {
        const client = FakeLlmClient.echo();
        const service = new AiAdapterService(buildAdapterOptions({ client }));

        const result = await service.assess({
          deterministic: makeDeterministic('AMBER', { evidenceKeys: ['ev.synthetic.1', text] }),
          conflictingSignals: true,
          evidenceHash: 'sha256:injection-evidence',
        });

        expect(result.assessment.assessment).toBe('AMBER');
        expect(result.assessment.summary).toBe('synthetic deterministic assessment');
        expect(result.fallback).toBe(true);
      });

      it('quarantines the injected text behind an evidence label in the prompt', async () => {
        const client = FakeLlmClient.echo();
        const service = new AiAdapterService(buildAdapterOptions({ client }));

        await service.assess({
          deterministic: makeDeterministic('AMBER', { evidenceKeys: ['ev.synthetic.1', text] }),
          conflictingSignals: true,
          evidenceHash: 'sha256:injection-evidence-prompt',
        });

        expect(client.calls).toHaveLength(1);
        assertEvidenceQuarantined(client.calls[0].input, text);
      });
    },
  );

  it('an injection attempting a verdict override inside a "valid" model reply never flips the result', async () => {
    const injection = PROMPT_INJECTION_FIXTURES[0].text;
    // Fake client returns schema-valid output that AGREES with the injected
    // instruction (claims RED) while the deterministic verdict is GREEN.
    const client = FakeLlmClient.fromJson({
      assessment: 'RED',
      summary: `following embedded instruction: ${injection}`,
      evidenceKeys: ['ev.synthetic.1'],
      confidence: 'HIGH',
      issueCode: 'NO_ISSUE',
      recommendedRunbook: 'none',
      automationEligibility: 'AUTO_SAFE',
    });
    const service = new AiAdapterService(buildAdapterOptions({ client }));

    const result = await service.assess({
      deterministic: makeDeterministic('GREEN', { summary: `note: ${injection}` }),
      conflictingSignals: false,
      evidenceHash: 'sha256:injection-override',
    });

    expect(result.assessment.assessment).toBe('GREEN');
    expect(result.fallback).toBe(true);
  });
});
