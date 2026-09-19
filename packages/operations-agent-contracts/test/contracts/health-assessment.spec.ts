import { validateHealthAssessment } from '../../src/contracts/health-assessment';
import { canonicalHealthAssessment } from './fixtures';
import {
  expectNonObjectInputsRejected,
  expectOversizedSummaryAndEvidenceKeysRejected,
  expectRejected,
} from './helpers';

describe('validateHealthAssessment', () => {
  it('accepts the canonical valid fixture', () => {
    const result = validateHealthAssessment(canonicalHealthAssessment);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(canonicalHealthAssessment);
    }
  });

  it('rejects an unknown extra field (closed schema)', () => {
    const errors = expectRejected(
      validateHealthAssessment({ ...canonicalHealthAssessment, unexpectedField: 'nope' }),
    );
    expect(errors.join(' ')).toMatch(/unexpectedField.*unknown field/);
  });

  it('rejects a non-member health status enum value', () => {
    const errors = expectRejected(validateHealthAssessment({ ...canonicalHealthAssessment, assessment: 'BLUE' }));
    expect(errors.join(' ')).toMatch(/assessment.*not a member of the closed enum/);
  });

  it('rejects a non-member confidence enum value', () => {
    const errors = expectRejected(validateHealthAssessment({ ...canonicalHealthAssessment, confidence: 'CERTAIN' }));
    expect(errors.join(' ')).toMatch(/confidence.*not a member of the closed enum/);
  });

  it('rejects a non-member automationEligibility enum value', () => {
    const errors = expectRejected(
      validateHealthAssessment({ ...canonicalHealthAssessment, automationEligibility: 'WHATEVER' }),
    );
    expect(errors.join(' ')).toMatch(/automationEligibility.*not a member of the closed enum/);
  });

  it('rejects a wrong-typed field', () => {
    const errors = expectRejected(validateHealthAssessment({ ...canonicalHealthAssessment, summary: 42 }));
    expect(errors.join(' ')).toMatch(/summary.*expected string/);
  });

  it('rejects a wrong-typed evidenceKeys field', () => {
    const errors = expectRejected(
      validateHealthAssessment({ ...canonicalHealthAssessment, evidenceKeys: 'not-an-array' }),
    );
    expect(errors.join(' ')).toMatch(/evidenceKeys.*expected array/);
  });

  it('rejects "none" as an issue code and a runbook key as an issue code', () => {
    expectRejected(validateHealthAssessment({ ...canonicalHealthAssessment, issueCode: 'none' }));
    expectRejected(validateHealthAssessment({ ...canonicalHealthAssessment, issueCode: 'RB-READONLY-RECHECK-001' }));
  });

  it('accepts an approved runbook key as recommendedRunbook', () => {
    const result = validateHealthAssessment({
      ...canonicalHealthAssessment,
      recommendedRunbook: 'RB-READONLY-RECHECK-001',
    });
    expect(result.ok).toBe(true);
  });

  expectOversizedSummaryAndEvidenceKeysRejected(validateHealthAssessment, canonicalHealthAssessment);
  expectNonObjectInputsRejected(validateHealthAssessment);
});
