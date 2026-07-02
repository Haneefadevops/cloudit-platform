import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";

import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { MeService } from "./me.service";

@ApiTags("me")
@Controller("me")
@UseGuards(SessionAuthGuard)
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  @ApiOperation({ summary: "List me" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const rows = await this.meService.findAll(organizationId);
    return { ok: true, data: rows };
  }
}
