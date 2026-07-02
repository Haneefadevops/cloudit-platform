import { Controller, Get, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { DashboardService } from "./dashboard.service";
import { AuthUser } from "../common/decorators/auth-user.decorator";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import type { AuthContext } from "../auth/types";

@Controller("v2/dashboard")
@UseGuards(SessionAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  async getSummary(
    @AuthUser() user: AuthContext,
    @Res({ passthrough: true }) _res: Response,
  ) {
    const summary = await this.dashboardService.getDashboardSummary(user);
    return { ok: true, data: summary };
  }
}
