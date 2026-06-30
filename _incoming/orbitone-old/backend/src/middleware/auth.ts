import type { Request, Response, NextFunction } from "express";
import { getAuthUserWithOrg, type AuthContext } from "../lib/auth.js";

export type AuthenticatedRequest = Request & { user: AuthContext };

export function fail(error: string) {
  return { ok: false, error };
}

export async function requireUser(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = await getAuthUserWithOrg(req);
  if (!user) {
    res.status(401).json(fail("Authentication required."));
    return;
  }
  (req as AuthenticatedRequest).user = user;
  next();
}

export function getUser(req: Request): AuthContext {
  return (req as unknown as AuthenticatedRequest).user;
}

export function requireRole(...allowedRoles: Array<AuthContext["role"]>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = getUser(req);
    if (!allowedRoles.includes(user.role)) {
      res.status(403).json(fail("You do not have permission to do that."));
      return;
    }
    next();
  };
}

export function requireAdminOrBilling(req: Request, res: Response, next: NextFunction) {
  const user = getUser(req);
  if (user.role !== "admin" && !user.isBillingContact) {
    res.status(403).json(fail("Admin or billing contact required."));
    return;
  }
  next();
}

export function requireOrgMember(req: Request, res: Response, next: NextFunction) {
  const user = getUser(req);
  if (!user.organizationId) {
    res.status(403).json(fail("Organization membership required."));
    return;
  }
  next();
}
