import {
  BadRequestException,
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { OrganizationsService } from "./organizations.service";
import { z } from "zod";

const updateSettingsSchema = z.object({
  name: z.string().optional(),
  timezone: z.string().optional(),
  work_hours_start: z.string().optional(),
  work_hours_end: z.string().optional(),
  grace_period_minutes: z.number().optional(),
  require_selfie: z.boolean().optional(),
  require_geofence: z.boolean().optional(),
  late_threshold_minutes: z.number().optional(),
  annual_leave_days: z.number().optional(),
  casual_leave_days: z.number().optional(),
  sick_leave_days: z.number().optional(),
  expected_timezone_offset: z.number().nullable().optional(),
  timezone_tolerance_minutes: z.number().optional(),
  strict_location_mode: z.boolean().optional(),
  carry_forward_enabled: z.boolean().optional(),
  carry_forward_limit: z.number().optional(),
  encashment_allowed: z.boolean().optional(),
  encashment_max_days: z.number().optional(),
  comp_off_expiry_months: z.number().optional(),
  overtimePolicy: z
    .object({
      max_daily_hours: z.number().optional(),
      max_weekly_hours: z.number().optional(),
      weekday_rate: z.number().optional(),
      weekend_rate: z.number().optional(),
      holiday_rate: z.number().optional(),
      requires_approval: z.boolean().optional(),
      auto_detect: z.boolean().optional(),
    })
    .optional(),
});

@ApiTags("organizations")
@Controller("organizations")
@UseGuards(SessionAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  @RequireModule("touchorbit", "organizations")
  @ApiOperation({ summary: "List organizations" })
  findAll(@CurrentOrganization() organizationId: string) {
    const rows = this.organizationsService.findAll(organizationId);
    return { ok: true, data: rows };
  }

  @Get("branches")
  @RequireModule("touchorbit", "organizations")
  @ApiOperation({ summary: "List branches for the current organization" })
  async findBranches(@CurrentOrganization() organizationId: string) {
    const rows = await this.organizationsService.findBranches(organizationId);
    return { ok: true, data: rows };
  }

  @Get("departments")
  @RequireModule("touchorbit", "organizations")
  @ApiOperation({ summary: "List departments for the current organization" })
  async findDepartments(@CurrentOrganization() organizationId: string) {
    const rows =
      await this.organizationsService.findDepartments(organizationId);
    return { ok: true, data: rows };
  }

  @Get("settings")
  @RequireModule("touchorbit", "organizations")
  @ApiOperation({ summary: "Get organization settings and overtime policy" })
  async getSettings(@CurrentOrganization() organizationId: string) {
    const data = await this.organizationsService.findSettings(organizationId);
    return { ok: true, data };
  }

  @Patch("settings")
  @RequireModule("touchorbit", "organizations")
  @ApiOperation({ summary: "Update organization settings and overtime policy" })
  async updateSettings(
    @CurrentOrganization() organizationId: string,
    @Body() body: unknown,
  ) {
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid settings payload");
    }
    await this.organizationsService.updateSettings(organizationId, parsed.data);
    return { ok: true, data: { updated: true } };
  }
}
