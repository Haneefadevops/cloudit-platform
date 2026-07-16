import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { ExpensesService } from "./expenses.service";

const createExpenseSchema = z.object({
  employee_id: z.string().uuid(),
  category_id: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().min(1).max(3).default("LKR"),
  claim_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().max(2000).optional(),
});

const categorySchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  max_claim_amount: z.number().positive().nullable().optional(),
  is_active: z.boolean().optional(),
});

@ApiTags("expenses")
@Controller("expenses")
@UseGuards(SessionAuthGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  @RequireModule("touchorbit", "expenses")
  @ApiOperation({ summary: "List expenses" })
  async findAll(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: AuthContext,
    @Query("employee_id") employeeId?: string,
  ) {
    const rows = await this.expensesService.findAll(organizationId, user, employeeId);
    return { ok: true, data: rows };
  }

  @Get("categories")
  @RequireModule("touchorbit", "expenses")
  @ApiOperation({ summary: "List expense categories" })
  async findCategories(
    @CurrentOrganization() organizationId: string,
    @Query("include_inactive") includeInactive?: string,
  ) {
    const rows = await this.expensesService.findCategories(
      organizationId,
      includeInactive === "true",
    );
    return { ok: true, data: rows };
  }

  @Post("categories")
  @RequireModule("touchorbit", "expenses")
  @ApiOperation({ summary: "Create an expense category" })
  async createCategory(
    @CurrentOrganization() organizationId: string,
    @Body() body: unknown,
  ) {
    const parsed = categorySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid expense category payload");
    const row = await this.expensesService.createCategory(organizationId, parsed.data);
    return { ok: true, data: row };
  }

  @Patch("categories/:id")
  @RequireModule("touchorbit", "expenses")
  @ApiOperation({ summary: "Update an expense category" })
  async updateCategory(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = categorySchema.partial().safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid expense category payload");
    const row = await this.expensesService.updateCategory(organizationId, id, parsed.data);
    return { ok: true, data: row };
  }

  @Post()
  @RequireModule("touchorbit", "expenses")
  @ApiOperation({ summary: "Create an expense claim" })
  async create(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: AuthContext,
    @Body() body: unknown,
  ) {
    const parsed = createExpenseSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException("Invalid expense payload");
    const row = await this.expensesService.create(organizationId, user, parsed.data);
    return { ok: true, data: row };
  }
}
