import { KEY_ID_MAX_LENGTH, SHORT_CODE_MAX_LENGTH } from '../../src/contracts/validation';
import { validateRepairRequest } from '../../src/contracts/repair-request';
import { canonicalRepairRequest } from './fixtures';
import { expectNonObjectInputsRejected, expectRejected } from './helpers';

describe('validateRepairRequest', () => {
  it('accepts the canonical valid fixture', () => {
    const result = validateRepairRequest(canonicalRepairRequest);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(canonicalRepairRequest);
    }
  });

  it('rejects an unknown extra field (closed schema)', () => {
    const errors = expectRejected(
      validateRepairRequest({ ...canonicalRepairRequest, arbitrarySql: 'SELECT 1' }),
    );
    expect(errors.join(' ')).toMatch(/arbitrarySql.*unknown field/);
  });

  it('rejects a non-member proposal state enum value', () => {
    const errors = expectRejected(
      validateRepairRequest({ ...canonicalRepairRequest, proposalState: 'maybe' }),
    );
    expect(errors.join(' ')).toMatch(/proposalState.*not a member of the closed enum/);
  });

  it('rejects a non-member attempt state enum value', () => {
    const errors = expectRejected(
      validateRepairRequest({ ...canonicalRepairRequest, attemptState: 'exploded' }),
    );
    expect(errors.join(' ')).toMatch(/attemptState.*not a member of the closed enum/);
  });

  it('rejects a non-member authority tier', () => {
    const errors = expectRejected(validateRepairRequest({ ...canonicalRepairRequest, authorityTier: 'E' }));
    expect(errors.join(' ')).toMatch(/authorityTier.*not a member of the closed enum/);
  });

  it('rejects a wrong-typed field', () => {
    const errors = expectRejected(validateRepairRequest({ ...canonicalRepairRequest, runbookVersion: 100 }));
    expect(errors.join(' ')).toMatch(/runbookVersion.*expected string/);
  });

  it('rejects "none" as a concrete runbook key', () => {
    const errors = expectRejected(validateRepairRequest({ ...canonicalRepairRequest, runbookKey: 'none' }));
    expect(errors.join(' ')).toMatch(/runbookKey.*pattern/);
  });

  it('rejects a malformed runbook version', () => {
    const errors = expectRejected(validateRepairRequest({ ...canonicalRepairRequest, runbookVersion: 'v1' }));
    expect(errors.join(' ')).toMatch(/runbookVersion.*pattern/);
  });

  it('rejects an oversized idempotency key', () => {
    const errors = expectRejected(
      validateRepairRequest({
        ...canonicalRepairRequest,
        idempotencyKey: `k${'x'.repeat(KEY_ID_MAX_LENGTH)}`,
      }),
    );
    expect(errors.join(' ')).toMatch(/exceeds maximum length/);
  });

  it('rejects an oversized issue code', () => {
    const errors = expectRejected(
      validateRepairRequest({
        ...canonicalRepairRequest,
        issueCode: `A${'_CODE'.repeat(SHORT_CODE_MAX_LENGTH)}`,
      }),
    );
    expect(errors.join(' ')).toMatch(/exceeds maximum length/);
  });

  expectNonObjectInputsRejected(validateRepairRequest);
});
