import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { z } from "zod";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";

import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { KioskService } from "./kiosk.service";

const stringOrRecordSchema = z.union([
  z.string(),
  z.record(z.string(), z.unknown()),
]);

const clockSchema = z
  .object({
    employeeId: z.string().uuid().optional(),
    employee_id: z.string().uuid().optional(),
    latitude: z.coerce.number().optional(),
    longitude: z.coerce.number().optional(),
    locationVerified: z.coerce.boolean().optional(),
    location_verified: z.coerce.boolean().optional(),
    selfieUrl: z.string().optional().nullable(),
    selfie_url: z.string().optional().nullable(),
    deviceInfo: stringOrRecordSchema.optional().nullable(),
    device_info: stringOrRecordSchema.optional().nullable(),
    notes: stringOrRecordSchema.optional().nullable(),
    gpsAccuracy: z.coerce.number().optional().nullable(),
    gps_accuracy: z.coerce.number().optional().nullable(),
    deviceFingerprint: z.record(z.string(), z.unknown()).optional().nullable(),
    device_fingerprint: z.record(z.string(), z.unknown()).optional().nullable(),
    timezoneOffset: z.coerce.number().int().optional().nullable(),
    timezone_offset: z.coerce.number().int().optional().nullable(),
    workType: z.enum(["office", "wfh", "field"]).optional(),
    work_type: z.enum(["office", "wfh", "field"]).optional(),
    branchId: z.string().uuid().optional().nullable(),
    branch_id: z.string().uuid().optional().nullable(),
  })
  .passthrough();

const statusQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  employee_id: z.string().uuid().optional(),
});

@ApiTags("kiosk")
@Controller("kiosk")
@UseGuards(SessionAuthGuard)
export class KioskController {
  constructor(private readonly kioskService: KioskService) {}

  @Get()
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "List kiosk" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const rows = await this.kioskService.findAll(organizationId);
    return { ok: true, data: rows };
  }

  @Post("clock-in")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Clock in from a kiosk" })
  async clockIn(
    @CurrentOrganization() organizationId: string,
    @Body() body: unknown,
  ) {
    const input = this.parseClockPayload(body);
    const row = await this.kioskService.clockIn(organizationId, input);
    return { ok: true, data: row };
  }

  @Post("clock-out")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Clock out from a kiosk" })
  async clockOut(
    @CurrentOrganization() organizationId: string,
    @Body() body: unknown,
  ) {
    const input = this.parseClockPayload(body);
    const row = await this.kioskService.clockOut(organizationId, input);
    return { ok: true, data: row };
  }

  @Get("status")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Get kiosk clock status" })
  async status(
    @CurrentOrganization() organizationId: string,
    @Query() query: unknown,
  ) {
    const parsed = statusQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException("Invalid status query");
    }

    const data = await this.kioskService.status(
      organizationId,
      parsed.data.employeeId ?? parsed.data.employee_id,
    );
    return { ok: true, data };
  }

  private parseClockPayload(body: unknown) {
    const parsed = clockSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid kiosk clock payload");
    }

    const employeeId = parsed.data.employeeId ?? parsed.data.employee_id;
    if (!employeeId) {
      throw new BadRequestException("employeeId is required");
    }

    return {
      employeeId,
      latitude: parsed.data.latitude,
      longitude: parsed.data.longitude,
      locationVerified:
        parsed.data.locationVerified ?? parsed.data.location_verified,
      selfieUrl: parsed.data.selfieUrl ?? parsed.data.selfie_url ?? null,
      deviceInfo: parsed.data.deviceInfo ?? parsed.data.device_info ?? null,
      notes: parsed.data.notes ?? null,
      gpsAccuracy: parsed.data.gpsAccuracy ?? parsed.data.gps_accuracy ?? null,
      deviceFingerprint:
        parsed.data.deviceFingerprint ?? parsed.data.device_fingerprint ?? null,
      timezoneOffset:
        parsed.data.timezoneOffset ?? parsed.data.timezone_offset ?? null,
      workType: parsed.data.workType ?? parsed.data.work_type ?? "office",
      branchId: parsed.data.branchId ?? parsed.data.branch_id ?? null,
    };
  }
}
