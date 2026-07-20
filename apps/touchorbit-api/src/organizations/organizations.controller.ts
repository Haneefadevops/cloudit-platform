import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Body,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
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

const structureSchema = z.object({
  name: z.string().trim().min(1),
  code: z.string().trim().nullable().optional(),
  city: z.string().trim().nullable().optional(),
  address: z.string().trim().nullable().optional(),
  branch_id: z.string().uuid().nullable().optional(),
});

const approvalConfigSchema = z.object({
  auto_approve_below_days: z.number().optional(),
  level1_min_days: z.number().optional(),
  level2_min_days: z.number().optional(),
  level3_min_days: z.number().optional(),
  auto_approve_below_hours: z.number().optional(),
  level1_min_hours: z.number().optional(),
  level2_min_hours: z.number().optional(),
  level3_min_hours: z.number().optional(),
  auto_approve_below: z.number().optional(),
  level1_min_amount: z.number().optional(),
  level2_min_amount: z.number().optional(),
  level3_min_amount: z.number().optional(),
  parallel_approval: z.boolean().optional(),
  skip_if_no_manager: z.boolean().optional(),
});

const systemRoleSchema = z.object({
  system_role: z.enum(["owner", "super_admin", "admin", "manager", "employee"]),
});
const permissionGroupSchema = z.object({ name: z.string().trim().min(1), description: z.string().trim().nullable().optional() });
const permissionToggleSchema = z.object({ permission_key: z.string().min(1), enabled: z.boolean() });
const permissionAssignmentSchema = z.object({
  user_id: z.string().uuid(), group_id: z.string().uuid(),
  scope_type: z.enum(["organization", "branch", "department", "self"]),
  scope_id: z.string().uuid().nullable().optional(),
});
const expensePolicySchema = z.object({
  category_id: z.string().uuid(), scope_type: z.enum(["organization", "branch", "department", "employee"]),
  scope_id: z.string().uuid(), limit_per_claim: z.number().nullable(), limit_per_month: z.number().nullable(),
  auto_approve_below: z.number().nullable(), receipt_required: z.boolean(),
});
const syncLeavePolicySchema = z.object({
  year: z.number().int(), annual_days: z.number(), casual_days: z.number(), sick_days: z.number(),
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

  @Post("branches")
  @RequireModule("touchorbit", "organizations")
  async createBranch(@CurrentOrganization() organizationId: string, @Body() body: unknown) {
    const parsed = structureSchema.pick({ name: true, code: true, city: true, address: true }).safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid branch payload");
    return { ok: true, data: await this.organizationsService.createBranch(organizationId, parsed.data) };
  }

  @Patch("branches/:id")
  @RequireModule("touchorbit", "organizations")
  async updateBranch(@CurrentOrganization() organizationId: string, @Param("id") id: string, @Body() body: unknown) {
    const parsed = structureSchema.pick({ name: true, code: true, city: true, address: true }).safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid branch payload");
    return { ok: true, data: await this.organizationsService.updateBranch(organizationId, id, parsed.data) };
  }

  @Delete("branches/:id")
  @RequireModule("touchorbit", "organizations")
  async deleteBranch(@CurrentOrganization() organizationId: string, @Param("id") id: string) {
    return { ok: true, data: await this.organizationsService.deleteBranch(organizationId, id) };
  }

  @Post("departments")
  @RequireModule("touchorbit", "organizations")
  async createDepartment(@CurrentOrganization() organizationId: string, @Body() body: unknown) {
    const parsed = structureSchema.pick({ name: true, code: true, branch_id: true }).safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid department payload");
    return { ok: true, data: await this.organizationsService.createDepartment(organizationId, parsed.data) };
  }

  @Patch("departments/:id")
  @RequireModule("touchorbit", "organizations")
  async updateDepartment(@CurrentOrganization() organizationId: string, @Param("id") id: string, @Body() body: unknown) {
    const parsed = structureSchema.pick({ name: true, code: true, branch_id: true }).safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid department payload");
    return { ok: true, data: await this.organizationsService.updateDepartment(organizationId, id, parsed.data) };
  }

  @Delete("departments/:id")
  @RequireModule("touchorbit", "organizations")
  async deleteDepartment(@CurrentOrganization() organizationId: string, @Param("id") id: string) {
    return { ok: true, data: await this.organizationsService.deleteDepartment(organizationId, id) };
  }

  @Get("approval-config/:type")
  @RequireModule("touchorbit", "organizations")
  async getApprovalConfig(@CurrentOrganization() organizationId: string, @Param("type") type: string) {
    return { ok: true, data: await this.organizationsService.getApprovalConfig(organizationId, type) };
  }

  @Patch("approval-config/:type")
  @RequireModule("touchorbit", "organizations")
  async updateApprovalConfig(@CurrentOrganization() organizationId: string, @Param("type") type: string, @Body() body: unknown) {
    const parsed = approvalConfigSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid approval config payload");
    return { ok: true, data: await this.organizationsService.updateApprovalConfig(organizationId, type, parsed.data) };
  }

  @Get("security")
  @RequireModule("touchorbit", "organizations")
  async getSecurity(@CurrentOrganization() organizationId: string) {
    return { ok: true, data: await this.organizationsService.getSecurity(organizationId) };
  }

  @Patch("security/roles/:userId")
  @RequireModule("touchorbit", "organizations")
  async updateSecurityRole(
    @CurrentOrganization() organizationId: string,
    @CurrentUser("id") actorUserId: string,
    @Param("userId") targetUserId: string,
    @Body() body: unknown,
  ) {
    const parsed = systemRoleSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid security role payload");
    return { ok: true, data: await this.organizationsService.updateSecurityRole(organizationId, actorUserId, targetUserId, parsed.data.system_role) };
  }

  @Post("security/permission-groups")
  @RequireModule("touchorbit", "organizations")
  async createPermissionGroup(
    @CurrentOrganization() organizationId: string,
    @CurrentUser("id") actorUserId: string,
    @Body() body: unknown,
  ) {
    const parsed = permissionGroupSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid permission group payload");
    return { ok: true, data: await this.organizationsService.createPermissionGroup(organizationId, actorUserId, parsed.data) };
  }

  @Patch("security/permission-groups/:groupId/permissions")
  @RequireModule("touchorbit", "organizations")
  async toggleGroupPermission(
    @CurrentOrganization() organizationId: string,
    @Param("groupId") groupId: string,
    @Body() body: unknown,
  ) {
    const parsed = permissionToggleSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid permission payload");
    return { ok: true, data: await this.organizationsService.toggleGroupPermission(organizationId, groupId, parsed.data.permission_key, parsed.data.enabled) };
  }

  @Post("security/assignments")
  @RequireModule("touchorbit", "organizations")
  async assignPermissionGroup(
    @CurrentOrganization() organizationId: string,
    @CurrentUser("id") actorUserId: string,
    @Body() body: unknown,
  ) {
    const parsed = permissionAssignmentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid permission assignment payload");
    return { ok: true, data: await this.organizationsService.assignPermissionGroup(organizationId, actorUserId, parsed.data) };
  }

  @Delete("security/assignments/:id")
  @RequireModule("touchorbit", "organizations")
  async removePermissionGroup(@CurrentOrganization() organizationId: string, @Param("id") id: string) {
    return { ok: true, data: await this.organizationsService.removePermissionGroup(organizationId, id) };
  }

  @Patch("expense-policy")
  @RequireModule("touchorbit", "organizations")
  async updateExpensePolicy(@CurrentOrganization() organizationId: string, @Body() body: unknown) {
    const parsed = expensePolicySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid expense policy payload");
    return { ok: true, data: await this.organizationsService.updateExpensePolicy(organizationId, parsed.data) };
  }

  @Post("sync-leave-policy")
  @RequireModule("touchorbit", "organizations")
  async syncLeavePolicy(@CurrentOrganization() organizationId: string, @Body() body: unknown) {
    const parsed = syncLeavePolicySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid leave policy payload");
    return { ok: true, data: await this.organizationsService.syncLeavePolicy(organizationId, parsed.data) };
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
