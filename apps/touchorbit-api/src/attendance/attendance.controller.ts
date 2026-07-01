import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { z } from "zod";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { AuthUser } from "../common/decorators/auth-user.decorator";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { AttendanceService } from "./attendance.service";

const listClockEventsQuerySchema = z.object({
  employee_id: z.string().uuid().optional(),
  event_type: z.enum(["clock_in", "clock_out"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

const clockEventSchema = z.object({
  employeeId: z.string().uuid(),
  eventType: z.enum(["clock_in", "clock_out"]),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  selfieUrl: z.string().optional(),
  deviceInfo: z.string().optional(),
  notes: z.string().optional(),
});

const verifyIpSchema = z.object({
  claimedLat: z.number(),
  claimedLng: z.number(),
});

const reviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewNotes: z.string().optional(),
});

const breakEventSchema = z.object({
  employeeId: z.string().uuid(),
  clockEventId: z.string().uuid().optional(),
  breakStart: z.string().optional(),
  breakEnd: z.string().optional(),
  breakType: z.string().optional(),
  durationMinutes: z.coerce.number().int().optional(),
});

const correctionSchema = z.object({
  employeeId: z.string().uuid(),
  originalEventId: z.string().uuid().optional(),
  correctionType: z.string().min(1),
  requestedTime: z.string().min(1),
  reason: z.string().min(1),
});

const geofenceSchema = z.object({
  name: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  radiusMeters: z.coerce.number().int().optional(),
  status: z.string().optional(),
});

const updateGeofenceSchema = z.object({
  name: z.string().min(1).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  radiusMeters: z.coerce.number().int().optional(),
  status: z.string().optional(),
});

@ApiTags("attendance")
@Controller("attendance")
@UseGuards(SessionAuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get()
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "List clock events" })
  async findAll(
    @CurrentOrganization() organizationId: string,
    @Query() query: unknown,
  ) {
    const parsed = listClockEventsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException("Invalid query parameters");
    }

    const rows = await this.attendanceService.findAll(organizationId, {
      employeeId: parsed.data.employee_id,
      eventType: parsed.data.event_type,
      from: parsed.data.from,
      to: parsed.data.to,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });

    return { ok: true, data: rows };
  }

  @Post("clock-events")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Record a clock-in or clock-out event" })
  async createClockEvent(
    @CurrentOrganization() organizationId: string,
    @Body() body: unknown,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const parsed = clockEventSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid clock event");
    }

    const clientIp = this.attendanceService.getClientIp(headers);
    const row = await this.attendanceService.createClockEvent({
      organizationId,
      clientIp,
      ...parsed.data,
    });
    return { ok: true, data: row };
  }

  @Get("clock-events/:id")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Get a single clock event" })
  async getClockEvent(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const row = await this.attendanceService.getClockEvent(organizationId, id);
    return { ok: true, data: row };
  }

  @Post("clock-events/:id/review")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Review a clock event" })
  async reviewClockEvent(
    @CurrentOrganization() organizationId: string,
    @AuthUser("id") reviewedBy: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid review payload");
    }

    const row = await this.attendanceService.reviewClockEvent(
      organizationId,
      id,
      reviewedBy,
      parsed.data.status,
      parsed.data.reviewNotes,
    );

    return { ok: true, data: row };
  }

  @Post("clock-events/:id/verify-ip")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({
    summary: "Verify clock event location against IP geolocation",
  })
  async verifyIp(
    @Param("id") eventId: string,
    @Body() body: unknown,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const parsed = verifyIpSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid verification payload");
    }
    const clientIp = this.attendanceService.getClientIp(headers);
    const result = await this.attendanceService.verifyIp(
      eventId,
      parsed.data.claimedLat,
      parsed.data.claimedLng,
      clientIp,
    );
    return { ok: true, data: result };
  }

  @Get("break-events")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "List break events" })
  async findBreakEvents(@CurrentOrganization() organizationId: string) {
    const rows = await this.attendanceService.findBreakEvents(organizationId);
    return { ok: true, data: rows };
  }

  @Post("break-events")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Record a break event" })
  async createBreakEvent(
    @CurrentOrganization() organizationId: string,
    @Body() body: unknown,
  ) {
    const parsed = breakEventSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid break event");
    }

    const row = await this.attendanceService.createBreakEvent(
      organizationId,
      parsed.data,
    );
    return { ok: true, data: row };
  }

  @Get("corrections")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "List attendance corrections" })
  async findCorrections(@CurrentOrganization() organizationId: string) {
    const rows = await this.attendanceService.findCorrections(organizationId);
    return { ok: true, data: rows };
  }

  @Post("corrections")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Create an attendance correction request" })
  async createCorrection(
    @CurrentOrganization() organizationId: string,
    @Body() body: unknown,
  ) {
    const parsed = correctionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid correction payload");
    }

    const row = await this.attendanceService.createCorrection(
      organizationId,
      parsed.data,
    );
    return { ok: true, data: row };
  }

  @Get("geofences")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "List geofences" })
  async findGeofences(@CurrentOrganization() organizationId: string) {
    const rows = await this.attendanceService.findGeofences(organizationId);
    return { ok: true, data: rows };
  }

  @Post("geofences")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Create a geofence" })
  async createGeofence(
    @CurrentOrganization() organizationId: string,
    @Body() body: unknown,
  ) {
    const parsed = geofenceSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid geofence payload");
    }

    const row = await this.attendanceService.createGeofence(
      organizationId,
      parsed.data,
    );
    return { ok: true, data: row };
  }

  @Patch("geofences/:id")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Update a geofence" })
  async updateGeofence(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateGeofenceSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid geofence payload");
    }

    const row = await this.attendanceService.updateGeofence(
      organizationId,
      id,
      parsed.data,
    );
    return { ok: true, data: row };
  }

  @Delete("geofences/:id")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Delete a geofence" })
  async deleteGeofence(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const result = await this.attendanceService.deleteGeofence(
      organizationId,
      id,
    );
    return { ok: true, data: result };
  }
}
