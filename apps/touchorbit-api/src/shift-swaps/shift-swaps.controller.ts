import {
  Controller,
  Get,
  Post,
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
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { ShiftSwapsService } from "./shift-swaps.service";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createSwapSchema = z.object({
  requesting_employee_id: z.string().uuid(),
  requested_employee_id: z.string().uuid().optional(),
  roster_assignment_id: z.string().uuid(),
  reason: z.string().optional(),
});

const rejectSchema = z.object({
  reason: z.string().optional(),
});

const claimSchema = z.object({
  claimer_employee_id: z.string().uuid(),
  target_date: dateSchema.optional(),
});

@ApiTags("shift-swaps")
@Controller("shift-swaps")
@UseGuards(SessionAuthGuard)
export class ShiftSwapsController {
  constructor(private readonly shiftswapsService: ShiftSwapsService) {}

  @Get()
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "List shift swap requests" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const rows = await this.shiftswapsService.findAll(organizationId);
    return { ok: true, data: rows };
  }

  @Post()
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Create shift swap request" })
  async create(
    @CurrentOrganization() organizationId: string,
    @Body() body: unknown,
  ) {
    const parsed = createSwapSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid shift swap payload");
    }
    const row = await this.shiftswapsService.create(organizationId, {
      requestingEmployeeId: parsed.data.requesting_employee_id,
      requestedEmployeeId: parsed.data.requested_employee_id,
      rosterAssignmentId: parsed.data.roster_assignment_id,
      reason: parsed.data.reason,
    });
    return { ok: true, data: row };
  }

  @Post(":id/approve")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Approve shift swap request" })
  async approve(
    @CurrentOrganization() organizationId: string,
    @CurrentUser("id") userId: string,
    @Param("id") swapId: string,
  ) {
    const row = await this.shiftswapsService.approve(
      organizationId,
      swapId,
      userId,
    );
    return { ok: true, data: row };
  }

  @Post(":id/reject")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Reject shift swap request" })
  async reject(
    @CurrentOrganization() organizationId: string,
    @CurrentUser("id") userId: string,
    @Param("id") swapId: string,
    @Body() body: unknown,
  ) {
    const parsed = rejectSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid reject payload");
    }
    const row = await this.shiftswapsService.reject(
      organizationId,
      swapId,
      userId,
      parsed.data.reason,
    );
    return { ok: true, data: row };
  }

  @Post(":id/claim")
  @RequireModule("touchorbit", "attendance")
  @ApiOperation({ summary: "Claim open shift swap" })
  async claim(
    @CurrentOrganization() organizationId: string,
    @Param("id") swapId: string,
    @Body() body: unknown,
  ) {
    const parsed = claimSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid claim payload");
    }
    const row = await this.shiftswapsService.claim(
      organizationId,
      swapId,
      parsed.data.claimer_employee_id,
      parsed.data.target_date,
    );
    return { ok: true, data: row };
  }
}
