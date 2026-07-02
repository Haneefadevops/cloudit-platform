import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
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
import { PerformanceService } from "./performance.service";

const cycleSchema = z.object({
  title: z.string().min(1),
  start_date: z.string(),
  end_date: z.string(),
  status: z.enum(["draft", "active", "completed", "cancelled"]).default("draft"),
});

const reviewSchema = z.object({
  employee_id: z.string().uuid(),
  cycle_id: z.string().uuid().optional().nullable(),
  review_period_start: z.string().optional().nullable(),
  review_period_end: z.string().optional().nullable(),
  overall_score: z.coerce.number().int().min(1).max(5).optional().nullable(),
  attendance_score: z.coerce.number().int().min(1).max(5).optional().nullable(),
  punctuality_score: z.coerce.number().int().min(1).max(5).optional().nullable(),
  productivity_score: z.coerce.number().int().min(1).max(5).optional().nullable(),
  teamwork_score: z.coerce.number().int().min(1).max(5).optional().nullable(),
  notes: z.string().optional().nullable(),
  status: z.enum(["pending_self", "pending_manager", "under_review", "completed"]).default("pending_self"),
});

const selfReviewSchema = z.object({
  self_rating: z.coerce.number().int().min(1).max(5),
  self_comments: z.string().optional().nullable(),
});

const managerReviewSchema = z.object({
  manager_rating: z.coerce.number().int().min(1).max(5),
  manager_comments: z.string().optional().nullable(),
  final_rating: z.coerce.number().int().min(1).max(5).optional().nullable(),
  improvement_plan: z.string().optional().nullable(),
  status: z.enum(["pending_self", "pending_manager", "under_review", "completed"]).default("completed"),
});

const goalSchema = z.object({
  employee_id: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  kpi_metric: z.string().min(1),
  target_value: z.coerce.number(),
  target_date: z.string().optional().nullable(),
  status: z.enum(["active", "achieved", "at_risk", "missed"]).default("active"),
});

const skillSchema = z.object({
  employee_id: z.string().uuid(),
  skill_name: z.string().min(1),
  category: z.enum(["technical", "soft_skill", "language", "certification"]).default("technical"),
  proficiency_level: z.coerce.number().int().min(1).max(5).default(1),
});

@ApiTags("performance")
@Controller("performance")
@UseGuards(SessionAuthGuard)
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  // Cycles
  @Get("cycles")
  @RequireModule("touchorbit", "performance")
  @ApiOperation({ summary: "List review cycles" })
  async findCycles(@CurrentOrganization() organizationId: string) {
    const rows = await this.performanceService.findCycles(organizationId);
    return { ok: true, data: rows };
  }

  @Post("cycles")
  @RequireModule("touchorbit", "performance")
  @ApiOperation({ summary: "Create a review cycle" })
  async createCycle(
    @CurrentOrganization() organizationId: string,
    @Body() body: any,
  ) {
    const input = cycleSchema.parse(body);
    const row = await this.performanceService.createCycle(organizationId, input);
    return { ok: true, data: row };
  }

  // Reviews
  @Get("reviews")
  @RequireModule("touchorbit", "performance")
  @ApiOperation({ summary: "List performance reviews" })
  async findReviews(@CurrentOrganization() organizationId: string) {
    const rows = await this.performanceService.findReviews(organizationId);
    return { ok: true, data: rows };
  }

  @Get("reviews/employee/:employeeId")
  @RequireModule("touchorbit", "performance")
  @ApiOperation({ summary: "List performance reviews for an employee" })
  async findReviewsByEmployee(
    @CurrentOrganization() organizationId: string,
    @Param("employeeId") employeeId: string,
  ) {
    const rows = await this.performanceService.findReviewsByEmployee(organizationId, employeeId);
    return { ok: true, data: rows };
  }

  @Post("reviews")
  @RequireModule("touchorbit", "performance")
  @ApiOperation({ summary: "Create a performance review" })
  async createReview(
    @CurrentOrganization() organizationId: string,
    @Body() body: any,
  ) {
    const input = reviewSchema.parse(body);
    const row = await this.performanceService.createReview(organizationId, input);
    return { ok: true, data: row };
  }

  @Post("reviews/:id/self")
  @RequireModule("touchorbit", "performance")
  @ApiOperation({ summary: "Submit self-review" })
  async submitSelfReview(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const input = selfReviewSchema.parse(body);
    const row = await this.performanceService.submitSelfReview(organizationId, id, input);
    return { ok: true, data: row };
  }

  @Post("reviews/:id/manager")
  @RequireModule("touchorbit", "performance")
  @ApiOperation({ summary: "Submit manager review" })
  async submitManagerReview(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const input = managerReviewSchema.parse(body);
    const row = await this.performanceService.submitManagerReview(organizationId, id, input);
    return { ok: true, data: row };
  }

  // Goals
  @Get("goals")
  @RequireModule("touchorbit", "performance")
  @ApiOperation({ summary: "List employee goals" })
  async findGoals(@CurrentOrganization() organizationId: string) {
    const rows = await this.performanceService.findGoals(organizationId);
    return { ok: true, data: rows };
  }

  @Post("goals")
  @RequireModule("touchorbit", "performance")
  @ApiOperation({ summary: "Create an employee goal" })
  async createGoal(
    @CurrentOrganization() organizationId: string,
    @Body() body: any,
  ) {
    const input = goalSchema.parse(body);
    const row = await this.performanceService.createGoal(organizationId, input);
    return { ok: true, data: row };
  }

  @Patch("goals/:id")
  @RequireModule("touchorbit", "performance")
  @ApiOperation({ summary: "Update an employee goal" })
  async updateGoal(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const input = goalSchema.partial().parse(body);
    const row = await this.performanceService.updateGoal(organizationId, id, input);
    return { ok: true, data: row };
  }

  @Delete("goals/:id")
  @RequireModule("touchorbit", "performance")
  @ApiOperation({ summary: "Delete an employee goal" })
  async deleteGoal(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const result = await this.performanceService.deleteGoal(organizationId, id);
    return { ok: true, data: result };
  }

  // Skills
  @Get("skills")
  @RequireModule("touchorbit", "performance")
  @ApiOperation({ summary: "List employee skills" })
  async findSkills(@CurrentOrganization() organizationId: string) {
    const rows = await this.performanceService.findSkills(organizationId);
    return { ok: true, data: rows };
  }

  @Post("skills")
  @RequireModule("touchorbit", "performance")
  @ApiOperation({ summary: "Create an employee skill" })
  async createSkill(
    @CurrentOrganization() organizationId: string,
    @Body() body: any,
  ) {
    const input = skillSchema.parse(body);
    const row = await this.performanceService.createSkill(organizationId, input);
    return { ok: true, data: row };
  }

  @Patch("skills/:id")
  @RequireModule("touchorbit", "performance")
  @ApiOperation({ summary: "Update an employee skill" })
  async updateSkill(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const input = skillSchema.partial().parse(body);
    const row = await this.performanceService.updateSkill(organizationId, id, input);
    return { ok: true, data: row };
  }

  @Delete("skills/:id")
  @RequireModule("touchorbit", "performance")
  @ApiOperation({ summary: "Delete an employee skill" })
  async deleteSkill(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const result = await this.performanceService.deleteSkill(organizationId, id);
    return { ok: true, data: result };
  }

  // Overview
  @Get("overview")
  @RequireModule("touchorbit", "performance")
  @ApiOperation({ summary: "Performance overview counts" })
  async overview(@CurrentOrganization() organizationId: string) {
    const data = await this.performanceService.overview(organizationId);
    return { ok: true, data };
  }
}
