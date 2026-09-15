import { createHmac } from 'crypto';
import { verifyReportPdfClaim } from './report-pdf-claim.util';

const secret = 'phase-9-test-secret-with-at-least-32-characters';
const now = 1_789_430_400;
const reportKey = 'cavetta.monthly_maintenance.2026-09';

function signedBody(overrides: Record<string, unknown> = {}) {
  const body = {
    issuedAt: now,
    expiresAt: now + 60,
    nonce: 'ab'.repeat(32),
    correlationId: '123e4567-e89b-42d3-a456-426614174000',
    disposition: 'inline',
    ...overrides,
  };
  const canonical = [
    reportKey,
    body.issuedAt,
    body.expiresAt,
    body.nonce,
    body.correlationId,
    body.disposition,
  ].join('\n');
  return {
    ...body,
    signature: createHmac('sha256', secret).update(canonical).digest('hex'),
  };
}

describe('verifyReportPdfClaim', () => {
  it('accepts a valid short-lived claim and hashes its nonce', () => {
    expect(verifyReportPdfClaim(reportKey, signedBody(), secret, now)).toEqual({
      nonceHash:
        '271a413bd339c5709fdceaec41f14f11e9fbfb5042d72d331c65f32b284cd09a',
      expiryIso: '2026-09-15T00:01:00.000Z',
    });
  });

  it('rejects a tampered disposition', () => {
    const body = signedBody();
    expect(() =>
      verifyReportPdfClaim(
        reportKey,
        { ...body, disposition: 'attachment' },
        secret,
        now,
      ),
    ).toThrow('Invalid request');
  });

  it('rejects an expired claim', () => {
    expect(() =>
      verifyReportPdfClaim(
        reportKey,
        signedBody({ issuedAt: now - 120, expiresAt: now - 60 }),
        secret,
        now,
      ),
    ).toThrow('Invalid request');
  });
});
