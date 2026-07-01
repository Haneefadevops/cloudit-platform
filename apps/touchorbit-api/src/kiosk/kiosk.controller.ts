import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";

import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { KioskService } from "./kiosk.service";

@ApiTags("kiosk")
@Controller("kiosk")
@UseGuards(SessionAuthGuard)
export class KioskController {
  constructor(private readonly kioskService: KioskService) {}

  @Get()
  @ApiOperation({ summary: "List kiosk" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const rows = await this.kioskService.findAll(organizationId);
    return { ok: true, data: rows };
  }
}
