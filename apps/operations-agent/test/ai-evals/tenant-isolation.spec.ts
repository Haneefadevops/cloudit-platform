/**
 * Eval suite 8: tenant isolation (operator-plan 10, 14 — "cross-tenant
 * read/write denial").
 *
 * `evidenceHash` values shaped like other-environment / other-tenant keys are
 * opaque strings: the adapter must carry them through verbatim (into the
 * audit event) without parsing, validating or enriching them into any
 * tenant-shaped field of its own.
 */

import { AiAdapterService } from '../../src/ai';
import {
  buildAdapterOptions,
  collectStrings,
  FakeLlmClient,
  makeDeterministic,
  RecordingAuditSink,
  TENANT_SHAPED_PATTERN,
} from './fixtures';

const TENANT_SHAPED_HASHES = [
  'ten_cavetta-live#snapshot-019283',
  'tenant_hospitality/prod:ev-5566',
  'env_ops_portal|client_42#key-0007',
] as const;

describe('AiAdapterService — tenant-isolation evals', () => {
  it.each(TENANT_SHAPED_HASHES)('carries other-environment hash "%s" through opaquely', async (evidenceHash) => {
    const client = FakeLlmClient.fromJson(makeDeterministic('GREEN'));
    const audit = new RecordingAuditSink();
    const service = new AiAdapterService(buildAdapterOptions({ client, audit }));

    const result = await service.assess({
      deterministic: makeDeterministic('GREEN'),
      conflictingSignals: false,
      evidenceHash,
    });

    expect(result.assessment.assessment).toBe('GREEN');
    expect(JSON.stringify(audit.events)).toContain(evidenceHash);
  });

  it.each(TENANT_SHAPED_HASHES)(
    'adds no tenant-shaped field of its own for hash "%s" (hash is the only tenant-shaped string in the audit event)',
    async (evidenceHash) => {
      const client = FakeLlmClient.fromJson(makeDeterministic('GREEN'));
      const audit = new RecordingAuditSink();
      const service = new AiAdapterService(buildAdapterOptions({ client, audit }));

      await service.assess({
        deterministic: makeDeterministic('GREEN'),
        conflictingSignals: false,
        evidenceHash,
      });

      expect(audit.events.length).toBeGreaterThanOrEqual(1);
      for (const event of audit.events) {
        const tenantShaped = collectStrings(event).filter((s) => TENANT_SHAPED_PATTERN.test(s));
        for (const value of tenantShaped) {
          expect(value).toBe(evidenceHash);
        }
      }
    },
  );

  it('accepts a plain content-hash without any tenant shape and still audits verbatim', async () => {
    const evidenceHash = 'sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
    const client = FakeLlmClient.fromJson(makeDeterministic('AMBER'));
    const audit = new RecordingAuditSink();
    const service = new AiAdapterService(buildAdapterOptions({ client, audit }));

    const result = await service.assess({
      deterministic: makeDeterministic('AMBER'),
      conflictingSignals: true,
      evidenceHash,
    });

    expect(result.fallback).toBe(false);
    expect(JSON.stringify(audit.events)).toContain(evidenceHash);
  });

  it('never rejects an assessment because the hash looks foreign (no tenant validation of the hash)', async () => {
    const hostileShapes = [
      '../../ten_other/secret',
      'ten_%00injection',
      'client_-1',
    ];
    for (const evidenceHash of hostileShapes) {
      const client = FakeLlmClient.fromJson(makeDeterministic('GREEN'));
      const service = new AiAdapterService(buildAdapterOptions({ client }));

      await expect(
        service.assess({
          deterministic: makeDeterministic('GREEN'),
          conflictingSignals: false,
          evidenceHash,
        }),
      ).resolves.toBeDefined();
    }
  });
});
