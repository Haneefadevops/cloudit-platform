import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";
import {
  isActionRateLimited,
  recordActionFailure,
  recordActionSuccess,
} from "../../../../../lib/action-rate-limit";
import {
  createReportCommand,
  OperationsApiError,
  type ReportCommandResult,
} from "../../../../../lib/operations-api";
import { getOperationsRuntimeConfig } from "../../../../../lib/runtime-config";
import { requireOperationsSession } from "../../../../../lib/server-session";
import { verifyTotp } from "../../../../../lib/totp";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REPORT_KEY = /^[a-z0-9][a-z0-9_.-]{1,120}$/;
const REQUEST_KEY = /^[A-Za-z0-9_-]{21,120}$/;
const ACTION_NONCE = /^[A-Za-z0-9_-]{24}$/;
const COMMAND_TYPES = new Set(["APPROVE_AND_SEND", "REJECT", "RETRY_SEND"]);
const MAX_BODY_BYTES = 8 * 1024;
const MAX_REASON_CHARS = 300;

function hmacBase64Url(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(provided: string, expected: string): boolean {
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  return (
    providedBytes.length === expectedBytes.length &&
    timingSafeEqual(providedBytes, expectedBytes)
  );
}

function jsonError(status: number, message: string) {
  return Response.json(
    { message },
    {
      status,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: { reportKey: string } },
) {
  // 1. Session gate: unauthenticated callers are redirected by the portal guard.
  const session = await requireOperationsSession();

  const reportKey = params.reportKey;
  if (!REPORT_KEY.test(reportKey)) return jsonError(404, "Not found");

  let config;
  try {
    config = getOperationsRuntimeConfig();
  } catch {
    return jsonError(500, "Action could not be recorded. No change was made.");
  }

  // 2. Fail-closed config gate: actions are never exposed until owner TOTP is enabled.
  if (!config.mfaRequired) return jsonError(403, "rejected_mfa");

  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = forwardedFor?.split(",").pop()?.trim() || "unknown";
  const rateLimitKey = `${session.email}|${clientIp}`;

  // 3. Rate limit: max 10 action attempts per 10-minute window per session+IP.
  if (isActionRateLimited(rateLimitKey)) return jsonError(429, "rejected_rate_limit");

  // 4. Strict Origin check (the SameSite=Strict cookie is the first layer; this is the second).
  const expectedOrigin = new URL(config.publicOrigin).origin;
  if (request.headers.get("origin") !== expectedOrigin) {
    recordActionFailure(rateLimitKey);
    return jsonError(403, "rejected_csrf");
  }

  // 5. Bounded JSON body.
  const rawLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(rawLength) && rawLength > MAX_BODY_BYTES) {
    return jsonError(400, "Invalid request");
  }
  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) return jsonError(400, "Invalid request");

  let body: {
    commandType?: unknown;
    requestKey?: unknown;
    actionNonce?: unknown;
    csrfToken?: unknown;
    totpCode?: unknown;
    reason?: unknown;
  };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return jsonError(400, "Invalid request");
  }
  if (typeof body !== "object" || body === null) return jsonError(400, "Invalid request");

  const actionNonce = typeof body.actionNonce === "string" ? body.actionNonce : "";
  const csrfToken = typeof body.csrfToken === "string" ? body.csrfToken : "";
  const commandType = typeof body.commandType === "string" ? body.commandType : "";
  if (!ACTION_NONCE.test(actionNonce) || csrfToken.length === 0) {
    recordActionFailure(rateLimitKey);
    return jsonError(403, "rejected_csrf");
  }

  // CSRF token: the page derives one token per command type as
  //   base64url(HMAC-SHA256(SESSION_SECRET, "email|reportKey|commandType|csrf|actionNonce"))
  // so the route recomputes it from the trusted path reportKey, the commandType
  // carried in the body (used only as HMAC input; enum-validated below), and the
  // body actionNonce. requestKey uses a distinct derivation (no "|csrf|" segment)
  // so the two tokens are never interchangeable.
  const expectedCsrf = hmacBase64Url(
    config.sessionSecret,
    `${session.email}|${reportKey}|${commandType}|csrf|${actionNonce}`,
  );
  if (!safeEqual(csrfToken, expectedCsrf)) {
    recordActionFailure(rateLimitKey);
    return jsonError(403, "rejected_csrf");
  }

  // 6. Step-up MFA: a fresh 6-digit TOTP code is required for every action.
  const totpCode = typeof body.totpCode === "string" ? body.totpCode.trim() : "";
  if (!config.totpSecret || !verifyTotp(totpCode, config.totpSecret)) {
    recordActionFailure(rateLimitKey);
    return jsonError(403, "rejected_mfa");
  }

  // 7. Body validation. Only the safe command shape is accepted; row versions,
  //    states, recipients, signatures and actor identity are never read from the browser.
  if (!COMMAND_TYPES.has(commandType)) return jsonError(400, "Invalid request");
  const requestKey = typeof body.requestKey === "string" ? body.requestKey : "";
  if (!REQUEST_KEY.test(requestKey)) return jsonError(400, "Invalid request");

  let reason: string | undefined;
  if (commandType === "REJECT" && typeof body.reason === "string") {
    if (body.reason.length > MAX_REASON_CHARS) return jsonError(400, "Invalid request");
    const normalized = body.reason.trim();
    reason = normalized.length > 0 ? normalized : undefined;
  }

  // 8. Relay to platform-api and return the safe result verbatim.
  try {
    const result: ReportCommandResult = await createReportCommand(reportKey, {
      commandType: commandType as "APPROVE_AND_SEND" | "REJECT" | "RETRY_SEND",
      requestKey,
      reason,
    });
    // Safe business denials do not clear the attempt budget; only a recorded
    // (non-denial) command does.
    if (result.status !== "denied") recordActionSuccess(rateLimitKey);
    return Response.json(result, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const status =
      error instanceof OperationsApiError && error.statusCode >= 400 && error.statusCode < 600
        ? error.statusCode
        : 502;
    const message =
      error instanceof OperationsApiError ? error.message : "Action could not be recorded. No change was made.";
    return jsonError(status, message);
  }
}
