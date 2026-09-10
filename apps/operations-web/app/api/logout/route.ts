import { NextRequest, NextResponse } from "next/server";
import { sessionCookieName } from "../../../lib/session";

export async function POST(request: NextRequest) {
  const origin = process.env.OPERATIONS_PUBLIC_ORIGIN || request.nextUrl.origin;
  const response = NextResponse.redirect(new URL("/login?status=signed-out", origin), 303);
  response.headers.set("Set-Cookie", `${sessionCookieName}=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return response;
}
