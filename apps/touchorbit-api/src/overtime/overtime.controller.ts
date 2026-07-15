import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { z } from "zod";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthContext } from "../auth/types";
import { OvertimeService } from "./overtime.service";

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/);

const createOvertimeSchema = z.object({
  employee_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: timeSchema.optional(),
  end_time: timeSchema.optional(),
  hours: z.number().positive().max(24),
  rate: z.number().positive().optional(),
  reason: z.string().max(2000).optional(),
});

@ApiTags("overtime")
@Controller("overtime")
@UseGuards(SessionAuthGuard)
export class OvertimeController {
  constructor(private readonly overtimeService: OvertimeService) {}

  @Get()
  @RequireModule("touchorbit", "overtime")
  @ApiOperation({ summary: "List overtime" })
  async findAll(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: AuthContext,
    @Query("employee_id") employeeId?: string,
  ) {
    const rows = await this.overtimeService.findAll(
      organizationId,
      user,
      employeeId,
    );
    return { ok: true, data: rows };
  }

  @Post()
  @RequireModule("touchorbit", "overtime")
  @ApiOperation({ summary: "Create an overtime request" })
  async create(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: AuthContext,
    @Body() body: unknown,
  ) {
    const parsed = createOvertimeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid overtime payload");
    }
    const row = await this.overtimeService.create(organizationId, user, {
      employeeId: parsed.data.employee_id,
      date: parsed.data.date,
      startTime: parsed.data.start_time,
      endTime: parsed.data.end_time,
      hours: parsed.data.hours,
      rate: parsed.data.rate ?? 1.5,
      reason: parsed.data.reason,
    });
    return { ok: true, data: row };
  }
}
