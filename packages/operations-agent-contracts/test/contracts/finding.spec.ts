import { validateFinding } from '../../src/contracts/finding';
import { canonicalFinding } from './fixtures';
import {
  expectNonObjectInputsRejected,
  expectOversizedSummaryAndEvidenceKeysRejected,
  expectRejected,
} from './helpers';

describe('validateFinding', () => {
  it('accepts the canonical valid fixture', () => {
    const result = validateFinding(canonicalFinding);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(canonicalFinding);
    }
  });

  it('rejects an unknown extra field (closed schema)', () => {
    const errors = expectRejected(validateFinding({ ...canonicalFinding, injected: true }));
    expect(errors.join(' ')).toMatch(/injected.*unknown field/);
  });

  it('rejects a non-member severity enum value', () => {
    const errors = expectRejected(validateFinding({ ...canonicalFinding, severity: 'debug' }));
    expect(errors.join(' ')).toMatch(/severity.*not a member of the closed enum/);
  });

  it('rejects a non-member finding state enum value', () => {
    const errors = expectRejected(validateFinding({ ...canonicalFinding, state: 'frozen' }));
    expect(errors.join(' ')).toMatch(/state.*not a member of the closed enum/);
  });

  it('rejects a wrong-typed field', () => {
    const errors = expectRejected(validateFinding({ ...canonicalFinding, findingId: 12345 }));
    expect(errors.join(' ')).toMatch(/findingId.*expected string/);
  });

  it('rejects a malformed timestamp', () => {
    const errors = expectRejected(validateFinding({ ...canonicalFinding, lastSeenAt: 'not-a-timestamp' }));
    expect(errors.join(' ')).toMatch(/lastSeenAt.*ISO-8601/);
  });

  it('rejects a plausible but invalid ISO date (month 13)', () => {
    const errors = expectRejected(validateFinding({ ...canonicalFinding, firstSeenAt: '2026-13-19T10:15:30Z' }));
    expect(errors.join(' ')).toMatch(/firstSeenAt.*ISO-8601/);
  });

  expectOversizedSummaryAndEvidenceKeysRejected(validateFinding, canonicalFinding);
  expectNonObjectInputsRejected(validateFinding);
});
