import "server-only";

export type OperationsRuntimeConfig = {
  publicOrigin: string;
  ownerEmail: string;
  passwordHash: string;
  sessionSecret: string;
  sessionTtlSeconds: number;
  mfaRequired: boolean;
  totpSecret: string | null;
};

const placeholders = /replace-with|example\.com/i;

export function getOperationsRuntimeConfig(): OperationsRuntimeConfig {
  const publicOrigin = process.env.OPERATIONS_PUBLIC_ORIGIN?.trim().replace(/\/$/, "") ?? "";
  const ownerEmail = process.env.OPERATIONS_OWNER_EMAIL?.trim().toLowerCase() ?? "";
  const passwordHash = process.env.OPERATIONS_OWNER_PASSWORD_HASH?.trim() ?? "";
  const sessionSecret = process.env.OPERATIONS_SESSION_SECRET ?? "";
  const sessionTtlSeconds = Number(process.env.OPERATIONS_SESSION_TTL_SECONDS ?? "28800");
  const mfaRequired = process.env.OPERATIONS_MFA_REQUIRED !== "false";
  const totpSecret = process.env.OPERATIONS_OWNER_TOTP_SECRET?.replace(/\s+/g, "").toUpperCase() || null;

  const errors: string[] = [];
  try {
    const url = new URL(publicOrigin);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.pathname !== "/" || url.search || url.hash || (url.protocol !== "https:" && !local)) errors.push("public origin");
  } catch { errors.push("public origin"); }
  if (!ownerEmail || !ownerEmail.includes("@") || placeholders.test(ownerEmail)) errors.push("owner email");
  if (!/^scrypt\.[0-9a-f]{32,}\.[0-9a-f]{128}$/i.test(passwordHash)) errors.push("password hash");
  if (sessionSecret.length < 32 || placeholders.test(sessionSecret)) errors.push("session secret");
  if (!Number.isInteger(sessionTtlSeconds) || sessionTtlSeconds < 900 || sessionTtlSeconds > 43200) errors.push("session TTL");
  if (mfaRequired && (!totpSecret || !/^[A-Z2-7]{16,}$/.test(totpSecret))) errors.push("TOTP secret");

  if (errors.length > 0) {
    throw new Error(`Operations runtime configuration is invalid: ${errors.join(", ")}`);
  }

  return { publicOrigin, ownerEmail, passwordHash, sessionSecret, sessionTtlSeconds, mfaRequired, totpSecret };
}
