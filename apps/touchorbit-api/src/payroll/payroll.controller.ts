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
import { PayrollService } from "./payroll.service";

const createRunSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2020).max(2100),
  pay_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const updateItemSchema = z.object({
  basic_salary: z.number().nonnegative().optional(),
  earnings_json: z
    .array(
      z.object({
        component_id: z.string().uuid().optional(),
        amount: z.number(),
      }),
    )
    .optional(),
  deductions_json: z
    .array(z.object({ type: z.string().optional(), amount: z.number() }))
    .optional(),
  late_deduction: z.number().nonnegative().optional(),
  overtime_amount: z.number().nonnegative().optional(),
});

const salaryComponentSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  calculation_type: z.string().min(1),
  default_amount: z.number().nonnegative().optional(),
  is_statutory: z.boolean().optional(),
  is_taxable: z.boolean().optional(),
  description: z.string().optional(),
});

const structureRowSchema = z.object({
  component_id: z.string().uuid(),
  amount: z.number().nonnegative(),
  effective_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  effective_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

const upsertStructureSchema = z.array(structureRowSchema).min(1);

const sendPayslipsSchema = z.object({
  run_id: z.string().uuid().optional(),
  employee_ids: z.array(z.string().uuid()).optional(),
});

@ApiTags("payroll")
@Controller("payroll")
@UseGuards(SessionAuthGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get("runs")
  @RequireModule("touchorbit", "payroll")
  @ApiOperation({ summary: "List payroll runs" })
  async findRuns(@CurrentOrganization() organizationId: string) {
    const rows = await this.payrollService.findRuns(organizationId);
    return { ok: true, data: rows };
  }

  @Post("runs")
  @RequireModule("touchorbit", "payroll")
  @ApiOperation({ summary: "Create a payroll run" })
  async createRun(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: AuthContext,
    @Body() body: unknown,
  ) {
    const parsed = createRunSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid payroll run payload");
    }
    const row = await this.payrollService.createRun(
      organizationId,
      {
        month: parsed.data.month,
        year: parsed.data.year,
        payDate: parsed.data.pay_date,
      },
      user.id,
    );
    return { ok: true, data: row };
  }

  @Get("runs/:id")
  @RequireModule("touchorbit", "payroll")
  @ApiOperation({ summary: "Get a payroll run with summary" })
  async findRunById(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const row = await this.payrollService.findRunById(organizationId, id);
    return { ok: true, data: row };
  }

  @Post("runs/:id/process")
  @RequireModule("touchorbit", "payroll")
  @ApiOperation({ summary: "Process a payroll run" })
  async processRun(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const result = await this.payrollService.processRun(organizationId, id);
    return { ok: true, data: result };
  }

  @Get("runs/:id/items")
  @RequireModule("touchorbit", "payroll")
  @ApiOperation({ summary: "List payroll items for a run" })
  async findRunItems(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const rows = await this.payrollService.findRunItems(organizationId, id);
    return { ok: true, data: rows };
  }

  @Patch("runs/:id/items/:itemId")
  @RequireModule("touchorbit", "payroll")
  @ApiOperation({ summary: "Update a payroll item" })
  async updatePayrollItem(
    @CurrentOrganization() organizationId: string,
    @Param("id") runId: string,
    @Param("itemId") itemId: string,
    @Body() body: unknown,
  ) {
    const parsed = updateItemSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid payroll item payload");
    }
    const row = await this.payrollService.updatePayrollItem(
      organizationId,
      runId,
      itemId,
      {
        basicSalary: parsed.data.basic_salary,
        earningsJson: parsed.data.earnings_json,
        deductionsJson: parsed.data.deductions_json,
        lateDeduction: parsed.data.late_deduction,
        overtimeAmount: parsed.data.overtime_amount,
      },
    );
    return { ok: true, data: row };
  }

  @Get("salary-components")
  @RequireModule("touchorbit", "payroll")
  @ApiOperation({ summary: "List salary components" })
  async findSalaryComponents(@CurrentOrganization() organizationId: string) {
    const rows = await this.payrollService.findSalaryComponents(organizationId);
    return { ok: true, data: rows };
  }

  @Post("salary-components")
  @RequireModule("touchorbit", "payroll")
  @ApiOperation({ summary: "Create a salary component" })
  async createSalaryComponent(
    @CurrentOrganization() organizationId: string,
    @Body() body: unknown,
  ) {
    const parsed = salaryComponentSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid salary component payload");
    }
    const row = await this.payrollService.createSalaryComponent(
      organizationId,
      {
        name: parsed.data.name,
        type: parsed.data.type,
        calculationType: parsed.data.calculation_type,
        defaultAmount: parsed.data.default_amount,
        isStatutory: parsed.data.is_statutory,
        isTaxable: parsed.data.is_taxable,
        description: parsed.data.description,
      },
    );
    return { ok: true, data: row };
  }

  @Get("structures")
  @RequireModule("touchorbit", "payroll")
  @ApiOperation({ summary: "List employee salary structures" })
  async findStructures(@CurrentOrganization() organizationId: string) {
    const rows = await this.payrollService.findStructures(organizationId);
    return { ok: true, data: rows };
  }

  @Get("structures/:employeeId")
  @RequireModule("touchorbit", "payroll")
  @ApiOperation({ summary: "Get an employee salary structure" })
  async findStructureByEmployee(
    @CurrentOrganization() organizationId: string,
    @Param("employeeId") employeeId: string,
  ) {
    const rows = await this.payrollService.findStructureByEmployee(
      organizationId,
      employeeId,
    );
    return { ok: true, data: rows };
  }

  @Post("structures/:employeeId")
  @RequireModule("touchorbit", "payroll")
  @ApiOperation({ summary: "Upsert an employee salary structure" })
  async upsertStructure(
    @CurrentOrganization() organizationId: string,
    @Param("employeeId") employeeId: string,
    @Body() body: unknown,
  ) {
    const parsed = upsertStructureSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException("Invalid salary structure payload");
    }
    const rows = await this.payrollService.upsertStructure(
      organizationId,
      employeeId,
      parsed.data,
    );
    return { ok: true, data: rows };
  }

  @Post("payslips/send")
  @RequireModule("touchorbit", "payroll")
  @ApiOperation({ summary: "Send payslip emails" })
  sendPayslips(
    @CurrentOrganization() organizationId: string,
    @Body() body: unknown,
  ) {
    const parsed = sendPayslipsSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException("Invalid payslip send payload");
    }
    const result = this.payrollService.sendPayslips(organizationId, {
      run_id: parsed.data.run_id,
      employee_ids: parsed.data.employee_ids,
    });
    return { ok: true, data: result };
  }
}
