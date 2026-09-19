import { validateRecommendation } from '../../src/contracts/recommendation';
import { canonicalRecommendation } from './fixtures';
import {
  expectNonObjectInputsRejected,
  expectOversizedSummaryAndEvidenceKeysRejected,
  expectRejected,
} from './helpers';

describe('validateRecommendation', () => {
  it('accepts the canonical valid fixture', () => {
    const result = validateRecommendation(canonicalRecommendation);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(canonicalRecommendation);
    }
  });

  it('rejects an unknown extra field (closed schema)', () => {
    const errors = expectRejected(
      validateRecommendation({ ...canonicalRecommendation, bonusField: 'nope' }),
    );
    expect(errors.join(' ')).toMatch(/bonusField.*unknown field/);
  });

  it('rejects a non-member automationEligibility enum value', () => {
    const errors = expectRejected(
      validateRecommendation({ ...canonicalRecommendation, automationEligibility: 'MAYBE' }),
    );
    expect(errors.join(' ')).toMatch(/automationEligibility.*not a member of the closed enum/);
  });

  it('rejects a wrong-typed field', () => {
    const errors = expectRejected(
      validateRecommendation({ ...canonicalRecommendation, recommendedRunbook: ['RB-X'] }),
    );
    expect(errors.join(' ')).toMatch(/recommendedRunbook.*expected string/);
  });

  it('rejects a runbook key that does not exist in the allowlist shape', () => {
    const errors = expectRejected(
      validateRecommendation({ ...canonicalRecommendation, recommendedRunbook: 'rm -rf everything' }),
    );
    expect(errors.join(' ')).toMatch(/recommendedRunbook.*pattern/);
  });

  expectOversizedSummaryAndEvidenceKeysRejected(validateRecommendation, canonicalRecommendation);
  expectNonObjectInputsRejected(validateRecommendation);
});
