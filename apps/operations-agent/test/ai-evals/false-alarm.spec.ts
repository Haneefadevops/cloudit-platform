/**
 * Eval suite 1: false alarms (operator-plan 12, 14 — "confident false claim",
 * "deterministic/AI conflict with deterministic result winning").
 *
 * A model that returns schema-valid output claiming a worse verdict than the
 * deterministic assessment must never override it: the deterministic verdict
 * is retained and the run is reported as a fallback.
 */

import { AiAdapterService } from '../../src/ai';
import {
  buildAdapterOptions,
  FakeLlmClient,
  makeDeterministic,
  makeModelOutput,
  ROUTINE_MODEL,
} from './fixtures';

describe('AiAdapterService — false-alarm evals', () => {
  it.each([
    ['RED', 'a confident false RED claim'],
    ['AMBER', 'a confident false AMBER claim'],
  ] as const)('retains GREEN when the model returns valid %s output', async (claimed, label) => {
    const client = FakeLlmClient.fromAssessment(
      makeModelOutput({ assessment: claimed, summary: `synthetic ${label}` }),
    );
    const service = new AiAdapterService(buildAdapterOptions({ client }));

    const result = await service.assess({
      deterministic: makeDeterministic('GREEN'),
      conflictingSignals: false,
      evidenceHash: 'sha256:falsealarm',
    });

    expect(result.assessment.assessment).toBe('GREEN');
    expect(result.fallback).toBe(true);
    expect(result.model).toBe('deterministic');
    expect(result.assessment.summary).toBe('synthetic deterministic assessment');
  });

  it('retains the deterministic verdict when the model agrees but pads a false worse claim in evidenceKeys', async () => {
    const client = FakeLlmClient.fromAssessment(
      makeModelOutput({
        assessment: 'RED',
        evidenceKeys: ['ev.synthetic.1', 'ev.invented.false-alarm'],
      }),
    );
    const service = new AiAdapterService(buildAdapterOptions({ client }));

    const result = await service.assess({
      deterministic: makeDeterministic('GREEN'),
      conflictingSignals: false,
      evidenceHash: 'sha256:falsealarm-evidence',
    });

    expect(result.assessment.assessment).toBe('GREEN');
    expect(result.fallback).toBe(true);
  });

  it('never invokes the escalation model for a false alarm on a routine case', async () => {
    const client = FakeLlmClient.fromAssessment(makeModelOutput({ assessment: 'RED' }));
    const service = new AiAdapterService(buildAdapterOptions({ client }));

    await service.assess({
      deterministic: makeDeterministic('GREEN'),
      conflictingSignals: false,
      evidenceHash: 'sha256:falsealarm-model',
    });

    for (const call of client.calls) {
      expect(call.model).toBe(ROUTINE_MODEL);
    }
  });
});
