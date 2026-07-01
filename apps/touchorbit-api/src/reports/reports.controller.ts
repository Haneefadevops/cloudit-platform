import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { ReportsService } from "./reports.service";

@ApiTags("reports")
@Controller("reports")
@UseGuards(SessionAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @RequireModule("touchorbit", "reports")
  @ApiOperation({ summary: "List reports" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const rows = await this.reportsService.findAll(organizationId);
    return { ok: true, data: rows };
  }
}
