import { SecurityError } from '../../src/security/errors';
import { detectCanaryLeak } from '../../src/security/canary';
import { SECRET_CANARY_FIXTURES } from '../../src/security/fixtures/secret-canary';
import { sanitizeSafeText } from '../../src/security/sanitize';

describe('detectCanaryLeak', () => {
  it('detects every canary embedded in surrounding output text', () => {
    for (const canary of SECRET_CANARY_FIXTURES) {
      const output = `operator note: leaked value is ${canary.value} end of note`;
      const report = detectCanaryLeak(output);
      expect(report.leaked).toBe(true);
      expect(report.categories).toContain(canary.category);
      expect(report.matches).toContain(canary.value);
    }
  });

  it('reports all categories present in a combined leak', () => {
    const output = [
      'xoxb-fake-canary-0123456789abcdef0123',
      'AKIAFAKECANARY000000',
      'fake@example-canary.test',
      'https://canary.invalid/fake-canary',
      'FAKECANARY0000000000000000',
    ].join(' | ');
    const report = detectCanaryLeak(output);
    expect(report.leaked).toBe(true);
    expect(report.categories).toEqual(expect.arrayContaining(['token', 'apiKey', 'email', 'url', 'privateId']));
    expect(report.matches).toHaveLength(5);
  });

  it('returns leaked=false for clean text', () => {
    const report = detectCanaryLeak('all quiet in the pump room');
    expect(report.leaked).toBe(false);
    expect(report.categories).toHaveLength(0);
    expect(report.matches).toHaveLength(0);
  });

  it('fail-closed: throws a typed SecurityError for non-string input', () => {
    for (const bad of [null, undefined, 42, {}]) {
      expect(() => detectCanaryLeak(bad)).toThrow(SecurityError);
    }
    try {
      detectCanaryLeak(undefined);
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as SecurityError).code).toBe('SECURITY_ERR_INVALID_INPUT');
    }
  });
});

describe('sanitizeSafeText removes every canary', () => {
  it('every canary detected before sanitization is absent after (empty allowlist)', () => {
    for (const canary of SECRET_CANARY_FIXTURES) {
      const raw = `prefix ${canary.value} suffix`;
      expect(detectCanaryLeak(raw).leaked).toBe(true);
      const sanitized = sanitizeSafeText(raw, { urlAllowlist: [] });
      const report = detectCanaryLeak(sanitized);
      expect(report.leaked).toBe(false);
      expect(report.matches).toHaveLength(0);
    }
  });
});
