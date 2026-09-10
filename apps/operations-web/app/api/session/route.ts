import { NextRequest, NextResponse } from "next/server";
import { isLoginRateLimited, recordLoginFailure, recordLoginSuccess } from "../../../lib/login-rate-limit";
import { verifyPassword } from "../../../lib/password";
import { getOperationsRuntimeConfig } from "../../../lib/runtime-config";
import { createSessionToken, sessionCookieName } from "../../../lib/session";
import { verifyTotp } from "../../../lib/totp";

const safeReturnPath = (value: FormDataEntryValue | null) => {
  const path = typeof value === "string" ? value : "/overview";
  return path.startsWith("/") && !path.startsWith("//") && !path.startsWith("/api/") ? path : "/overview";
};

const expiredSessionCookie = () =>
  `${sessionCookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;

export async function POST(request: NextRequest) {
  let config;
  try {
    config = getOperationsRuntimeConfig();
  } catch {
    return NextResponse.redirect(new URL("/login?error=configuration", request.nextUrl.origin), 303);
  }

  const forwardedFor = request.headers.get("x-forwarded-for");
  const rateLimitKey = forwardedFor?.split(",").pop()?.trim() || "unknown";
  if (isLoginRateLimited(rateLimitKey)) {
    const response = NextResponse.redirect(new URL("/login?error=throttled", config.publicOrigin), 303);
    response.headers.set("Set-Cookie", expiredSessionCookie());
    return response;
  }

  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const totp = String(form.get("totp") ?? "").trim();
  const inputLengthsValid = email.length <= 254 && password.length >= 1 && password.length <= 256 && totp.length <= 6;
  const passwordValid = inputLengthsValid && verifyPassword(password, config.passwordHash) && email === config.ownerEmail;
  const mfaValid = !config.mfaRequired || (config.totpSecret !== null && verifyTotp(totp, config.totpSecret));

  if (!passwordValid || !mfaValid) {
    recordLoginFailure(rateLimitKey);
    const response = NextResponse.redirect(new URL("/login?error=invalid", config.publicOrigin), 303);
    response.headers.set("Set-Cookie", expiredSessionCookie());
    return response;
  }

  recordLoginSuccess(rateLimitKey);

  const token = await createSessionToken(config.ownerEmail, config.sessionSecret, config.sessionTtlSeconds);
  const response = NextResponse.redirect(new URL(safeReturnPath(form.get("returnTo")), config.publicOrigin), 303);
  response.cookies.set(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: config.sessionTtlSeconds,
  });
  return response;
}

export function DELETE(request: NextRequest) {
  const response = NextResponse.json({ status: "signed_out" });
  response.cookies.delete(sessionCookieName);
  return response;
}
