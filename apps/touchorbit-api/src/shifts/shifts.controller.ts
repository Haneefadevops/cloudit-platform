import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { z } from "zod";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { ShiftsService } from "./shifts.service";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/);

const createShiftSchema = z.object({
  name: z.string().min(1).max(255),
  start_time: timeSchema,
  end_time: timeSchema,
  break_duration: z.number().int().min(0).optional(),
  color: z.string().max(32).optional(),
  is_night_shift: z.boolean().optional(),
});

const updateShiftSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  start_time: timeSchema.optional(),
  end_time: timeSchema.optional(),
  break_duration: z.number().int().min(0).optional(),
  color: z.string().max(32).optional(),
  is_night_shift: z.boolean().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  start_time: timeSchema,
  end_time: timeSchema,
  break_duration: z.number().int().min(0).optional(),
  department_id: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  branch_id: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
});

@ApiTags("shifts")
@Controller("shifts")
@UseGuards(SessionAuthGuard)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get()
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "List shifts" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const rows = await this.shiftsService.findAll(organizationId);
    return { ok: true, data: rows };
  }

  @Post()
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Create shift" })
  async create(
    @CurrentOrganization() organizationId: string,
    @Body() body: unknown,
  ) {
    const parsed = createShiftSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid shift payload");
    }
    const row = await this.shiftsService.create(organizationId, {
      name: parsed.data.name,
      startTime: parsed.data.start_time,
      endTime: parsed.data.end_time,
      breakDuration: parsed.data.break_duration,
      color: parsed.data.color,
      isNightShift: parsed.data.is_night_shift,
    });
    return { ok: true, data: row };
  }

  @Get(":id")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Get shift" })
  async findOne(
    @CurrentOrganization() organizationId: string,
    @Param("id") shiftId: string,
  ) {
    const row = await this.shiftsService.findOne(organizationId, shiftId);
    return { ok: true, data: row };
  }

  @Patch(":id")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Update shift" })
  async update(
    @CurrentOrganization() organizationId: string,
    @Param("id") shiftId: string,
    @Body() body: unknown,
  ) {
    const parsed = updateShiftSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid shift payload");
    }
    const row = await this.shiftsService.update(organizationId, shiftId, {
      name: parsed.data.name,
      startTime: parsed.data.start_time,
      endTime: parsed.data.end_time,
      breakDuration: parsed.data.break_duration,
      color: parsed.data.color,
      isNightShift: parsed.data.is_night_shift,
      status: parsed.data.status,
    });
    return { ok: true, data: row };
  }

  @Delete(":id")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Delete shift" })
  async delete(
    @CurrentOrganization() organizationId: string,
    @Param("id") shiftId: string,
  ) {
    const result = await this.shiftsService.delete(organizationId, shiftId);
    return { ok: true, data: result };
  }

  @Get("templates")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "List shift templates" })
  async findAllTemplates(@CurrentOrganization() organizationId: string) {
    const rows = await this.shiftsService.findAllTemplates(organizationId);
    return { ok: true, data: rows };
  }

  @Post("templates")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Create shift template" })
  async createTemplate(
    @CurrentOrganization() organizationId: string,
    @Body() body: unknown,
  ) {
    const parsed = createTemplateSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid template payload");
    }
    const row = await this.shiftsService.createTemplate(organizationId, {
      name: parsed.data.name,
      startTime: parsed.data.start_time,
      endTime: parsed.data.end_time,
      breakDuration: parsed.data.break_duration,
      departmentId: parsed.data.department_id ?? parsed.data.departmentId,
      branchId: parsed.data.branch_id ?? parsed.data.branchId,
    });
    return { ok: true, data: row };
  }
}
