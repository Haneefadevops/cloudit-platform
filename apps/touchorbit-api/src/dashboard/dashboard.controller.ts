import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { DashboardService } from "./dashboard.service";

@ApiTags("dashboard")
@Controller("dashboard")
@UseGuards(SessionAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @RequireModule("touchorbit", "dashboard")
  @ApiOperation({ summary: "List dashboard" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const rows = await this.dashboardService.findAll(organizationId);
    return { ok: true, data: rows };
  }
}
