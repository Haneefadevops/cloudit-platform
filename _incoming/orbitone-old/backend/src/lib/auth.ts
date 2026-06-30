import crypto from "node:crypto";
import type { Response, Request } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { pool } from "../db/postgres.js";
import { redis } from "../db/redis.js";

export const authCookieName = "orbitone_session";
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

type SessionUser = {
  id: string;
  email: string;
  fullName: string;
};

export type AuthUser = SessionUser;

type JwtPayload = {
  sub: string;
  email: string;
  sid: string;
};

export function getCookie(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function sessionKey(sid: string) {
  return `session:${sid}`;
}

function userSessionsKey(userId: string) {
  return `user_sessions:${userId}`;
}

export async function signSession(user: AuthUser) {
  const sid = crypto.randomUUID();
  const token = jwt.sign({ sub: user.id, email: user.email, sid }, env.JWT_SECRET, {
    expiresIn: "7d"
  });

  const pipeline = redis.pipeline();
  pipeline.set(sessionKey(sid), JSON.stringify(user), "EX", SESSION_TTL_SECONDS);
  pipeline.sadd(userSessionsKey(user.id), sid);
  pipeline.expire(userSessionsKey(user.id), SESSION_TTL_SECONDS);
  await pipeline.exec();

  return token;
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(authCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: "/"
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(authCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/"
  });
}

export async function revokeSessionByCookie(req: Request, res: Response) {
  const token = getCookie(req.headers.cookie, authCookieName);
  if (token) {
    try {
      const payload = jwt.decode(token) as JwtPayload | null;
      if (payload?.sid) {
        const sid = payload.sid;
        const userId = payload.sub;
        const pipeline = redis.pipeline();
        pipeline.del(sessionKey(sid));
        pipeline.srem(userSessionsKey(userId), sid);
        await pipeline.exec();
      }
    } catch {
      // Ignore decode errors during revocation.
    }
  }
  clearSessionCookie(res);
}

export async function getAuthUser(req: Request): Promise<AuthUser | null> {
  const token = getCookie(req.headers.cookie, authCookieName);
  if (!token) return null;

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const sessionData = await redis.get(sessionKey(payload.sid));
    if (!sessionData) return null;

    const user = JSON.parse(sessionData) as SessionUser;

    // Keep session alive while active.
    await redis.expire(sessionKey(payload.sid), SESSION_TTL_SECONDS);

    return user;
  } catch {
    return null;
  }
}

export async function getAuthUserWithOrg(req: Request) {
  const user = await getAuthUser(req);
  if (!user) return null;

  const result = await pool.query(
    `SELECT
       u.id, u.email, u.full_name, u.role, u.organization_id, u.is_billing_contact, u.plan,
       u.created_at, u.updated_at,
       o.id AS org_id, o.slug AS org_slug, o.name AS org_name, o.plan AS org_plan,
       o.plan_status AS org_plan_status, o.trial_ends_at AS org_trial_ends_at
     FROM users u
     LEFT JOIN organizations o ON o.id = u.organization_id
     WHERE u.id = $1`,
    [user.id]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    organizationId: row.organization_id,
    isBillingContact: row.is_billing_contact,
    plan: row.plan,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    organization: row.org_id
      ? {
          id: row.org_id,
          slug: row.org_slug,
          name: row.org_name,
          plan: row.org_plan,
          planStatus: row.org_plan_status,
          trialEndsAt: row.org_trial_ends_at
        }
      : null
  };
}

export type AuthContext = NonNullable<Awaited<ReturnType<typeof getAuthUserWithOrg>>>;
