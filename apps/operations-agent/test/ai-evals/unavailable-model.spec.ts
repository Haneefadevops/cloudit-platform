/**
 * Eval suite 7: unavailable model (operator-plan 12, 14 — "model timeout,
 * 429, 5xx, refusal").
 *
 * Every LlmError code plus an unexpected non-LlmError throw must resolve to
 * the deterministic fallback: fallback true, deterministic verdict retained,
 * no throw, and exactly one client invocation (no retry storm).
 */

import { AiAdapterService, LlmError } from '../../src/ai';
import { buildAdapterOptions, FakeLlmClient, makeDeterministic, withCode } from './fixtures';

const LLM_ERROR_CODES = ['timeout', 'rate_limited', 'server', 'refused', 'network', 'invalid_response'] as const;

describe('AiAdapterService — unavailable-model evals', () => {
  it.each(LLM_ERROR_CODES)('falls back deterministically on LlmError code "%s" with exactly one call', async (code) => {
    const client = FakeLlmClient.throwing(
      withCode(new LlmError(`synthetic provider failure (${code})`), code),
    );
    const service = new AiAdapterService(buildAdapterOptions({ client }));

    const promise = service.assess({
      deterministic: makeDeterministic('RED'),
      conflictingSignals: true,
      evidenceHash: 'sha256:unavailable',
    });

    await expect(promise).resolves.toBeDefined();
    const result = await promise;
    expect(result.fallback).toBe(true);
    expect(result.assessment.assessment).toBe('RED');
    expect(client.calls).toHaveLength(1);
  });

  it('falls back deterministically on an unexpected non-LlmError throw with exactly one call', async () => {
    const client = FakeLlmClient.throwing(new Error('synthetic unexpected provider crash'));
    const service = new AiAdapterService(buildAdapterOptions({ client }));

    const promise = service.assess({
      deterministic: makeDeterministic('AMBER'),
      conflictingSignals: true,
      evidenceHash: 'sha256:unavailable-unexpected',
    });

    await expect(promise).resolves.toBeDefined();
    const result = await promise;
    expect(result.fallback).toBe(true);
    expect(result.assessment.assessment).toBe('AMBER');
    expect(client.calls).toHaveLength(1);
  });

  it('retains NO_DATA through a provider failure (never infers GREEN from absence)', async () => {
    const client = FakeLlmClient.throwing(
      withCode(new LlmError('synthetic provider failure (network)'), 'network'),
    );
    const service = new AiAdapterService(buildAdapterOptions({ client }));

    const result = await service.assess({
      deterministic: makeDeterministic('NO_DATA'),
      conflictingSignals: false,
      evidenceHash: 'sha256:unavailable-no-data',
    });

    expect(result.fallback).toBe(true);
    expect(result.assessment.assessment).toBe('NO_DATA');
    expect(client.calls).toHaveLength(1);
  });
});
