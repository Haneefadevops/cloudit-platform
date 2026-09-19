/**
 * Shared acceptance-test helpers for the contract validators.
 */

import {
  EVIDENCE_KEYS_MAX_ITEMS,
  SUMMARY_MAX_LENGTH,
  ValidationResult,
} from '../../src/contracts/validation';

export type Validator<T> = (input: unknown) => ValidationResult<T>;

export function expectRejected(result: ValidationResult<unknown>): string[] {
  expect(result.ok).toBe(false);
  if (result.ok) {
    throw new Error('expected rejection but validator accepted the input');
  }
  expect(result.errors.length).toBeGreaterThan(0);
  return result.errors;
}

/** Every validator must fail closed (never throw) on non-object input. */
export function expectNonObjectInputsRejected<T>(validate: Validator<T>): void {
  it('never throws and rejects non-object input (fail closed)', () => {
    for (const bad of [null, undefined, 'a string', 42, true, ['an', 'array']]) {
      const errors = expectRejected(validate(bad));
      expect(errors.join(' ')).toMatch(/expected an object/);
    }
  });
}

/** Oversized summary and oversized evidenceKeys are rejected. */
export function expectOversizedSummaryAndEvidenceKeysRejected<T>(
  validate: Validator<T>,
  canonical: object,
): void {
  it('rejects a summary over 1000 characters', () => {
    const errors = expectRejected(validate({ ...canonical, summary: 'x'.repeat(SUMMARY_MAX_LENGTH + 1) }));
    expect(errors.join(' ')).toMatch(/exceeds maximum length/);
  });

  it('rejects evidenceKeys over 50 items', () => {
    const oversized = Array.from({ length: EVIDENCE_KEYS_MAX_ITEMS + 1 }, (_, i) => `ev-fixture-${i}`);
    const errors = expectRejected(validate({ ...canonical, evidenceKeys: oversized }));
    expect(errors.join(' ')).toMatch(/exceeds maximum item count/);
  });

  it('rejects control characters in a summary', () => {
    const errors = expectRejected(validate({ ...canonical, summary: 'bad\u0007summary' }));
    expect(errors.join(' ')).toMatch(/control characters/);
  });
}
