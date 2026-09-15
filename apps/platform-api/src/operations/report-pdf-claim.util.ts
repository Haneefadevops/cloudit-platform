import { BadRequestException } from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'crypto';

export type ReportPdfClaimBody = {
  issuedAt?: unknown;
  expiresAt?: unknown;
  nonce?: unknown;
  correlationId?: unknown;
  disposition?: unknown;
  signature?: unknown;
};

export function verifyReportPdfClaim(
  reportKey: string,
  body: ReportPdfClaimBody,
  secret: string | undefined,
  now = Math.floor(Date.now() / 1000),
): { nonceHash: string; expiryIso: string } {
  const issuedAt = typeof body?.issuedAt === 'number' ? body.issuedAt : NaN;
  const expiresAt = typeof body?.expiresAt === 'number' ? body.expiresAt : NaN;
  const nonce = typeof body?.nonce === 'string' ? body.nonce : '';
  const correlationId =
    typeof body?.correlationId === 'string' ? body.correlationId : '';
  const disposition =
    body?.disposition === 'inline' || body?.disposition === 'attachment'
      ? body.disposition
      : '';
  const providedSignature =
    typeof body?.signature === 'string' ? body.signature : '';

  if (
    !secret ||
    secret.length < 32 ||
    !/^[a-z0-9][a-z0-9_.-]{1,120}$/.test(reportKey) ||
    !Number.isSafeInteger(issuedAt) ||
    !Number.isSafeInteger(expiresAt) ||
    issuedAt > now + 15 ||
    issuedAt < now - 120 ||
    expiresAt <= now ||
    expiresAt > issuedAt + 120 ||
    !/^[a-f0-9]{64}$/.test(nonce) ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      correlationId,
    ) ||
    !disposition ||
    !/^[a-f0-9]{64}$/.test(providedSignature)
  ) {
    throw new BadRequestException('Invalid request');
  }

  const canonical = [
    reportKey,
    String(issuedAt),
    String(expiresAt),
    nonce,
    correlationId,
    disposition,
  ].join('\n');
  const expectedSignature = createHmac('sha256', secret)
    .update(canonical)
    .digest('hex');
  if (
    !timingSafeEqual(
      Buffer.from(providedSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    )
  ) {
    throw new BadRequestException('Invalid request');
  }

  return {
    nonceHash: createHash('sha256').update(nonce).digest('hex'),
    expiryIso: new Date(expiresAt * 1000).toISOString(),
  };
}
