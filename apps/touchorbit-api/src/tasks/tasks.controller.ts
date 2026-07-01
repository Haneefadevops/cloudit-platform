import {
  Controller,
  Get,
  Post,
  Headers,
  Query,
  BadRequestException,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { z } from "zod";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { Public } from "../common/decorators/public.decorator";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { DatabaseService } from "../database/database.service";
import { TaskReminderService } from "./task-reminder.service";

const limitSchema = z.coerce.number().int().min(1).max(500).default(100);

@ApiTags("employee-tasks")
@Controller("employee-tasks")
@UseGuards(SessionAuthGuard)
export class TasksController {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly taskReminderService: TaskReminderService,
  ) {}

  @Get()
  @RequireModule("touchorbit", "employees")
  @ApiOperation({ summary: "List employee tasks for the organization" })
  async findAll(@CurrentOrganization() organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT id, employee_id, title, description, status, due_date, reminder_at, created_at
       FROM employee_tasks
       WHERE organization_id = $1::uuid
       ORDER BY due_date ASC
       LIMIT 100`,
      [organizationId],
    );
    return { ok: true, data: result.rows };
  }

  @Post("internal/reminders")
  @Public()
  @ApiOperation({
    summary: "Internal cron endpoint to dispatch task reminders",
  })
  async dispatchReminders(
    @Query("limit") limitRaw: string | undefined,
    @Headers("x-cron-secret") secret: string | undefined,
  ) {
    this.taskReminderService.validateSecret(secret);
    const limit = limitSchema.parse(limitRaw ?? "100");
    const result = await this.taskReminderService.dispatch(limit);
    return { ok: true, data: result };
  }
}
