import { Router } from "express";
import { pool } from "../../db/postgres.js";
import { getAuthUserWithOrg, signSession, setSessionCookie, revokeSessionByCookie } from "../../lib/auth.js";
import { mapUser, mapProfile, mapOrganization, buildAuthMe } from "../../lib/mappers.js";
import { registerSchema, loginSchema, acceptInviteSchema } from "./schemas.js";
import { registerUser, loginUser, AuthError } from "./service.js";
import { acceptInvite, OrganizationError } from "../organizations/service.js";

export const authRouter = Router();

authRouter.post("/register", async (req, res, next) => {
  const input = registerSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ ok: false, error: "Invalid registration details." });
    return;
  }

  try {
    const user = await registerUser(input.data, res);
    res.status(201).json({ ok: true, data: user });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  const input = loginSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ ok: false, error: "Invalid login details." });
    return;
  }

  try {
    const user = await loginUser(input.data, res);
    res.json({ ok: true, data: user });
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

authRouter.post("/accept-invite", async (req, res, next) => {
  try {
    const input = acceptInviteSchema.safeParse(req.body);
    if (!input.success) {
      res.status(400).json({ ok: false, error: "Invalid invite details." });
      return;
    }

    const user = await acceptInvite(input.data.token, input.data.password, input.data.fullName);
    setSessionCookie(res, await signSession(user));
    res.status(201).json({ ok: true, data: user });
  } catch (error) {
    if (error instanceof OrganizationError) {
      res.status((error as { statusCode?: number }).statusCode ?? 400).json({ ok: false, error: error.message });
      return;
    }
    if (error instanceof AuthError) {
      res.status(error.statusCode).json({ ok: false, error: error.message });
      return;
    }
    next(error);
  }
});

authRouter.post("/logout", async (req, res) => {
  await revokeSessionByCookie(req, res);
  res.json({ ok: true, data: { loggedOut: true } });
});

authRouter.get("/me", async (req, res, next) => {
  try {
    const auth = await getAuthUserWithOrg(req);
    if (!auth) {
      res.status(401).json({ ok: false, error: "Not authenticated." });
      return;
    }

    const [profileResult, orgResult] = await Promise.all([
      pool.query("SELECT * FROM profiles WHERE user_id = $1", [auth.id]),
      auth.organizationId
        ? pool.query("SELECT * FROM organizations WHERE id = $1", [auth.organizationId])
        : Promise.resolve({ rows: [] })
    ]);

    const profile = profileResult.rows[0] ? mapProfile(profileResult.rows[0]) : null;
    const organization = orgResult.rows[0] ? mapOrganization(orgResult.rows[0]) : null;

    res.json({
      ok: true,
      data: buildAuthMe({
        user: mapUser({
          id: auth.id,
          email: auth.email,
          full_name: auth.fullName,
          role: auth.role,
          organization_id: auth.organizationId,
          is_billing_contact: auth.isBillingContact,
          plan: auth.plan,
          created_at: auth.createdAt,
          updated_at: auth.updatedAt
        }),
        profile,
        organization
      })
    });
  } catch (error) {
    next(error);
  }
});
