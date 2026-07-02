import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { OvertimeService } from "./overtime.service";

@ApiTags("overtime")
@Controller("overtime")
@UseGuards(SessionAuthGuard)
export class OvertimeController {
  constructor(private readonly overtimeService: OvertimeService) {}

  @Get()
  @RequireModule("touchorbit", "overtime")
  @ApiOperation({ summary: "List overtime" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const rows = await this.overtimeService.findAll(organizationId);
    return { ok: true, data: rows };
  }
}
