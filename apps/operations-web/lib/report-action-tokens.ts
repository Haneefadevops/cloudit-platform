import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import type { ReportCommandType } from "./operations-api";

// Phase 10 report-action tokens. Both derivations reuse OPERATIONS_SESSION_SECRET
// server-side only; the browser receives the finished values as hidden form fields.
//
// requestKey (idempotency, relayed to platform-api):
//   base64url(HMAC-SHA256(secret, "email|reportKey|commandType|actionNonce")) — 43 chars.
// csrfToken (per-render CSRF proof, verified by the command route):
//   base64url(HMAC-SHA256(secret, "email|reportKey|commandType|csrf|actionNonce"))
// The extra "|csrf|" segment keeps the two derivations distinct so a CSRF token
// can never be replayed as an idempotency key or vice versa.

export function newActionNonce(): string {
  return randomBytes(18).toString("base64url");
}

export function deriveRequestKey(
  secret: string,
  email: string,
  reportKey: string,
  commandType: ReportCommandType,
  actionNonce: string,
): string {
  return createHmac("sha256", secret)
    .update(`${email}|${reportKey}|${commandType}|${actionNonce}`)
    .digest("base64url");
}

export function deriveCsrfToken(
  secret: string,
  email: string,
  reportKey: string,
  commandType: ReportCommandType,
  actionNonce: string,
): string {
  return createHmac("sha256", secret)
    .update(`${email}|${reportKey}|${commandType}|csrf|${actionNonce}`)
    .digest("base64url");
}
