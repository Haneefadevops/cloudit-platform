import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { CalendarEventsService } from "./calendar.service";

@ApiTags("calendar-events")
@Controller("calendar-events")
@UseGuards(SessionAuthGuard)
export class CalendarEventsController {
  constructor(private readonly calendarService: CalendarEventsService) {}

  @Get()
  @RequireModule("touchorbit", "calendar")
  @ApiOperation({ summary: "List calendar-events" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const rows = await this.calendarService.findAll(organizationId);
    return { ok: true, data: rows };
  }
}
