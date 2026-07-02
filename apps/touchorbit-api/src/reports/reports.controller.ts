import { Controller, Get, Query, UseGuards, BadRequestException } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { z } from "zod";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { ReportsService } from "./reports.service";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const reportQuerySchema = z.object({
  startDate: dateSchema.optional(),
  endDate: dateSchema.optional(),
  departmentId: z.string().uuid().optional(),
  employeeIds: z.string().optional(),
  mode: z.enum(["summary", "detail"]).optional(),
  leaveType: z.string().optional(),
  status: z.string().optional(),
});

@ApiTags("reports")
@Controller("reports")
@UseGuards(SessionAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get()
  @RequireModule("touchorbit", "reports")
  @ApiOperation({ summary: "List reports" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const rows = await this.reportsService.findAll(organizationId);
    return { ok: true, data: rows };
  }

  @Get("attendance")
  @RequireModule("touchorbit", "reports")
  @ApiOperation({ summary: "Get attendance report" })
  async attendance(
    @CurrentOrganization() organizationId: string,
    @Query() query: unknown,
  ) {
    const filters = this.parseFilters(query);
    const data = await this.reportsService.attendance(organizationId, filters);
    return this.reportResponse(data, filters);
  }

  @Get("leave")
  @RequireModule("touchorbit", "reports")
  @ApiOperation({ summary: "Get leave report" })
  async leave(
    @CurrentOrganization() organizationId: string,
    @Query() query: unknown,
  ) {
    const filters = this.parseFilters(query);
    const data = await this.reportsService.leave(organizationId, filters);
    return this.reportResponse(data, filters);
  }

  @Get("payroll")
  @RequireModule("touchorbit", "reports")
  @ApiOperation({ summary: "Get payroll report" })
  async payroll(
    @CurrentOrganization() organizationId: string,
    @Query() query: unknown,
  ) {
    const filters = this.parseFilters(query);
    const data = await this.reportsService.payroll(organizationId, filters);
    return this.reportResponse(data, filters);
  }

  @Get("roster")
  @RequireModule("touchorbit", "reports")
  @ApiOperation({ summary: "Get roster report" })
  async roster(
    @CurrentOrganization() organizationId: string,
    @Query() query: unknown,
  ) {
    const filters = this.parseFilters(query);
    const data = await this.reportsService.roster(organizationId, filters);
    return this.reportResponse(data, filters);
  }

  private parseFilters(query: unknown) {
    const parsed = reportQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException("Invalid report query parameters");
    }

    const now = new Date();
    const startDate =
      parsed.data.startDate ??
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
        .toISOString()
        .split("T")[0];
    const endDate = parsed.data.endDate ?? now.toISOString().split("T")[0];
    const employeeIds = parsed.data.employeeIds
      ?.split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    return {
      ...parsed.data,
      startDate,
      endDate,
      employeeIds: employeeIds?.length ? employeeIds : undefined,
    };
  }

  private reportResponse(data: unknown[], filters: Record<string, unknown>) {
    return {
      data,
      meta: {
        ...filters,
        rowCount: data.length,
        generatedAt: new Date().toISOString(),
      },
      error: null,
    };
  }
}
