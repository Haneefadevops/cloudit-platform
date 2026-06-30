import { Controller, Get, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { AnalyticsService } from "./analytics.service";
import { DatabaseService } from "../database/database.service";
import { AuthUser } from "../common/decorators/auth-user.decorator";
import { Public } from "../common/decorators/public.decorator";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireAnalyticsGuard } from "../common/guards/require-analytics.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { PlanService } from "../common/services/plan.service";
import type { AuthContext } from "../auth/types";

@Controller("v2/analytics")
@RequireModule("orbitone", "analytics")
@UseGuards(SessionAuthGuard)
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly databaseService: DatabaseService,
    private readonly planService: PlanService,
  ) {}

  @Post("events")
  @Public()
  track(@Res({ passthrough: true }) res: Response) {
    res.status(204);
    return;
  }

  @Get("me")
  @UseGuards(RequireAnalyticsGuard)
  async getMe(
    @AuthUser() user: AuthContext,
    @Res({ passthrough: true }) res: Response,
  ) {
    const profileResult = await this.databaseService.query(
      "SELECT id FROM profiles WHERE user_id = $1",
      [user.id],
    );
    const profileId = profileResult.rows[0]?.id as string | undefined;

    if (!profileId) {
      res.status(404);
      return { ok: false, error: "No profile found." };
    }

    const metrics = await this.analyticsService.getProfileMetrics(profileId);
    const usage = await this.analyticsService.getUsageSummary(
      profileId,
      this.planService.getPlanLimit(this.planService.getUserEffectivePlan(user))
        .maxBookingsPerWeek,
    );

    return {
      ok: true,
      data: {
        profileMetrics: metrics,
        usage,
      },
    };
  }
}
