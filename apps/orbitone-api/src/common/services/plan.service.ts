import { Injectable } from "@nestjs/common";
import { Plan, PlanLimit } from "../contracts/orbitone.v2";
import { AuthContext } from "../../auth/types";

const planLimits: Record<Plan, PlanLimit> = {
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
    bulkActionsEnabled: false,
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
    bulkActionsEnabled: false,
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
    bulkActionsEnabled: true,
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
    bulkActionsEnabled: true,
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
    bulkActionsEnabled: true,
  },
};

function isValidPlan(plan: string): plan is Plan {
  return Object.prototype.hasOwnProperty.call(planLimits, plan);
}

@Injectable()
export class PlanService {
  getPlanLimit(plan: Plan): PlanLimit {
    return planLimits[plan];
  }

  getEffectivePlan(context: {
    organizationId: string | null;
    plan: string;
    organization?: { plan: string } | null;
  }): Plan {
    if (context.organizationId && context.organization) {
      return isValidPlan(context.organization.plan)
        ? context.organization.plan
        : "free";
    }
    return isValidPlan(context.plan) ? context.plan : "free";
  }

  isCRMEnabled(plan: Plan): boolean {
    return this.getPlanLimit(plan).crmEnabled;
  }

  isRatingsEnabled(plan: Plan): boolean {
    return this.getPlanLimit(plan).ratingsEnabled;
  }

  isAnalyticsEnabled(plan: Plan): boolean {
    return this.getPlanLimit(plan).analyticsEnabled;
  }

  isBusinessPlan(plan: Plan): boolean {
    return plan.startsWith("pro_business");
  }

  getUserEffectivePlan(user: AuthContext): Plan {
    return this.getEffectivePlan({
      organizationId: user.organizationId,
      plan: user.plan,
      organization: user.organization,
    });
  }
}
