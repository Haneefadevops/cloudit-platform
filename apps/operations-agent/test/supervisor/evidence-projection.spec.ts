/**
 * Fail-closed boundary tests for SanitizedEvidenceProjection validation.
 */

import { ValidationResult } from '@cloudit/operations-agent-contracts';
import {
  DEFAULT_SOURCE_KEYS,
  SanitizedEvidenceProjection,
  validateEvidenceProjection,
} from '../../src/supervisor';
import { makeProjection, makeRecord } from './fixtures';

const KNOWN = new Set<string>(DEFAULT_SOURCE_KEYS);

function validate(input: unknown): ValidationResult<SanitizedEvidenceProjection> {
  return validateEvidenceProjection(input, KNOWN);
}

describe('validateEvidenceProjection (fail-closed boundary)', () => {
  const asUnknown = (value: unknown): unknown => value;

  it('accepts a fully conforming synthetic projection', () => {
    const result = validate(makeProjection());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.client).toBe('client-synthetic');
      expect(result.value.records).toHaveLength(DEFAULT_SOURCE_KEYS.length);
    }
  });

  it('rejects a non-object projection', () => {
    for (const bad of [null, undefined, 'projection', 42, ['records']]) {
      expect(validate(bad).ok).toBe(false);
    }
  });

  it('rejects any top-level field outside the allowlist', () => {
    const projection = asUnknown(makeProjection()) as Record<string, unknown>;
    projection.rawProviderResponse = 'should never cross the boundary';
    const result = validate(projection);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('unknown field'))).toBe(true);
    }
  });

  it('rejects any record field outside the allowlist', () => {
    const projection = asUnknown(makeProjection()) as {
      records: Record<string, unknown>[];
    };
    projection.records[0].executionPayload = { command: 'rm -rf /' };
    const result = validate(projection);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('unknown field'))).toBe(true);
    }
  });

  it('rejects unknown source keys', () => {
    const result = validate(
      makeProjection({ records: [makeRecord({ sourceKey: 'attacker-controlled-source' })] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes('not a known evidence source'))).toBe(true);
    }
  });

  it('rejects a record whose client identifier differs from the declared client', () => {
    const projection = makeProjection();
    const record = { ...projection.records[0], client: 'client-other-tenant' };
    const result = validate({ ...projection, records: [record] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("projection's declared client"))).toBe(true);
    }
  });

  it('rejects a record whose environment identifier differs from the declared environment', () => {
    const projection = makeProjection();
    const record = { ...projection.records[0], environment: 'env-other' };
    const result = validate({ ...projection, records: [record] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("projection's declared environment"))).toBe(true);
    }
  });

  it('accepts record identifiers that match the declared identifiers', () => {
    const projection = makeProjection();
    const record = {
      ...projection.records[0],
      client: projection.client,
      environment: projection.environment,
    };
    const result = validate({ ...projection, records: [record] });
    expect(result.ok).toBe(true);
  });

  it('rejects tenant identifiers crossing the boundary shape rules', () => {
    expect(validate(makeProjection({ client: 'bad client!' })).ok).toBe(false);
    expect(validate(makeProjection({ environment: 'ENV-UPPERCASE' })).ok).toBe(false);
    expect(validate(makeProjection({ environment: 'ok-env_1' })).ok).toBe(true);
  });

  it('rejects closed-enum violations', () => {
    const mutate = (patch: Record<string, unknown>): unknown => {
      const projection = asUnknown(makeProjection({ records: [makeRecord()] })) as {
        records: Record<string, unknown>[];
      };
      Object.assign(projection.records[0], patch);
      return projection;
    };

    expect(validate(mutate({ status: 'PWNED' })).ok).toBe(false);
    expect(validate(mutate({ criticality: 'super-critical' })).ok).toBe(false);
    expect(validate(mutate({ severity: 'catastrophic' })).ok).toBe(false);
  });

  it('rejects malformed or inverted timestamps', () => {
    expect(
      validate(makeProjection({ records: [makeRecord({ observedAt: 'not-a-time' })] })).ok,
    ).toBe(false);
    expect(
      validate(
        makeProjection({
          records: [
            makeRecord({
              observedAt: '2025-09-22T12:30:00.000Z',
              freshUntil: '2025-09-22T12:00:00.000Z',
            }),
          ],
        }),
      ).ok,
    ).toBe(false);
  });

  it('rejects control characters and oversized safe summaries', () => {
    expect(
      validate(makeProjection({ records: [makeRecord({ safeSummary: 'bad\u0000summary' })] })).ok,
    ).toBe(false);
    expect(
      validate(makeProjection({ records: [makeRecord({ safeSummary: 'x'.repeat(1001) })] })).ok,
    ).toBe(false);
  });

  it('rejects malformed counts (negative, non-integer, bad keys, too many keys)', () => {
    const withCounts = (counts: Record<string, number>): unknown => {
      const projection = asUnknown(makeProjection({ records: [makeRecord({ counts: {} })] })) as {
        records: Record<string, unknown>[];
      };
      projection.records[0].counts = counts;
      return projection;
    };

    expect(validate(withCounts({})).ok).toBe(true);
    expect(validate(withCounts({ failures: -1 })).ok).toBe(false);
    expect(validate(withCounts({ ratio: 0.5 })).ok).toBe(false);
    expect(validate(withCounts({ 'Bad Key!': 1 })).ok).toBe(false);
    expect(
      validate(withCounts(Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`k${i}`, 1])))).ok,
    ).toBe(false);
  });

  it('rejects duplicate source keys and oversized record lists', () => {
    const duplicate = makeRecord({ sourceKey: 'database' });
    expect(
      validate(makeProjection({ records: [duplicate, { ...duplicate }] })).ok,
    ).toBe(false);

    const many = Array.from({ length: 51 }, (_, i) =>
      makeRecord({ sourceKey: `public-website-${i}` }),
    );
    expect(validate(makeProjection({ records: many })).ok).toBe(false);
  });

  it('rejects records that are not objects and missing required fields', () => {
    expect(validate(makeProjection({ records: ['nope' as never] })).ok).toBe(false);
    const incomplete = { sourceKey: 'database' };
    expect(validate(makeProjection({ records: [incomplete as never] })).ok).toBe(false);
  });
});
