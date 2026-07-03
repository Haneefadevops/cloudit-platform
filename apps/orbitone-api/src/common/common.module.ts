import { Global, Module } from "@nestjs/common";
import { PlanService } from "./services/plan.service";
import { RequireAdminOrBillingGuard } from "./guards/require-admin-or-billing.guard";
import { RequireOrgMemberGuard } from "./guards/require-org-member.guard";
import { RequireCRMGuard } from "./guards/require-crm.guard";
import { RequireBusinessGuard } from "./guards/require-business.guard";
import { RequireRatingsGuard } from "./guards/require-ratings.guard";
import { RequireAnalyticsGuard } from "./guards/require-analytics.guard";

@Global()
@Module({
  providers: [
    PlanService,
    RequireAdminOrBillingGuard,
    RequireOrgMemberGuard,
    RequireCRMGuard,
    RequireBusinessGuard,
    RequireRatingsGuard,
    RequireAnalyticsGuard,
  ],
  exports: [
    PlanService,
    RequireAdminOrBillingGuard,
    RequireOrgMemberGuard,
    RequireCRMGuard,
    RequireBusinessGuard,
    RequireRatingsGuard,
    RequireAnalyticsGuard,
  ],
})
export class CommonModule {}
