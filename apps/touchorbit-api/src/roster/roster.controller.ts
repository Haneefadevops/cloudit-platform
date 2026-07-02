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
import { RosterService } from "./roster.service";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const weekQuerySchema = z.object({
  week_start: dateSchema,
});

const assignmentSchema = z.object({
  employee_id: z.string().uuid(),
  shift_id: z.string().uuid(),
  assignment_date: dateSchema,
  role: z.string().optional(),
});

const copyWeekSchema = z.object({
  source_week_start: dateSchema,
  target_week_start: dateSchema,
});

const weekActionSchema = z.object({
  week_start: dateSchema,
});

const toggleShiftStatusSchema = z.object({
  status: z.enum(["active", "inactive"]).optional(),
});

const noShowQuerySchema = z.object({
  date: dateSchema.optional(),
});

@ApiTags("roster")
@Controller("roster")
@UseGuards(SessionAuthGuard)
export class RosterController {
  constructor(private readonly rosterService: RosterService) {}

  @Get("week")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Get roster assignments for a week" })
  async getWeek(
    @CurrentOrganization() organizationId: string,
    @Query() query: unknown,
  ) {
    const parsed = weekQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException("Invalid week_start");
    }
    const rows = await this.rosterService.getWeek(
      organizationId,
      parsed.data.week_start,
    );
    return { ok: true, data: rows };
  }

  @Get("week-status")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Get roster week status" })
  async getWeekStatus(
    @CurrentOrganization() organizationId: string,
    @Query() query: unknown,
  ) {
    const parsed = weekQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException("Invalid week_start");
    }
    const row = await this.rosterService.getWeekStatus(
      organizationId,
      parsed.data.week_start,
    );
    return { ok: true, data: row };
  }

  @Post("assignments")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Create or update a roster assignment" })
  async upsertAssignment(
    @CurrentOrganization() organizationId: string,
    @Body() body: unknown,
  ) {
    const parsed = assignmentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid assignment payload");
    }
    const row = await this.rosterService.upsertAssignment(organizationId, {
      employeeId: parsed.data.employee_id,
      shiftId: parsed.data.shift_id,
      assignmentDate: parsed.data.assignment_date,
      role: parsed.data.role,
    });
    return { ok: true, data: row };
  }

  @Delete("assignments/:id")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Delete a roster assignment" })
  async deleteAssignment(
    @CurrentOrganization() organizationId: string,
    @Param("id") assignmentId: string,
  ) {
    const result = await this.rosterService.deleteAssignment(
      organizationId,
      assignmentId,
    );
    return { ok: true, data: result };
  }

  @Post("copy-week")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Copy one roster week to another" })
  async copyWeek(
    @CurrentOrganization() organizationId: string,
    @Body() body: unknown,
  ) {
    const parsed = copyWeekSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid copy-week payload");
    }
    const result = await this.rosterService.copyWeek(
      organizationId,
      parsed.data.source_week_start,
      parsed.data.target_week_start,
    );
    return { ok: true, data: result };
  }

  @Post("publish")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Publish roster week" })
  async publishWeek(
    @CurrentOrganization() organizationId: string,
    @CurrentUser("id") userId: string,
    @Body() body: unknown,
  ) {
    const parsed = weekActionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid week_start");
    }
    const row = await this.rosterService.publishWeek(
      organizationId,
      parsed.data.week_start,
      userId,
    );
    return { ok: true, data: row };
  }

  @Post("lock")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Lock roster week" })
  async lockWeek(
    @CurrentOrganization() organizationId: string,
    @CurrentUser("id") userId: string,
    @Body() body: unknown,
  ) {
    const parsed = weekActionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid week_start");
    }
    const row = await this.rosterService.lockWeek(
      organizationId,
      parsed.data.week_start,
      userId,
    );
    return { ok: true, data: row };
  }

  @Post("week/unlock")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Unlock roster week" })
  async unlockWeek(
    @CurrentOrganization() organizationId: string,
    @CurrentUser("id") userId: string,
    @Body() body: unknown,
  ) {
    const parsed = weekActionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid week_start");
    }
    const row = await this.rosterService.unlockWeek(
      organizationId,
      parsed.data.week_start,
      userId,
    );
    return { ok: true, data: row };
  }

  @Patch("shifts/:id/toggle-status")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Toggle shift active status" })
  async toggleShiftStatus(
    @CurrentOrganization() organizationId: string,
    @Param("id") shiftId: string,
    @Body() body: unknown,
  ) {
    const parsed = toggleShiftStatusSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException("Invalid shift status payload");
    }
    const row = await this.rosterService.toggleShiftStatus(
      organizationId,
      shiftId,
      parsed.data.status,
    );
    return { ok: true, data: row };
  }

  @Get("no-shows")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "List today's no-shows" })
  async getNoShows(
    @CurrentOrganization() organizationId: string,
    @Query() query: unknown,
  ) {
    const parsed = noShowQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException("Invalid date");
    }
    const rows = await this.rosterService.getNoShows(
      organizationId,
      parsed.data.date,
    );
    return { ok: true, data: rows };
  }

  @Get("adherence")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Get shift adherence summary for a week" })
  async getAdherence(
    @CurrentOrganization() organizationId: string,
    @Query() query: unknown,
  ) {
    const parsed = weekQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException("Invalid week_start");
    }
    const rows = await this.rosterService.getAdherence(
      organizationId,
      parsed.data.week_start,
    );
    return { ok: true, data: rows };
  }

  @Post("preview-conflicts")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Preview roster conflicts for a week" })
  async previewConflicts(
    @CurrentOrganization() organizationId: string,
    @Body() body: unknown,
  ) {
    const parsed = weekActionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid week_start");
    }
    const rows = await this.rosterService.previewConflicts(
      organizationId,
      parsed.data.week_start,
    );
    return { ok: true, data: rows };
  }

  @Post("auto-fill")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Auto-fill empty roster slots for a week" })
  async autoFill(
    @CurrentOrganization() organizationId: string,
    @Body() body: unknown,
  ) {
    const parsed = weekActionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid week_start");
    }
    const result = await this.rosterService.autoFill(
      organizationId,
      parsed.data.week_start,
    );
    return { ok: true, data: result };
  }
}
