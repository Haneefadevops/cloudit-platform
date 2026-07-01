import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { AssetsService } from "./assets.service";

@ApiTags("assets")
@Controller("assets")
@UseGuards(SessionAuthGuard)
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @RequireModule("touchorbit", "assets")
  @ApiOperation({ summary: "List assets" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const rows = await this.assetsService.findAll(organizationId);
    return { ok: true, data: rows };
  }
}
