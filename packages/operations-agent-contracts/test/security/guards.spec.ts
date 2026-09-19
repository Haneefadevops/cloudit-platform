import { SecurityError } from '../../src/security/errors';
import { assertNoLeak, checkNoLeak } from '../../src/security/guards';
import { SECRET_CANARY_FIXTURES } from '../../src/security/fixtures/secret-canary';

describe('checkNoLeak (result-returning guard)', () => {
  it('passes clean text through unchanged', () => {
    const result = checkNoLeak('routine pump-room inspection, nothing found');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('routine pump-room inspection, nothing found');
  });

  it('fails closed with a typed error naming the leaked categories', () => {
    const dirty = `token: xoxb-fake-canary-0123456789abcdef0123 and key AKIAFAKECANARY000000`;
    const result = checkNoLeak(dirty);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(SecurityError);
      expect(result.error.code).toBe('SECURITY_ERR_CANARY_LEAK');
      expect(result.error.message).toContain('token');
      expect(result.error.message).toContain('apiKey');
    }
  });

  it('detects every canary value', () => {
    for (const canary of SECRET_CANARY_FIXTURES) {
      const result = checkNoLeak(`value: ${canary.value}`);
      expect(result.ok).toBe(false);
    }
  });
});

describe('assertNoLeak (throwing guard)', () => {
  it('returns the input when clean', () => {
    expect(assertNoLeak('clean output')).toBe('clean output');
  });

  it('throws a typed SecurityError with context on leak', () => {
    try {
      assertNoLeak('leak: fake@example-canary.test', 'report-renderer');
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(SecurityError);
      const securityError = error as SecurityError;
      expect(securityError.code).toBe('SECURITY_ERR_CANARY_LEAK');
      expect(securityError.message).toContain('report-renderer');
      expect(securityError.message).toContain('email');
    }
  });

  it('fail-closed: non-string input throws a typed SecurityError', () => {
    expect(() => assertNoLeak(null)).toThrow(SecurityError);
  });
});
