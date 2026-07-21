import { Body, Controller, Delete, Get, Patch, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { DashboardService } from "./dashboard.service";

@ApiTags("dashboard")
@Controller("dashboard")
@UseGuards(SessionAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: "List dashboard" })
  findAll(@CurrentOrganization() organizationId: string) {
    const rows = this.dashboardService.findAll(organizationId);
    return { ok: true, data: rows };
  }

  @Get("summary")
  @ApiOperation({ summary: "Get dashboard summary" })
  async summary(@CurrentOrganization() organizationId: string) {
    const data = await this.dashboardService.summary(organizationId);
    return { ok: true, data };
  }

  @Get("widgets")
  @ApiOperation({ summary: "Get dashboard widgets" })
  async widgets(@CurrentOrganization() organizationId: string) {
    const data = await this.dashboardService.widgets(organizationId);
    return { ok: true, data };
  }

  @Get("activities")
  @ApiOperation({ summary: "Get dashboard activities" })
  async activities(@CurrentOrganization() organizationId: string) {
    const data = await this.dashboardService.activities(organizationId);
    return { ok: true, data };
  }

  @Get("layout")
  async layout(@CurrentOrganization() organizationId: string, @CurrentUser("id") userId: string) {
    return { ok: true, data: await this.dashboardService.getLayout(organizationId, userId) };
  }

  @Patch("layout")
  async saveLayout(
    @CurrentOrganization() organizationId: string,
    @CurrentUser("id") userId: string,
    @Body() body: any,
  ) {
    return { ok: true, data: await this.dashboardService.saveLayout(organizationId, userId, body) };
  }

  @Delete("layout")
  async resetLayout(@CurrentOrganization() organizationId: string, @CurrentUser("id") userId: string) {
    return { ok: true, data: await this.dashboardService.resetLayout(organizationId, userId) };
  }
}
