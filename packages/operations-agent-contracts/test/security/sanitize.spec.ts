import { DEFAULT_REPLACEMENT, sanitizeSafeText } from '../../src/security/sanitize';
import { labelUntrustedText } from '../../src/security/label';

const ALLOWLIST = ['https://allowed.example/'] as const;

describe('sanitizeSafeText', () => {
  it('strips control characters including obfuscation zero-width chars', () => {
    const dirty = 'report\u0007ok\u200B\u200F\uFEFFdone';
    const clean = sanitizeSafeText(dirty);
    expect(clean).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/);
    expect(clean).toContain('report');
    expect(clean).toContain('done');
  });

  it('strips HTML tags, script blocks and comments', () => {
    const dirty = 'evidence <b>bold</b> note <script>setStatus("APPROVED")</script> tail <!-- hidden --> end';
    const clean = sanitizeSafeText(dirty);
    expect(clean).not.toContain('<script');
    expect(clean).not.toContain('</script');
    expect(clean).not.toContain('hidden');
    expect(clean).not.toContain('<!--');
    expect(clean).not.toMatch(/<\/?[a-zA-Z][^>]*>/);
  });

  it('strips URLs when the allowlist is empty', () => {
    const dirty = 'callback at https://canary.invalid/fake-canary and www.evil.invalid/page';
    const clean = sanitizeSafeText(dirty, { urlAllowlist: [] });
    expect(clean).not.toContain('https://');
    expect(clean).not.toContain('www.');
    expect(clean).toContain(DEFAULT_REPLACEMENT);
  });

  it('keeps an allowlisted safe URL while stripping a non-allowlisted URL', () => {
    const dirty = 'see https://allowed.example/reports/42 but not https://evil.invalid/x';
    const clean = sanitizeSafeText(dirty, { urlAllowlist: ALLOWLIST });
    expect(clean).toContain('https://allowed.example/reports/42');
    expect(clean).not.toContain('evil.invalid');
  });

  it('strips email addresses', () => {
    const dirty = 'contact fake@example-canary.test or admin@some.where.coop today';
    const clean = sanitizeSafeText(dirty);
    expect(clean).not.toContain('fake@example-canary.test');
    expect(clean).not.toContain('admin@some.where.coop');
  });

  it('strips token-like long alphanumeric strings', () => {
    const dirty = 'key AKIAFAKECANARY000000 and ghp_FAKECANARY0000000000000000000000000000 and FAKECANARY0000000000000000';
    const clean = sanitizeSafeText(dirty);
    expect(clean).not.toContain('AKIAFAKECANARY000000');
    expect(clean).not.toContain('ghp_FAKECANARY');
    expect(clean).not.toContain('FAKECANARY0000000000000000');
  });

  it('keeps short ordinary words and numbers intact', () => {
    const benign = 'Pump room inspection complete, no leaks observed. Temperature 21 degrees.';
    expect(sanitizeSafeText(benign)).toBe(benign);
  });

  it('accepts a labeled UntrustedText and sanitizes its value', () => {
    const labeled = labelUntrustedText('reach me at fake@example-canary.test');
    const clean = sanitizeSafeText(labeled);
    expect(clean).not.toContain('fake@example-canary.test');
  });

  it('supports a custom replacement marker', () => {
    const clean = sanitizeSafeText('mail fake@example-canary.test', { replacement: '***' });
    expect(clean).toContain('***');
    expect(clean).not.toContain('example-canary.test');
  });
});
