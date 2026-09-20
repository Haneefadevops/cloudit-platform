/**
 * Eval suite 2: missed signals (operator-plan 12, 14).
 *
 * A model that returns schema-valid output claiming a better verdict than the
 * deterministic assessment (GREEN when the deterministic verdict is RED or
 * AMBER) must never downgrade or wash out a real finding: the deterministic
 * verdict is always retained and the run falls back.
 */

import { AiAdapterService } from '../../src/ai';
import { buildAdapterOptions, FakeLlmClient, makeDeterministic, makeModelOutput } from './fixtures';

describe('AiAdapterService — missed-signal evals', () => {
  it.each([
    ['RED', 'a missed RED downgraded to GREEN'],
    ['AMBER', 'a missed AMBER downgraded to GREEN'],
  ] as const)('retains %s when the model returns valid GREEN output', async (verdict, label) => {
    const client = FakeLlmClient.fromAssessment(
      makeModelOutput({ assessment: 'GREEN', summary: `synthetic ${label}` }),
    );
    const service = new AiAdapterService(buildAdapterOptions({ client }));

    const result = await service.assess({
      deterministic: makeDeterministic(verdict),
      conflictingSignals: verdict === 'RED',
      evidenceHash: 'sha256:missed-signal',
    });

    expect(result.assessment.assessment).toBe(verdict);
    expect(result.fallback).toBe(true);
    expect(result.model).toBe('deterministic');
    expect(result.assessment.summary).toBe('synthetic deterministic assessment');
  });

  it('retains RED even when the model agrees on AMBER (partial downgrade is still a downgrade)', async () => {
    const client = FakeLlmClient.fromAssessment(makeModelOutput({ assessment: 'AMBER' }));
    const service = new AiAdapterService(buildAdapterOptions({ client }));

    const result = await service.assess({
      deterministic: makeDeterministic('RED'),
      conflictingSignals: true,
      evidenceHash: 'sha256:missed-signal-partial',
    });

    expect(result.assessment.assessment).toBe('RED');
    expect(result.fallback).toBe(true);
  });

  it('retains RED when the model omits the deterministic issue code and claims all-clear', async () => {
    const client = FakeLlmClient.fromAssessment(
      makeModelOutput({ assessment: 'GREEN', issueCode: 'NO_ISSUE', confidence: 'HIGH' }),
    );
    const service = new AiAdapterService(buildAdapterOptions({ client }));

    const result = await service.assess({
      deterministic: makeDeterministic('RED', { issueCode: 'BACKUP_STALE' }),
      conflictingSignals: true,
      evidenceHash: 'sha256:missed-signal-issue',
    });

    expect(result.assessment.assessment).toBe('RED');
    expect(result.assessment.issueCode).toBe('BACKUP_STALE');
    expect(result.fallback).toBe(true);
  });
});
