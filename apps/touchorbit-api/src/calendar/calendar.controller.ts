import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { z } from "zod";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CalendarEventsService } from "./calendar.service";
import type { CalendarEventInput, HolidayInput } from "./calendar.service";

const dateRangeSchema = z.object({
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const daysSchema = z.coerce.number().int().min(1).max(90).default(30);
const limitSchema = z.coerce.number().int().min(1).max(100).default(10);

@ApiTags("calendar-events")
@Controller("calendar-events")
@UseGuards(SessionAuthGuard)
export class CalendarEventsController {
  constructor(private readonly calendarService: CalendarEventsService) {}

  @Get()
  @RequireModule("touchorbit", "calendar")
  @ApiOperation({ summary: "List calendar events" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const rows = await this.calendarService.findAll(organizationId);
    return { ok: true, data: rows };
  }

  @Get("unified")
  @RequireModule("touchorbit", "calendar")
  @ApiOperation({ summary: "Unified calendar feed" })
  async findUnified(
    @CurrentOrganization() organizationId: string,
    @CurrentUser("id") userId: string,
    @Query() query: { start?: string; end?: string },
  ) {
    const { start, end } = dateRangeSchema.parse(query);
    const rows = await this.calendarService.findUnified(
      organizationId,
      userId,
      start,
      end,
    );
    return { ok: true, data: rows };
  }

  @Get("upcoming")
  @RequireModule("touchorbit", "calendar")
  @ApiOperation({ summary: "Upcoming holidays and events" })
  async findUpcoming(
    @CurrentOrganization() organizationId: string,
    @Query("days") daysRaw?: string,
  ) {
    const days = daysSchema.parse(daysRaw ?? "30");
    const rows = await this.calendarService.findUpcoming(organizationId, days);
    return { ok: true, data: rows };
  }

  @Get("birthdays/upcoming")
  @RequireModule("touchorbit", "calendar")
  @ApiOperation({ summary: "Upcoming employee birthdays" })
  async findUpcomingBirthdays(
    @CurrentOrganization() organizationId: string,
    @CurrentUser("id") userId: string,
    @Query("limit") limitRaw?: string,
  ) {
    const limit = limitSchema.parse(limitRaw ?? "10");
    const rows = await this.calendarService.findUpcomingBirthdays(
      organizationId,
      userId,
      limit,
    );
    return { ok: true, data: rows };
  }

  @Get("hub")
  @RequireModule("touchorbit", "calendar")
  @ApiOperation({ summary: "Calendar hub data" })
  findHub(
    @CurrentOrganization() organizationId: string,
    @Query() query: { start?: string; end?: string },
  ) {
    const { start, end } = dateRangeSchema.parse({
      start: query.start,
      end: query.end,
    });
    const data = this.calendarService.findHub(organizationId, start, end);
    return { ok: true, data };
  }

  @Get("analytics")
  @RequireModule("touchorbit", "calendar")
  @ApiOperation({ summary: "Calendar analytics" })
  async findAnalytics(
    @CurrentOrganization() organizationId: string,
    @CurrentUser("id") userId: string,
    @Query()
    query: {
      startDate?: string;
      endDate?: string;
      start?: string;
      end?: string;
    },
  ) {
    const start = query.startDate || query.start;
    const end = query.endDate || query.end;
    const { start: parsedStart, end: parsedEnd } = dateRangeSchema.parse({
      start,
      end,
    });
    const data = await this.calendarService.findAnalytics(
      organizationId,
      userId,
      parsedStart,
      parsedEnd,
    );
    return { ok: true, data };
  }

  @Get("employee/:employeeId/events")
  @RequireModule("touchorbit", "calendar")
  @ApiOperation({ summary: "Employee-scoped calendar events" })
  async findEmployeeEvents(
    @Param("employeeId") employeeId: string,
    @CurrentUser("id") userId: string,
    @Query() query: { start?: string; end?: string },
  ) {
    const { start, end } = dateRangeSchema.parse(query);
    const rows = await this.calendarService.findEmployeeEvents(
      employeeId,
      userId,
      start,
      end,
    );
    return { ok: true, data: rows };
  }

  @Post()
  @RequireModule("touchorbit", "calendar")
  @ApiOperation({ summary: "Create a calendar event" })
  async create(
    @CurrentUser("id") userId: string,
    @Body() body: CalendarEventInput,
  ) {
    if (!body.title) throw new BadRequestException("title is required");
    if (!body.event_date)
      throw new BadRequestException("event_date is required");
    const result = await this.calendarService.createEvent(userId, body);
    return { ok: true, data: result };
  }

  @Get(":id")
  @RequireModule("touchorbit", "calendar")
  @ApiOperation({ summary: "Get a calendar event" })
  async findOne(
    @Param("id") id: string,
    @CurrentOrganization() organizationId: string,
  ) {
    const rows = await this.calendarService.findAll(organizationId);
    const row = rows.find((r: any) => r.id === id);
    if (!row) throw new BadRequestException("Event not found");
    return { ok: true, data: row };
  }

  @Patch(":id")
  @RequireModule("touchorbit", "calendar")
  @ApiOperation({ summary: "Update a calendar event" })
  async update(
    @Param("id") id: string,
    @CurrentUser("id") userId: string,
    @Body() body: Partial<CalendarEventInput>,
  ) {
    const result = await this.calendarService.updateEvent(id, userId, body);
    return { ok: true, data: result };
  }

  @Delete(":id")
  @RequireModule("touchorbit", "calendar")
  @ApiOperation({ summary: "Delete a calendar event" })
  async delete(@Param("id") id: string, @CurrentUser("id") userId: string) {
    const result = await this.calendarService.deleteEvent(id, userId);
    return { ok: true, data: result };
  }

  @Post(":id/duplicate")
  @RequireModule("touchorbit", "calendar")
  @ApiOperation({ summary: "Duplicate a calendar event for tomorrow" })
  async duplicate(@Param("id") id: string, @CurrentUser("id") userId: string) {
    const result = await this.calendarService.duplicateEvent(id, userId);
    return { ok: true, data: result };
  }

  @Patch(":id/reschedule")
  @RequireModule("touchorbit", "calendar")
  @ApiOperation({ summary: "Mark event as rescheduled" })
  async reschedule(
    @Param("id") id: string,
    @CurrentUser("id") userId: string,
    @Body() body: { reason?: string },
  ) {
    const result = await this.calendarService.rescheduleEvent(
      id,
      userId,
      body?.reason,
    );
    return { ok: true, data: result };
  }
}

@ApiTags("holidays")
@Controller("holidays")
@UseGuards(SessionAuthGuard)
export class HolidaysController {
  constructor(private readonly calendarService: CalendarEventsService) {}

  @Get()
  @RequireModule("touchorbit", "calendar")
  @ApiOperation({ summary: "List holidays" })
  async findAll(
    @CurrentOrganization() organizationId: string,
    @Query() query: { start?: string; end?: string },
  ) {
    const rows = await this.calendarService.findHolidays(
      organizationId,
      query.start,
      query.end,
    );
    return { ok: true, data: rows };
  }

  @Post()
  @RequireModule("touchorbit", "calendar")
  @ApiOperation({ summary: "Create a holiday" })
  async create(
    @CurrentOrganization() organizationId: string,
    @Body() body: HolidayInput,
  ) {
    if (!body.name || !body.date || !body.type) {
      throw new BadRequestException("name, date and type are required");
    }
    const row = await this.calendarService.createHoliday(organizationId, body);
    return { ok: true, data: row };
  }

  @Patch(":id")
  @RequireModule("touchorbit", "calendar")
  @ApiOperation({ summary: "Update a holiday" })
  async update(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Body() body: Partial<HolidayInput>,
  ) {
    const row = await this.calendarService.updateHoliday(
      organizationId,
      id,
      body,
    );
    return { ok: true, data: row };
  }

  @Delete(":id")
  @RequireModule("touchorbit", "calendar")
  @ApiOperation({ summary: "Delete a holiday" })
  async delete(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const result = await this.calendarService.deleteHoliday(organizationId, id);
    return { ok: true, data: result };
  }

  @Post("import-sri-lankan-2026")
  @RequireModule("touchorbit", "calendar")
  @ApiOperation({ summary: "Import Sri Lankan public holidays for 2026" })
  async importHolidays(
    @CurrentOrganization() organizationId: string,
    @CurrentUser("id") userId: string,
  ) {
    const result = await this.calendarService.importSriLankanHolidays2026(
      organizationId,
      userId,
    );
    return { ok: true, data: result };
  }
}
