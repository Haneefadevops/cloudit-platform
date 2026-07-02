import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import { AuthUser } from "../common/decorators/auth-user.decorator";
import type { AuthContext } from "../auth/types";
import { EmployeesService } from "./employees.service";

const listQuerySchema = z.object({
  status: z.string().optional(),
  department_id: z.string().uuid().optional(),
  branch_id: z.string().uuid().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const createEmployeeSchema = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  email: z.string().email(),
  employee_number: z.string().optional(),
  phone: z.string().optional(),
  department: z.string().optional(),
  department_id: z.string().uuid().optional(),
  branch_id: z.string().uuid().optional(),
  job_title: z.string().optional(),
  hire_date: z.string().optional(),
  employment_status: z.string().default("active"),
  manager_id: z.string().uuid().optional(),
  basic_salary: z.coerce.number().nonnegative().optional(),
});

const updateEmployeeSchema = z.object({
  first_name: z.string().min(1).optional(),
  last_name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  employee_number: z.string().optional(),
  nic: z.string().optional(),
  department: z.string().optional(),
  department_id: z.string().uuid().optional(),
  branch_id: z.string().uuid().optional(),
  job_title: z.string().optional(),
  hire_date: z.string().optional(),
  employment_status: z.string().optional(),
  manager_id: z.string().uuid().optional(),
  basic_salary: z.coerce.number().nonnegative().optional(),
  bank_name: z.string().optional(),
  bank_account_number: z.string().optional(),
  bank_branch: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  postal_code: z.string().optional(),
});

const terminateSchema = z.object({
  termination_date: z.string().optional(),
  termination_reason: z.string().optional(),
  last_working_day: z.string().optional(),
});

const toggleAccessSchema = z.object({
  enabled: z.boolean(),
});

const resetPasswordSchema = z.object({
  password: z.string().min(6),
});

const photoSchema = z.object({
  bucket: z.string().min(1),
  key: z.string().min(1),
  contentType: z.string().min(1),
});

const emergencyContactSchema = z.object({
  name: z.string().min(1),
  relationship: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  is_primary: z.boolean().default(false),
});

const emergencyContactsReplaceSchema = z.array(emergencyContactSchema);

@ApiTags("employees")
@Controller("employees")
@UseGuards(SessionAuthGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  @RequireModule("touchorbit", "employees")
  @ApiOperation({ summary: "List employees" })
  async findAll(
    @CurrentOrganization() organizationId: string,
    @Query() query: unknown,
  ) {
    const parsed = listQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException("Invalid query parameters");
    }

    const rows = await this.employeesService.findAll(organizationId, {
      status: parsed.data.status,
      departmentId: parsed.data.department_id,
      branchId: parsed.data.branch_id,
      search: parsed.data.search,
      limit: parsed.data.limit,
      offset: parsed.data.offset,
    });

    return { ok: true, data: rows };
  }

  @Get("me")
  @RequireModule("touchorbit", "employees")
  @ApiOperation({ summary: "Get current user's employee record" })
  async findMe(
    @CurrentOrganization() organizationId: string,
    @AuthUser() user: AuthContext,
  ) {
    const row = await this.employeesService.findByUserId(organizationId, user.id);
    return { ok: true, data: row };
  }

  @Get(":id")
  @RequireModule("touchorbit", "employees")
  @ApiOperation({ summary: "Get a single employee" })
  async findOne(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const row = await this.employeesService.findOne(organizationId, id);
    return { ok: true, data: row };
  }

  @Post()
  @RequireModule("touchorbit", "employees")
  @ApiOperation({ summary: "Create an employee" })
  async create(
    @CurrentOrganization() organizationId: string,
    @AuthUser() user: AuthContext,
    @Body() body: unknown,
  ) {
    const parsed = createEmployeeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid employee payload");
    }

    const row = await this.employeesService.create(
      organizationId,
      {
        id: user.id,
        name: user.fullName,
      },
      parsed.data,
    );

    return { ok: true, data: row };
  }

  @Patch(":id")
  @RequireModule("touchorbit", "employees")
  @ApiOperation({ summary: "Update an employee" })
  async update(
    @CurrentOrganization() organizationId: string,
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateEmployeeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid update payload");
    }

    const row = await this.employeesService.update(
      organizationId,
      { id: user.id, name: user.fullName },
      id,
      parsed.data,
    );

    return { ok: true, data: row };
  }

  @Post(":id/terminate")
  @RequireModule("touchorbit", "employees")
  @ApiOperation({ summary: "Terminate an employee" })
  async terminate(
    @CurrentOrganization() organizationId: string,
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = terminateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid termination payload");
    }

    const row = await this.employeesService.terminate(
      organizationId,
      { id: user.id, name: user.fullName },
      id,
      parsed.data,
    );

    return { ok: true, data: row };
  }

  @Post(":id/toggle-access")
  @RequireModule("touchorbit", "employees")
  @ApiOperation({ summary: "Enable or disable employee account access" })
  async toggleAccess(
    @CurrentOrganization() organizationId: string,
    @AuthUser() user: AuthContext,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = toggleAccessSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid access toggle payload");
    }

    const result = await this.employeesService.toggleAccess(
      organizationId,
      { id: user.id, name: user.fullName },
      id,
      parsed.data.enabled,
    );

    return { ok: true, data: result };
  }

  @Post(":id/reset-password")
  @RequireModule("touchorbit", "employees")
  @ApiOperation({ summary: "Reset employee account password" })
  async resetPassword(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid password payload");
    }

    const result = await this.employeesService.resetPassword(
      organizationId,
      id,
      parsed.data.password,
    );

    return { ok: true, data: result };
  }

  @Post(":id/photo")
  @RequireModule("touchorbit", "employees")
  @ApiOperation({ summary: "Generate presigned photo upload URL" })
  async uploadPhoto(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = photoSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid photo payload");
    }

    const result = await this.employeesService.uploadPhoto(
      organizationId,
      id,
      parsed.data.bucket,
      parsed.data.key,
      parsed.data.contentType,
    );

    return { ok: true, data: result };
  }

  @Get(":id/history")
  @RequireModule("touchorbit", "employees")
  @ApiOperation({ summary: "List employee history" })
  async history(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const rows = await this.employeesService.findHistory(organizationId, id);
    return { ok: true, data: rows };
  }

  @Get(":id/emergency-contacts")
  @RequireModule("touchorbit", "employees")
  @ApiOperation({ summary: "List emergency contacts" })
  async emergencyContacts(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const rows = await this.employeesService.findEmergencyContacts(
      organizationId,
      id,
    );
    return { ok: true, data: rows };
  }

  @Post(":id/emergency-contacts")
  @RequireModule("touchorbit", "employees")
  @ApiOperation({ summary: "Create an emergency contact" })
  async createEmergencyContact(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = emergencyContactSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid emergency contact payload");
    }

    const row = await this.employeesService.createEmergencyContact(
      organizationId,
      id,
      parsed.data,
    );

    return { ok: true, data: row };
  }

  @Put(":id/emergency-contacts")
  @RequireModule("touchorbit", "employees")
  @ApiOperation({ summary: "Replace all emergency contacts" })
  async replaceEmergencyContacts(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = emergencyContactsReplaceSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid emergency contacts payload");
    }

    const rows = await this.employeesService.replaceEmergencyContacts(
      organizationId,
      id,
      parsed.data,
    );

    return { ok: true, data: rows };
  }
}
