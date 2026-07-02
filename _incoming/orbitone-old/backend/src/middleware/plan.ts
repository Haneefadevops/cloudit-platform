import type { Plan, PlanLimit } from "../../../contracts/orbitone.v2.js";
import type { Request, Response, NextFunction } from "express";
import { getUser } from "./auth.js";

export const planLimits: Record<Plan, PlanLimit> = {
  free: {
    maxStaff: 1,
    maxBookingsPerWeek: 3,
    analyticsEnabled: false,
    crmEnabled: false,
    ratingsEnabled: false,
    customBrandingEnabled: false,
    maxCustomFields: 3,
    pipelinesEnabled: false,
    maxPipelines: 0,
    maxActivityTypes: 0,
    maxTemplates: 0,
    maxAutomationRules: 0,
    maxWebhooks: 0,
    bulkActionsEnabled: false
  },
  pro_individual: {
    maxStaff: 1,
    maxBookingsPerWeek: null,
    analyticsEnabled: true,
    crmEnabled: false,
    ratingsEnabled: false,
    customBrandingEnabled: true,
    maxCustomFields: 10,
    pipelinesEnabled: true,
    maxPipelines: 1,
    maxActivityTypes: 5,
    maxTemplates: 5,
    maxAutomationRules: 0,
    maxWebhooks: 0,
    bulkActionsEnabled: false
  },
  pro_business_starter: {
    maxStaff: 5,
    maxBookingsPerWeek: null,
    analyticsEnabled: true,
    crmEnabled: true,
    ratingsEnabled: true,
    customBrandingEnabled: true,
    maxCustomFields: null,
    pipelinesEnabled: true,
    maxPipelines: null,
    maxActivityTypes: null,
    maxTemplates: null,
    maxAutomationRules: 10,
    maxWebhooks: 3,
    bulkActionsEnabled: true
  },
  pro_business_growth: {
    maxStaff: 20,
    maxBookingsPerWeek: null,
    analyticsEnabled: true,
    crmEnabled: true,
    ratingsEnabled: true,
    customBrandingEnabled: true,
    maxCustomFields: null,
    pipelinesEnabled: true,
    maxPipelines: null,
    maxActivityTypes: null,
    maxTemplates: null,
    maxAutomationRules: 50,
    maxWebhooks: 10,
    bulkActionsEnabled: true
  },
  pro_business_enterprise: {
    maxStaff: null,
    maxBookingsPerWeek: null,
    analyticsEnabled: true,
    crmEnabled: true,
    ratingsEnabled: true,
    customBrandingEnabled: true,
    maxCustomFields: null,
    pipelinesEnabled: true,
    maxPipelines: null,
    maxActivityTypes: null,
    maxTemplates: null,
    maxAutomationRules: null,
    maxWebhooks: null,
    bulkActionsEnabled: true
  }
};

export function getPlanLimit(plan: Plan): PlanLimit {
  return planLimits[plan];
}

export function isCRMEnabled(plan: Plan): boolean {
  return getPlanLimit(plan).crmEnabled;
}

export function isRatingsEnabled(plan: Plan): boolean {
  return getPlanLimit(plan).ratingsEnabled;
}

export function isBookingLimitEnforced(plan: Plan): boolean {
  return getPlanLimit(plan).maxBookingsPerWeek !== null;
}

export function isAnalyticsEnabled(plan: Plan): boolean {
  return getPlanLimit(plan).analyticsEnabled;
}

export function getEffectivePlan(context: { organizationId: string | null; plan: string; organization?: { plan: string } | null }): Plan {
  if (context.organizationId && context.organization) {
    return isValidPlan(context.organization.plan) ? (context.organization.plan as Plan) : "free";
  }
  return isValidPlan(context.plan) ? (context.plan as Plan) : "free";
}

function isValidPlan(plan: string): boolean {
  return ["free", "pro_individual", "pro_business_starter", "pro_business_growth", "pro_business_enterprise"].includes(plan);
}

export function requireCRM(req: Request, res: Response, next: NextFunction) {
  const user = getUser(req);
  const plan = getEffectivePlan({
    organizationId: user.organizationId,
    plan: user.plan,
    organization: user.organization
  });
  if (!isCRMEnabled(plan)) {
    res.status(402).json({ ok: false, error: "CRM is available on Pro Business plans." });
    return;
  }
  next();
}

export function requireBusiness(req: Request, res: Response, next: NextFunction) {
  const user = getUser(req);
  const plan = getEffectivePlan({
    organizationId: user.organizationId,
    plan: user.plan,
    organization: user.organization
  });
  if (!user.organizationId || !plan.startsWith("pro_business")) {
    res.status(402).json({ ok: false, error: "Business accounts are available on Pro Business plans." });
    return;
  }
  next();
}

export function requireRatings(req: Request, res: Response, next: NextFunction) {
  const user = getUser(req);
  const plan = getEffectivePlan({
    organizationId: user.organizationId,
    plan: user.plan,
    organization: user.organization
  });
  if (!isRatingsEnabled(plan)) {
    res.status(402).json({ ok: false, error: "Ratings are available on Pro Business plans." });
    return;
  }
  next();
}
