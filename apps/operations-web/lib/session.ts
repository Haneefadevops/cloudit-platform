export const sessionCookieName = process.env.NODE_ENV === "production"
  ? "__Host-operations_session"
  : "operations_session";

export type OperationsSession = {
  sub: "cloud-owner";
  email: string;
  role: "cloud_owner";
  iat: number;
  exp: number;
};

const encoder = new TextEncoder();

function toBase64Url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signature(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toBase64Url(new Uint8Array(signed));
}

export async function createSessionToken(email: string, secret: string, ttlSeconds: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const session: OperationsSession = { sub: "cloud-owner", email, role: "cloud_owner", iat: now, exp: now + ttlSeconds };
  const payload = toBase64Url(JSON.stringify(session));
  return `${payload}.${await signature(payload, secret)}`;
}

export async function verifySessionToken(token: string | undefined, secret: string | undefined): Promise<OperationsSession | null> {
  if (!token || !secret || secret.length < 32) return null;
  const [payload, providedSignature, extra] = token.split(".");
  if (!payload || !providedSignature || extra) return null;
  const expectedSignature = await signature(payload, secret);
  if (providedSignature.length !== expectedSignature.length) return null;
  let mismatch = 0;
  for (let index = 0; index < expectedSignature.length; index += 1) mismatch |= providedSignature.charCodeAt(index) ^ expectedSignature.charCodeAt(index);
  if (mismatch !== 0) return null;

  try {
    const session = JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as OperationsSession;
    if (session.sub !== "cloud-owner" || session.role !== "cloud_owner" || !session.email || !session.exp) return null;
    if (session.exp <= Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}
