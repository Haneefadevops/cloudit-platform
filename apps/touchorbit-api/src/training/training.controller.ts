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
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { TrainingService } from "./training.service";

@ApiTags("training")
@Controller("training")
@UseGuards(SessionAuthGuard)
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  // Programs
  @Get()
  @RequireModule("touchorbit", "training")
  @ApiOperation({ summary: "List training programs" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const rows = await this.trainingService.findAll(organizationId);
    return { ok: true, data: rows };
  }

  @Post("programs")
  @RequireModule("touchorbit", "training")
  @ApiOperation({ summary: "Create a training program" })
  async createProgram(
    @CurrentOrganization() organizationId: string,
    @Body() body: any,
  ) {
    if (!body.title) throw new BadRequestException("title is required");
    const row = await this.trainingService.createProgram(organizationId, body);
    return { ok: true, data: row };
  }

  @Patch("programs/:id")
  @RequireModule("touchorbit", "training")
  @ApiOperation({ summary: "Update a training program" })
  async updateProgram(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const row = await this.trainingService.updateProgram(organizationId, id, body);
    return { ok: true, data: row };
  }

  @Delete("programs/:id")
  @RequireModule("touchorbit", "training")
  @ApiOperation({ summary: "Delete a training program" })
  async deleteProgram(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const result = await this.trainingService.deleteProgram(organizationId, id);
    return { ok: true, data: result };
  }

  // Assignments
  @Get("assignments")
  @RequireModule("touchorbit", "training")
  @ApiOperation({ summary: "List training assignments" })
  async findAssignments(@CurrentOrganization() organizationId: string) {
    const rows = await this.trainingService.findAssignments(organizationId);
    return { ok: true, data: rows };
  }

  @Post("assignments")
  @RequireModule("touchorbit", "training")
  @ApiOperation({ summary: "Create a training assignment" })
  async createAssignment(
    @CurrentOrganization() organizationId: string,
    @Body() body: any,
  ) {
    if (!body.program_id || !body.employee_id) {
      throw new BadRequestException("program_id and employee_id are required");
    }
    const row = await this.trainingService.createAssignment(organizationId, body);
    return { ok: true, data: row };
  }

  @Patch("assignments/:id")
  @RequireModule("touchorbit", "training")
  @ApiOperation({ summary: "Update a training assignment" })
  async updateAssignment(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const row = await this.trainingService.updateAssignment(organizationId, id, body);
    return { ok: true, data: row };
  }

  @Post("assignments/:id/reschedule-approve")
  @RequireModule("touchorbit", "training")
  @ApiOperation({ summary: "Approve reschedule request" })
  async approveReschedule(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const row = await this.trainingService.approveReschedule(organizationId, id);
    return { ok: true, data: row };
  }

  @Post("assignments/:id/reschedule-reject")
  @RequireModule("touchorbit", "training")
  @ApiOperation({ summary: "Reject reschedule request" })
  async rejectReschedule(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const row = await this.trainingService.rejectReschedule(organizationId, id);
    return { ok: true, data: row };
  }

  @Post("assignments/:id/cancel-approve")
  @RequireModule("touchorbit", "training")
  @ApiOperation({ summary: "Approve cancellation request" })
  async approveCancel(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const row = await this.trainingService.approveCancel(organizationId, id);
    return { ok: true, data: row };
  }

  @Post("assignments/:id/cancel-reject")
  @RequireModule("touchorbit", "training")
  @ApiOperation({ summary: "Reject cancellation request" })
  async rejectCancel(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const row = await this.trainingService.rejectCancel(organizationId, id);
    return { ok: true, data: row };
  }

  // Employee records
  @Get("employee-records")
  @RequireModule("touchorbit", "training")
  @ApiOperation({ summary: "List employee_training records (optionally filter by employee_id)" })
  async findEmployeeRecords(
    @CurrentOrganization() organizationId: string,
    @Query("employee_id") employeeId?: string,
  ) {
    if (!employeeId) {
      throw new BadRequestException("employee_id query parameter is required");
    }
    const rows = await this.trainingService.findEmployeeRecords(organizationId, employeeId);
    return { ok: true, data: rows };
  }

  @Post("employee-records")
  @RequireModule("touchorbit", "training")
  @ApiOperation({ summary: "Create an employee_training record" })
  async createEmployeeRecord(
    @CurrentOrganization() organizationId: string,
    @CurrentUser("id") userId: string,
    @Body() body: any,
  ) {
    if (!body.employee_id || !body.training_name || !body.start_date || !body.end_date) {
      throw new BadRequestException("employee_id, training_name, start_date, end_date are required");
    }
    const row = await this.trainingService.createEmployeeRecord(organizationId, userId, body);
    return { ok: true, data: row };
  }

  @Patch("employee-records/:id")
  @RequireModule("touchorbit", "training")
  @ApiOperation({ summary: "Update an employee_training record" })
  async updateEmployeeRecord(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const row = await this.trainingService.updateEmployeeRecord(organizationId, id, body);
    return { ok: true, data: row };
  }

  @Delete("employee-records/:id")
  @RequireModule("touchorbit", "training")
  @ApiOperation({ summary: "Delete an employee_training record" })
  async deleteEmployeeRecord(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const result = await this.trainingService.deleteEmployeeRecord(organizationId, id);
    return { ok: true, data: result };
  }

  // Employee overview
  @Get("employee/:employeeId")
  @RequireModule("touchorbit", "training")
  @ApiOperation({ summary: "Get training for an employee" })
  async findByEmployee(
    @CurrentOrganization() organizationId: string,
    @Param("employeeId") employeeId: string,
  ) {
    const rows = await this.trainingService.findByEmployee(organizationId, employeeId);
    return { ok: true, data: rows };
  }

  @Get("overview")
  @RequireModule("touchorbit", "training")
  @ApiOperation({ summary: "Training overview counts" })
  async overview(@CurrentOrganization() organizationId: string) {
    const data = await this.trainingService.overview(organizationId);
    return { ok: true, data };
  }
}
