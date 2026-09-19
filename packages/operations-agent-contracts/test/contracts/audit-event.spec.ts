import { validateAuditEvent } from '../../src/contracts/audit-event';
import { canonicalAuditEvent } from './fixtures';
import {
  expectNonObjectInputsRejected,
  expectOversizedSummaryAndEvidenceKeysRejected,
  expectRejected,
} from './helpers';

describe('validateAuditEvent', () => {
  it('accepts the canonical valid fixture', () => {
    const result = validateAuditEvent(canonicalAuditEvent);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(canonicalAuditEvent);
    }
  });

  it('rejects an unknown extra field (closed schema)', () => {
    const errors = expectRejected(
      validateAuditEvent({ ...canonicalAuditEvent, rawException: 'stack trace would leak here' }),
    );
    expect(errors.join(' ')).toMatch(/rawException.*unknown field/);
  });

  it('rejects a wrong-typed field', () => {
    const errors = expectRejected(validateAuditEvent({ ...canonicalAuditEvent, actor: { user: 'x' } }));
    expect(errors.join(' ')).toMatch(/actor.*expected string/);
  });

  it('rejects an unsafe actor string outside the closed shape', () => {
    const errors = expectRejected(validateAuditEvent({ ...canonicalAuditEvent, actor: '../../etc/passwd' }));
    expect(errors.join(' ')).toMatch(/actor.*pattern/);
  });

  it('rejects reason/result codes outside the safe code shape', () => {
    expectRejected(validateAuditEvent({ ...canonicalAuditEvent, reasonCode: 'fail; drop table' }));
    expectRejected(validateAuditEvent({ ...canonicalAuditEvent, resultCode: 'http://example.com' }));
  });

  it('rejects control characters in a summary', () => {
    const errors = expectRejected(validateAuditEvent({ ...canonicalAuditEvent, summary: 'line1\nline2' }));
    expect(errors.join(' ')).toMatch(/control characters/);
  });

  expectOversizedSummaryAndEvidenceKeysRejected(validateAuditEvent, canonicalAuditEvent);
  expectNonObjectInputsRejected(validateAuditEvent);
});
