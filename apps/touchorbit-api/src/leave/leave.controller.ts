import {
  Controller,
  Get,
  Post,
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
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthContext } from "../auth/types";
import { LeaveService } from "./leave.service";

const createRequestSchema = z.object({
  employee_id: z.string().uuid(),
  leave_type: z.string().min(1),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().optional(),
});

const updateRequestSchema = z.object({
  start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  reason: z.string().optional(),
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
  cancellation_requested: z.boolean().optional(),
});

const decisionSchema = z.object({
  notes: z.string().optional(),
});

const adjustBalanceSchema = z.object({
  leave_type: z.string().min(1),
  days: z.number().optional(),
  entitled_days: z.number().optional(),
  reason: z.string().optional(),
}).refine(
  (data) => data.days !== undefined || data.entitled_days !== undefined,
  { message: "Either days or entitled_days must be provided" },
);

const compOffSchema = z.object({
  employee_id: z.string().uuid(),
  worked_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  holiday_id: z.string().uuid().optional(),
  notes: z.string().optional(),
  status: z.enum(["pending", "approved"]).optional(),
});

const encashmentSchema = z.object({
  employee_id: z.string().uuid(),
  year: z.number().int().min(2020).max(2100),
  days_requested: z.number().positive(),
  amount: z.number().nonnegative(),
  reason: z.string().optional(),
});

@ApiTags("leave")
@Controller("leave")
@UseGuards(SessionAuthGuard)
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Get("requests")
  @RequireModule("touchorbit", "leave")
  @ApiOperation({ summary: "List leave requests" })
  async findRequests(
    @CurrentOrganization() organizationId: string,
    @Query("employee_id") employeeId?: string,
    @Query("status") status?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const rows = await this.leaveService.findRequests(organizationId, {
      employeeId,
      status,
      from,
      to,
    });
    return { ok: true, data: rows };
  }

  @Get("requests/:id")
  @RequireModule("touchorbit", "leave")
  @ApiOperation({ summary: "Get a leave request" })
  async findRequestById(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const row = await this.leaveService.findRequestById(organizationId, id);
    return { ok: true, data: row };
  }

  @Post("requests")
  @RequireModule("touchorbit", "leave")
  @ApiOperation({ summary: "Create a leave request" })
  async createRequest(
    @CurrentOrganization() organizationId: string,
    @CurrentUser("id") userId: string,
    @Body() body: unknown,
  ) {
    const parsed = createRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid leave request payload");
    }
    const row = await this.leaveService.createRequest(organizationId, {
      employeeId: parsed.data.employee_id,
      leaveType: parsed.data.leave_type,
      startDate: parsed.data.start_date,
      endDate: parsed.data.end_date,
      reason: parsed.data.reason,
      userId,
    });
    return { ok: true, data: row };
  }

  @Patch("requests/:id")
  @RequireModule("touchorbit", "leave")
  @ApiOperation({ summary: "Update a leave request" })
  async updateRequest(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid leave update payload");
    }
    const row = await this.leaveService.updateRequest(organizationId, id, {
      startDate: parsed.data.start_date,
      endDate: parsed.data.end_date,
      reason: parsed.data.reason,
      status: parsed.data.status,
      cancellationRequested: parsed.data.cancellation_requested,
    });
    return { ok: true, data: row };
  }

  @Post("requests/:id/approve")
  @RequireModule("touchorbit", "leave")
  @ApiOperation({ summary: "Approve a leave request" })
  async approveRequest(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthContext,
    @Body() body: unknown,
  ) {
    const parsed = decisionSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException("Invalid decision payload");
    }
    const row = await this.leaveService.approveRequest(
      organizationId,
      id,
      user.id,
      parsed.data.notes,
    );
    return { ok: true, data: row };
  }

  @Post("requests/:id/reject")
  @RequireModule("touchorbit", "leave")
  @ApiOperation({ summary: "Reject a leave request" })
  async rejectRequest(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthContext,
    @Body() body: unknown,
  ) {
    const parsed = decisionSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException("Invalid decision payload");
    }
    const row = await this.leaveService.rejectRequest(
      organizationId,
      id,
      user.id,
      parsed.data.notes,
    );
    return { ok: true, data: row };
  }

  @Get("balances")
  @RequireModule("touchorbit", "leave")
  @ApiOperation({ summary: "List leave balances" })
  async findBalances(
    @CurrentOrganization() organizationId: string,
    @Query("employee_id") employeeId?: string,
  ) {
    const rows = await this.leaveService.findBalances(
      organizationId,
      employeeId,
    );
    return { ok: true, data: rows };
  }

  @Get("balances/:employeeId")
  @RequireModule("touchorbit", "leave")
  @ApiOperation({ summary: "Get leave balances for an employee" })
  async findBalancesByEmployee(
    @CurrentOrganization() organizationId: string,
    @Param("employeeId") employeeId: string,
  ) {
    const rows = await this.leaveService.findBalancesByEmployee(
      organizationId,
      employeeId,
    );
    return { ok: true, data: rows };
  }

  @Post("balances/:employeeId/adjust")
  @RequireModule("touchorbit", "leave")
  @ApiOperation({ summary: "Adjust leave balance for an employee" })
  async adjustBalance(
    @CurrentOrganization() organizationId: string,
    @Param("employeeId") employeeId: string,
    @CurrentUser() user: AuthContext,
    @Body() body: unknown,
  ) {
    const parsed = adjustBalanceSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid balance adjustment payload");
    }
    const row = await this.leaveService.adjustBalance(
      organizationId,
      employeeId,
      {
        leaveType: parsed.data.leave_type,
        days: parsed.data.days,
        entitledDays: parsed.data.entitled_days,
        reason: parsed.data.reason,
      },
      user.id,
      user.fullName,
    );
    return { ok: true, data: row };
  }

  @Get("comp-off")
  @RequireModule("touchorbit", "leave")
  @ApiOperation({ summary: "List comp-off records" })
  async findCompOffRecords(
    @CurrentOrganization() organizationId: string,
    @Query("employee_id") employeeId?: string,
  ) {
    const rows = await this.leaveService.findCompOffRecords(
      organizationId,
      employeeId,
    );
    return { ok: true, data: rows };
  }

  @Post("comp-off")
  @RequireModule("touchorbit", "leave")
  @ApiOperation({ summary: "Create a comp-off record" })
  async createCompOffRecord(
    @CurrentOrganization() organizationId: string,
    @Body() body: unknown,
  ) {
    const parsed = compOffSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid comp-off payload");
    }
    const row = await this.leaveService.createCompOffRecord(organizationId, {
      employeeId: parsed.data.employee_id,
      workedDate: parsed.data.worked_date,
      holidayId: parsed.data.holiday_id,
      notes: parsed.data.notes,
      status: parsed.data.status,
    });
    return { ok: true, data: row };
  }

  @Post("comp-off/:id/approve")
  @RequireModule("touchorbit", "leave")
  @ApiOperation({ summary: "Approve a comp-off record" })
  async approveCompOffRecord(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthContext,
  ) {
    const row = await this.leaveService.approveCompOffRecord(
      organizationId,
      id,
      user.id,
    );
    return { ok: true, data: row };
  }

  @Post("comp-off/:id/reject")
  @RequireModule("touchorbit", "leave")
  @ApiOperation({ summary: "Reject a comp-off record" })
  async rejectCompOffRecord(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const row = await this.leaveService.rejectCompOffRecord(
      organizationId,
      id,
    );
    return { ok: true, data: row };
  }

  @Get("encashment")
  @RequireModule("touchorbit", "leave")
  @ApiOperation({ summary: "List leave encashment requests" })
  async findEncashmentRequests(
    @CurrentOrganization() organizationId: string,
    @Query("employee_id") employeeId?: string,
  ) {
    const rows = await this.leaveService.findEncashmentRequests(
      organizationId,
      employeeId,
    );
    return { ok: true, data: rows };
  }

  @Post("encashment")
  @RequireModule("touchorbit", "leave")
  @ApiOperation({ summary: "Create a leave encashment request" })
  async createEncashmentRequest(
    @CurrentOrganization() organizationId: string,
    @Body() body: unknown,
  ) {
    const parsed = encashmentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid encashment payload");
    }
    const row = await this.leaveService.createEncashmentRequest(
      organizationId,
      {
        employeeId: parsed.data.employee_id,
        year: parsed.data.year,
        daysRequested: parsed.data.days_requested,
        amount: parsed.data.amount,
        reason: parsed.data.reason,
      },
    );
    return { ok: true, data: row };
  }

  @Post("encashment/:id/approve")
  @RequireModule("touchorbit", "leave")
  @ApiOperation({ summary: "Approve a leave encashment request" })
  async approveEncashmentRequest(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthContext,
  ) {
    const row = await this.leaveService.approveEncashmentRequest(
      organizationId,
      id,
      user.id,
    );
    return { ok: true, data: row };
  }

  @Post("encashment/:id/reject")
  @RequireModule("touchorbit", "leave")
  @ApiOperation({ summary: "Reject a leave encashment request" })
  async rejectEncashmentRequest(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @CurrentUser() user: AuthContext,
  ) {
    const row = await this.leaveService.rejectEncashmentRequest(
      organizationId,
      id,
      user.id,
    );
    return { ok: true, data: row };
  }
}
