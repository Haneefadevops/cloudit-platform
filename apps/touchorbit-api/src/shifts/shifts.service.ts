import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class ShiftsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT id, organization_id, name, start_time, end_time, break_minutes, grace_period_minutes,
              color, status, department_id, branch_id, created_at, updated_at
       FROM shifts
       WHERE organization_id = $1::uuid
       ORDER BY name`,
      [organizationId],
    );
    return result.rows;
  }

  async create(
    organizationId: string,
    input: {
      name: string;
      startTime: string;
      endTime: string;
      breakDuration?: number;
      color?: string;
      isNightShift?: boolean;
    },
  ) {
    const result = await this.databaseService.query(
      `INSERT INTO shifts (
         organization_id, name, start_time, end_time, break_minutes, color
       )
       VALUES ($1::uuid, $2, $3::time, $4::time, $5, $6)
       RETURNING *`,
      [
        organizationId,
        input.name,
        input.startTime,
        input.endTime,
        input.breakDuration ?? 0,
        input.color ?? "#8B5CF6",
      ],
    );
    return result.rows[0];
  }

  async findOne(organizationId: string, shiftId: string) {
    const result = await this.databaseService.query(
      `SELECT id, organization_id, name, start_time, end_time, break_minutes, grace_period_minutes,
              color, status, department_id, branch_id, created_at, updated_at
       FROM shifts
       WHERE id = $1::uuid AND organization_id = $2::uuid`,
      [shiftId, organizationId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Shift not found");
    }
    return result.rows[0];
  }

  async update(
    organizationId: string,
    shiftId: string,
    input: {
      name?: string;
      startTime?: string;
      endTime?: string;
      breakDuration?: number;
      color?: string;
      isNightShift?: boolean;
      status?: "active" | "inactive";
    },
  ) {
    const result = await this.databaseService.query(
      `UPDATE shifts
       SET name = COALESCE($3, name),
           start_time = COALESCE($4::time, start_time),
           end_time = COALESCE($5::time, end_time),
           break_minutes = COALESCE($6, break_minutes),
           color = COALESCE($7, color),
           status = COALESCE($8, status),
           updated_at = now()
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING *`,
      [
        shiftId,
        organizationId,
        input.name ?? null,
        input.startTime ?? null,
        input.endTime ?? null,
        input.breakDuration ?? null,
        input.color ?? null,
        input.status ?? null,
      ],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Shift not found");
    }
    return result.rows[0];
  }

  async delete(organizationId: string, shiftId: string) {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");

      const usage = await client.query(
        `SELECT
           (SELECT COUNT(*) FROM roster_assignments WHERE shift_id = $1::uuid AND organization_id = $2::uuid) AS roster_count,
           (SELECT COUNT(*) FROM employee_shifts WHERE shift_id = $1::uuid AND organization_id = $2::uuid) AS employee_count`,
        [shiftId, organizationId],
      );
      const { roster_count, employee_count } = usage.rows[0];
      if (Number(roster_count) > 0 || Number(employee_count) > 0) {
        throw new ConflictException("Shift is in use and cannot be deleted");
      }

      const result = await client.query(
        `DELETE FROM shifts
         WHERE id = $1::uuid AND organization_id = $2::uuid
         RETURNING id`,
        [shiftId, organizationId],
      );
      if (result.rows.length === 0) {
        throw new NotFoundException("Shift not found");
      }

      await client.query("COMMIT");
      return { deleted: true, id: result.rows[0].id };
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async findAllTemplates(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT id, organization_id, name, start_time, end_time, break_minutes,
              department_id, branch_id, is_active, created_at
       FROM shift_templates
       WHERE organization_id = $1::uuid
       ORDER BY name`,
      [organizationId],
    );
    return result.rows;
  }

  async createTemplate(
    organizationId: string,
    input: {
      name: string;
      startTime: string;
      endTime: string;
      breakDuration?: number;
      departmentId?: string;
      branchId?: string;
    },
  ) {
    const result = await this.databaseService.query(
      `INSERT INTO shift_templates (
         organization_id, name, start_time, end_time, break_minutes,
         department_id, branch_id
       )
       VALUES ($1::uuid, $2, $3::time, $4::time, $5, $6::uuid, $7::uuid)
       RETURNING *`,
      [
        organizationId,
        input.name,
        input.startTime,
        input.endTime,
        input.breakDuration ?? 0,
        input.departmentId ?? null,
        input.branchId ?? null,
      ],
    );
    return result.rows[0];
  }
}
