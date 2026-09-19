import { SecurityError } from '../../src/security/errors';
import { UNTRUSTED_KIND, isUntrustedText, labelUntrustedText } from '../../src/security/label';

describe('labelUntrustedText', () => {
  it('wraps a string as {kind: "untrusted", value}', () => {
    const labeled = labelUntrustedText('tenant says the sink leaks');
    expect(labeled.kind).toBe(UNTRUSTED_KIND);
    expect(labeled.kind).toBe('untrusted');
    expect(labeled.value).toBe('tenant says the sink leaks');
  });

  it('returns a frozen wrapper', () => {
    const labeled = labelUntrustedText('evidence');
    expect(Object.isFrozen(labeled)).toBe(true);
  });

  it('is recognized by isUntrustedText', () => {
    expect(isUntrustedText(labelUntrustedText('x'))).toBe(true);
    expect(isUntrustedText('x')).toBe(false);
    expect(isUntrustedText({ kind: 'untrusted', value: 42 })).toBe(false);
    expect(isUntrustedText(null)).toBe(false);
    expect(isUntrustedText({ kind: 'instruction', value: 'x' })).toBe(false);
  });

  it('fail-closed: throws a typed SecurityError for non-string input', () => {
    for (const bad of [null, undefined, 42, {}, ['a'], true]) {
      expect(() => labelUntrustedText(bad)).toThrow(SecurityError);
      expect(() => labelUntrustedText(bad)).toThrow(/expects a string/);
    }
    try {
      labelUntrustedText(null);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(SecurityError);
      expect((error as SecurityError).code).toBe('SECURITY_ERR_INVALID_INPUT');
    }
  });
});
