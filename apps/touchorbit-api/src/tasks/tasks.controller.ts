import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Headers,
  Query,
  Body,
  Param,
  BadRequestException,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { z } from "zod";
import { SessionAuthGuard } from "../common/guards/session-auth.guard";
import { Public } from "../common/decorators/public.decorator";
import { RequireModule } from "../common/decorators/require-module.decorator";
import { CurrentOrganization } from "../common/decorators/current-organization.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { DatabaseService } from "../database/database.service";
import { TaskReminderService } from "./task-reminder.service";

const limitSchema = z.coerce.number().int().min(1).max(500).default(100);

const taskInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  category: z.enum(["work", "personal", "training", "compliance"]).default("work"),
  due_date: z.string().optional().nullable(),
  reminder_minutes: z.coerce.number().int().optional().nullable(),
  is_recurring: z.boolean().default(false),
  recurrence_rule: z.string().optional().nullable(),
  employee_id: z.string().uuid().optional().nullable(),
});

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
  async findAll(
    @CurrentOrganization() organizationId: string,
    @Query("status") status?: string,
    @Query("limit") limitRaw?: string,
  ) {
    const limit = limitSchema.parse(limitRaw ?? "100");
    const conditions = ["et.organization_id = $1::uuid"];
    const values: unknown[] = [organizationId];
    if (status) {
      conditions.push(`et.status = $${values.length + 1}`);
      values.push(status);
    }
    const result = await this.databaseService.query(
      `SELECT et.id, et.employee_id, et.title, et.description, et.category, et.due_date,
              et.status, et.is_recurring, et.completed_at, et.created_at,
              jsonb_build_object('id', e.id, 'first_name', e.first_name, 'last_name', e.last_name, 'department', e.department) AS employee,
              jsonb_build_object('id', u.id, 'first_name', u.first_name, 'last_name', u.last_name) AS assigner
       FROM employee_tasks et
       LEFT JOIN employees e ON e.id = et.employee_id
       LEFT JOIN users u ON u.id = et.assigned_by
       WHERE ${conditions.join(" AND ")}
       ORDER BY et.due_date ASC NULLS LAST
       LIMIT $${values.length + 1}`,
      [...values, limit],
    );
    return { ok: true, data: result.rows };
  }

  @Get("my")
  @RequireModule("touchorbit", "employees")
  @ApiOperation({ summary: "List tasks for the current employee" })
  async findMy(
    @CurrentOrganization() organizationId: string,
    @CurrentUser("id") userId: string,
    @Query("status") status?: string,
  ) {
    const conditions = [
      "et.organization_id = $1::uuid",
      "e.user_id = $2::uuid",
    ];
    const values: unknown[] = [organizationId, userId];
    if (status) {
      conditions.push(`et.status = $${values.length + 1}`);
      values.push(status);
    }
    const result = await this.databaseService.query(
      `SELECT et.id, et.employee_id, et.title, et.description, et.category, et.due_date,
              et.status, et.is_recurring, et.completed_at, et.created_at,
              jsonb_build_object('id', u.id, 'first_name', u.first_name, 'last_name', u.last_name) AS assigner
       FROM employee_tasks et
       JOIN employees e ON e.id = et.employee_id
       LEFT JOIN users u ON u.id = et.assigned_by
       WHERE ${conditions.join(" AND ")}
       ORDER BY et.due_date ASC NULLS LAST
       LIMIT 100`,
      values,
    );
    return { ok: true, data: result.rows };
  }

  @Post()
  @RequireModule("touchorbit", "employees")
  @ApiOperation({ summary: "Create an employee task" })
  async create(
    @CurrentOrganization() organizationId: string,
    @CurrentUser("id") userId: string,
    @Body() body: any,
  ) {
    const input = taskInputSchema.parse(body);
    let employeeId = input.employee_id;
    if (!employeeId) {
      const emp = await this.databaseService.query(
        `SELECT id FROM employees WHERE user_id = $1::uuid AND organization_id = $2::uuid`,
        [userId, organizationId],
      );
      if (emp.rows.length === 0) {
        throw new BadRequestException("No employee record linked to this user");
      }
      employeeId = emp.rows[0].id;
    }
    const result = await this.databaseService.query(
      `INSERT INTO employee_tasks (
        organization_id, employee_id, assigned_by, title, description, category,
        due_date, reminder_minutes, is_recurring, recurrence_rule, status
      ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7::timestamptz, $8, $9, $10, 'pending')
      RETURNING *`,
      [
        organizationId,
        employeeId,
        userId,
        input.title,
        input.description ?? null,
        input.category,
        input.due_date ? new Date(input.due_date).toISOString() : null,
        input.reminder_minutes ?? null,
        input.is_recurring,
        input.recurrence_rule ?? null,
      ],
    );
    return { ok: true, data: result.rows[0] };
  }

  @Patch(":id")
  @RequireModule("touchorbit", "employees")
  @ApiOperation({ summary: "Update an employee task" })
  async update(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
    @Body() body: any,
  ) {
    const input = taskInputSchema.partial().parse(body);
    const result = await this.databaseService.query(
      `UPDATE employee_tasks
       SET title = COALESCE($3, title),
           description = COALESCE($4, description),
           category = COALESCE($5, category),
           due_date = COALESCE($6::timestamptz, due_date),
           reminder_minutes = COALESCE($7, reminder_minutes),
           is_recurring = COALESCE($8, is_recurring),
           recurrence_rule = COALESCE($9, recurrence_rule),
           employee_id = COALESCE($10::uuid, employee_id),
           updated_at = now()
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING *`,
      [
        id,
        organizationId,
        input.title ?? null,
        input.description ?? null,
        input.category ?? null,
        input.due_date ? new Date(input.due_date).toISOString() : null,
        input.reminder_minutes ?? null,
        input.is_recurring ?? null,
        input.recurrence_rule ?? null,
        input.employee_id ?? null,
      ],
    );
    if (result.rows.length === 0) {
      throw new BadRequestException("Task not found");
    }
    return { ok: true, data: result.rows[0] };
  }

  @Patch(":id/complete")
  @RequireModule("touchorbit", "employees")
  @ApiOperation({ summary: "Mark a task as completed" })
  async complete(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const result = await this.databaseService.query(
      `UPDATE employee_tasks
       SET status = 'completed', completed_at = now(), updated_at = now()
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING *`,
      [id, organizationId],
    );
    if (result.rows.length === 0) {
      throw new BadRequestException("Task not found");
    }
    return { ok: true, data: result.rows[0] };
  }

  @Delete(":id")
  @RequireModule("touchorbit", "employees")
  @ApiOperation({ summary: "Delete an employee task" })
  async delete(
    @CurrentOrganization() organizationId: string,
    @Param("id") id: string,
  ) {
    const result = await this.databaseService.query(
      `DELETE FROM employee_tasks WHERE id = $1::uuid AND organization_id = $2::uuid RETURNING id`,
      [id, organizationId],
    );
    if (result.rows.length === 0) {
      throw new BadRequestException("Task not found");
    }
    return { ok: true, data: { id: result.rows[0].id } };
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
