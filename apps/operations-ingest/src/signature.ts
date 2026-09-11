import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// Request signing per Phase 0 section 7.1:
//   signature = HMAC-SHA256(publisher_secret, `${timestamp}.${nonce}.${digest}`)
//   digest    = SHA-256(raw request body), hex encoded
// All values are lowercase hex / decimal strings joined with dots.

export function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function hmacSha256Hex(secret: string, message: string): string {
  return createHmac('sha256', secret).update(message).digest('hex');
}

export function buildCanonicalString(
  timestamp: string,
  nonce: string,
  bodyDigest: string,
): string {
  return `${timestamp}.${nonce}.${bodyDigest}`;
}

export function isValidHex64(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

export function signaturesEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
