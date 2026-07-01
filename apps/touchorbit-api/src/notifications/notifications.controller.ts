import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@Controller("notifications")
@UseGuards(SessionAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @RequireModule("touchorbit", "notifications")
  @ApiOperation({ summary: "List notifications" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const rows = await this.notificationsService.findAll(organizationId);
    return { ok: true, data: rows };
  }
}
