import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type { AuthContext } from "../auth/types";

@Injectable()
export class OvertimeService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(
    organizationId: string,
    user: AuthContext,
    employeeId?: string,
  ) {
    const values: unknown[] = [organizationId];
    const conditions = ["o.organization_id = $1::uuid"];
    if (user.role === "employee") {
      values.push(user.id);
      conditions.push(`e.user_id = $${values.length}::uuid`);
    } else if (employeeId) {
      values.push(employeeId);
      conditions.push(`o.employee_id = $${values.length}::uuid`);
    }
    const result = await this.databaseService.query(
      `SELECT o.*,
              jsonb_build_object(
                'id', e.id,
                'first_name', e.first_name,
                'last_name', e.last_name,
                'employee_number', e.employee_number
              ) AS employees
       FROM overtime_records o
       JOIN employees e ON e.id = o.employee_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY o.date DESC, o.created_at DESC`,
      values,
    );
    return result.rows;
  }

  async create(
    organizationId: string,
    user: AuthContext,
    input: {
      employeeId: string;
      date: string;
      startTime?: string;
      endTime?: string;
      hours: number;
      rate: number;
      reason?: string;
    },
  ) {
    const employee = await this.databaseService.query<{ user_id: string | null }>(
      `SELECT user_id
       FROM employees
       WHERE id = $1::uuid AND organization_id = $2::uuid`,
      [input.employeeId, organizationId],
    );
    if (employee.rows.length === 0) {
      throw new NotFoundException("Employee not found");
    }
    if (user.role === "employee" && employee.rows[0].user_id !== user.id) {
      throw new ForbiddenException("Cannot create overtime for another employee");
    }
    const result = await this.databaseService.query(
      `INSERT INTO overtime_records (
         organization_id, employee_id, date, start_time, end_time,
         hours, rate, reason, status
       )
       VALUES ($1::uuid, $2::uuid, $3::date, $4::time, $5::time, $6, $7, $8, 'pending')
       RETURNING *`,
      [
        organizationId,
        input.employeeId,
        input.date,
        input.startTime ?? null,
        input.endTime ?? null,
        input.hours,
        input.rate,
        input.reason ?? null,
      ],
    );
    return result.rows[0];
  }
}
