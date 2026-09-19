/**
 * Malformed-input fixtures: wrong types, nulls, deeply nested payloads and
 * oversized payloads. `expectedIssue` is the issue code that fail-closed
 * validation must report for the fixture.
 */
import { SECURITY_LIMITS } from '../limits';
import type { SecurityErrorCode } from '../errors';

export interface MalformedInputFixture {
  readonly id: string;
  readonly description: string;
  readonly input: unknown;
  readonly expectedIssue: SecurityErrorCode;
}

function buildDeeplyNested(wraps: number): unknown {
  let current: unknown = { leaf: 'bottom' };
  for (let i = 0; i < wraps; i++) {
    current = { nested: current };
  }
  return current;
}

export const MALFORMED_INPUT_FIXTURES: readonly MalformedInputFixture[] = [
  {
    id: 'mal-batch-not-array',
    description: 'Batch itself is a string, not an array.',
    input: 'not-an-evidence-batch',
    expectedIssue: 'SECURITY_ERR_VALIDATION',
  },
  {
    id: 'mal-null-item',
    description: 'Array containing a null item.',
    input: [null],
    expectedIssue: 'SECURITY_ERR_VALIDATION',
  },
  {
    id: 'mal-array-as-item',
    description: 'Array nested as an evidence item.',
    input: [[1, 2, 3]],
    expectedIssue: 'SECURITY_ERR_VALIDATION',
  },
  {
    id: 'mal-numeric-id',
    description: 'Evidence id is a number instead of a string.',
    input: [{ id: 12345, costMicros: 10 }],
    expectedIssue: 'SECURITY_ERR_VALIDATION',
  },
  {
    id: 'mal-empty-id',
    description: 'Evidence id is an empty string.',
    input: [{ id: '', costMicros: 10 }],
    expectedIssue: 'SECURITY_ERR_VALIDATION',
  },
  {
    id: 'mal-missing-id',
    description: 'Evidence item without an id.',
    input: [{ costMicros: 10 }],
    expectedIssue: 'SECURITY_ERR_VALIDATION',
  },
  {
    id: 'mal-nan-cost',
    description: 'Cost field is NaN.',
    input: [{ id: 'ev-1', costMicros: Number.NaN }],
    expectedIssue: 'SECURITY_ERR_VALIDATION',
  },
  {
    id: 'mal-infinite-tokens',
    description: 'Token count is Infinity.',
    input: [{ id: 'ev-1', tokenCount: Number.POSITIVE_INFINITY }],
    expectedIssue: 'SECURITY_ERR_VALIDATION',
  },
  {
    id: 'mal-negative-cost',
    description: 'Negative cost value.',
    input: [{ id: 'ev-1', costMicros: -5 }],
    expectedIssue: 'SECURITY_ERR_VALIDATION',
  },
  {
    id: 'mal-string-cost',
    description: 'Cost field is a non-numeric string.',
    input: [{ id: 'ev-1', costMicros: 'twelve' }],
    expectedIssue: 'SECURITY_ERR_VALIDATION',
  },
  {
    id: 'mal-deeply-nested',
    description: 'Object nested deeper than MAX_EVIDENCE_DEPTH.',
    input: [buildDeeplyNested(SECURITY_LIMITS.MAX_EVIDENCE_DEPTH + 8)],
    expectedIssue: 'SECURITY_ERR_DEPTH',
  },
  {
    id: 'mal-oversized-payload',
    description: 'Single oversized string pushes the payload past MAX_INPUT_BYTES.',
    input: [{ id: 'ev-1', note: 'x'.repeat(SECURITY_LIMITS.MAX_INPUT_BYTES + 1) }],
    expectedIssue: 'SECURITY_ERR_SIZE',
  },
  {
    id: 'mal-too-many-items',
    description: 'Batch with more items than MAX_BATCH_ITEMS.',
    input: Array.from({ length: SECURITY_LIMITS.MAX_BATCH_ITEMS + 100 }, (_, i) => ({ id: `ev-${i}` })),
    expectedIssue: 'SECURITY_ERR_SIZE',
  },
];
