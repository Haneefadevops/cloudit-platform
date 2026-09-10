import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName, verifySessionToken } from "./lib/session";

const publicPaths = new Set(["/login", "/api/session", "/api/health"]);

function applySecurityHeaders(response: NextResponse) {
  response.headers.set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  if (process.env.NODE_ENV === "production") response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return response;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (path.startsWith("/_next/") || path === "/favicon.svg") return applySecurityHeaders(NextResponse.next());
  if (publicPaths.has(path)) return applySecurityHeaders(NextResponse.next());

  const session = await verifySessionToken(request.cookies.get(sessionCookieName)?.value, process.env.OPERATIONS_SESSION_SECRET);
  if (!session) {
    const loginUrl = new URL("/login", process.env.OPERATIONS_PUBLIC_ORIGIN || request.nextUrl.origin);
    if (path !== "/") loginUrl.searchParams.set("returnTo", path);
    return applySecurityHeaders(NextResponse.redirect(loginUrl));
  }
  return applySecurityHeaders(NextResponse.next());
}

export const config = { matcher: ["/((?!_next/static|_next/image).*)"] };
