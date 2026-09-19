import { createEnvelopeValidator } from '../../src/contracts/envelope';
import { validateHealthAssessment } from '../../src/contracts/health-assessment';
import { canonicalHealthAssessmentEnvelope } from './fixtures';
import { expectRejected } from './helpers';

const validateHealthAssessmentEnvelope = createEnvelopeValidator(
  'health_assessment',
  validateHealthAssessment,
);

describe('createEnvelopeValidator', () => {
  it('accepts the canonical valid envelope', () => {
    const result = validateHealthAssessmentEnvelope(canonicalHealthAssessmentEnvelope);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(canonicalHealthAssessmentEnvelope);
    }
  });

  it('rejects an unknown extra envelope field (closed schema)', () => {
    const errors = expectRejected(
      validateHealthAssessmentEnvelope({ ...canonicalHealthAssessmentEnvelope, signature: 'forged' }),
    );
    expect(errors.join(' ')).toMatch(/signature.*unknown field/);
  });

  it('rejects a non-member record type', () => {
    const errors = expectRejected(
      validateHealthAssessmentEnvelope({ ...canonicalHealthAssessmentEnvelope, recordType: 'whatever' }),
    );
    expect(errors.join(' ')).toMatch(/recordType.*not a member of the closed enum/);
  });

  it('rejects a record type that does not match the pinned validator', () => {
    const errors = expectRejected(
      validateHealthAssessmentEnvelope({ ...canonicalHealthAssessmentEnvelope, recordType: 'finding' }),
    );
    expect(errors.join(' ')).toMatch(/recordType: expected "health_assessment", received "finding"/);
  });

  it('rejects an unknown contract version (fail closed on version drift)', () => {
    const errors = expectRejected(
      validateHealthAssessmentEnvelope({ ...canonicalHealthAssessmentEnvelope, contractVersion: '2' }),
    );
    expect(errors.join(' ')).toMatch(/contractVersion.*not a member of the closed enum/);
  });

  it('rejects a wrong-typed envelope field', () => {
    const errors = expectRejected(
      validateHealthAssessmentEnvelope({ ...canonicalHealthAssessmentEnvelope, emittedAt: 123 }),
    );
    expect(errors.join(' ')).toMatch(/emittedAt.*ISO-8601|emittedAt.*expected/);
  });

  it('rejects a malformed payload via the inner contract validator', () => {
    const envelope = {
      ...canonicalHealthAssessmentEnvelope,
      payload: { ...canonicalHealthAssessmentEnvelope.payload, assessment: 'BLUE' },
    };
    const errors = expectRejected(validateHealthAssessmentEnvelope(envelope));
    expect(errors.join(' ')).toMatch(/payload.*assessment.*not a member of the closed enum/);
  });

  it('rejects an unknown extra field inside the payload (closed schema)', () => {
    const envelope = {
      ...canonicalHealthAssessmentEnvelope,
      payload: { ...canonicalHealthAssessmentEnvelope.payload, hidden: 'field' },
    };
    const errors = expectRejected(validateHealthAssessmentEnvelope(envelope));
    expect(errors.join(' ')).toMatch(/payload.*hidden.*unknown field/);
  });

  it('never throws on non-object input', () => {
    for (const bad of [null, undefined, 'envelope', 42, ['array']]) {
      const result = validateHealthAssessmentEnvelope(bad);
      expect(result.ok).toBe(false);
    }
  });
});
