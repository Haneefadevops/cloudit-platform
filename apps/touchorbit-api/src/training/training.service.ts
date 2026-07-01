import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class TrainingService {
  constructor(private readonly databaseService: DatabaseService) {}

  // Programs
  async findAll(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT id, title, description, category, total_hours, is_mandatory, created_at
       FROM training_programs
       WHERE organization_id = $1::uuid
       ORDER BY created_at DESC`,
      [organizationId],
    );
    return result.rows;
  }

  async createProgram(
    organizationId: string,
    input: {
      title: string;
      description?: string | null;
      category?: string | null;
      total_hours?: number | null;
      is_mandatory?: boolean;
    },
  ) {
    const result = await this.databaseService.query(
      `INSERT INTO training_programs (organization_id, title, description, category, total_hours, is_mandatory)
       VALUES ($1::uuid, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        organizationId,
        input.title,
        input.description ?? null,
        input.category ?? null,
        input.total_hours ?? null,
        input.is_mandatory ?? false,
      ],
    );
    return result.rows[0];
  }

  async updateProgram(
    organizationId: string,
    id: string,
    input: Partial<{
      title: string;
      description: string | null;
      category: string | null;
      total_hours: number | null;
      is_mandatory: boolean;
    }>,
  ) {
    const result = await this.databaseService.query(
      `UPDATE training_programs
       SET title = COALESCE($3, title),
           description = COALESCE($4, description),
           category = COALESCE($5, category),
           total_hours = COALESCE($6, total_hours),
           is_mandatory = COALESCE($7, is_mandatory)
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING *`,
      [
        id,
        organizationId,
        input.title ?? null,
        input.description ?? null,
        input.category ?? null,
        input.total_hours ?? null,
        input.is_mandatory ?? null,
      ],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Training program not found");
    }
    return result.rows[0];
  }

  async deleteProgram(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `DELETE FROM training_programs WHERE id = $1::uuid AND organization_id = $2::uuid RETURNING id`,
      [id, organizationId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Training program not found");
    }
    return { id: result.rows[0].id };
  }

  // Assignments
  async findAssignments(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT ta.*,
              jsonb_build_object('id', e.id, 'first_name', e.first_name, 'last_name', e.last_name, 'department', e.department) AS employee,
              jsonb_build_object('id', tp.id, 'title', tp.title) AS program
       FROM training_assignments ta
       JOIN employees e ON e.id = ta.employee_id
       JOIN training_programs tp ON tp.id = ta.program_id
       WHERE ta.organization_id = $1::uuid
       ORDER BY ta.assigned_at DESC`,
      [organizationId],
    );
    return result.rows;
  }

  async createAssignment(
    organizationId: string,
    input: {
      program_id: string;
      employee_id: string;
      start_date?: string | null;
      end_date?: string | null;
      start_time?: string | null;
      end_time?: string | null;
    },
  ) {
    // prevent duplicate active assignment for same program + employee
    const existing = await this.databaseService.query(
      `SELECT id FROM training_assignments
       WHERE organization_id = $1::uuid AND program_id = $2::uuid AND employee_id = $3::uuid
         AND status <> 'cancelled'`,
      [organizationId, input.program_id, input.employee_id],
    );
    if (existing.rows.length > 0) {
      throw new BadRequestException("Employee is already assigned to this program");
    }
    const result = await this.databaseService.query(
      `INSERT INTO training_assignments (
        organization_id, program_id, employee_id, start_date, end_date, start_time, end_time, status
      ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::date, $5::date, $6::time, $7::time, 'assigned')
      RETURNING *`,
      [
        organizationId,
        input.program_id,
        input.employee_id,
        input.start_date ?? null,
        input.end_date ?? null,
        input.start_time ?? null,
        input.end_time ?? null,
      ],
    );
    return result.rows[0];
  }

  async updateAssignment(
    organizationId: string,
    id: string,
    input: Partial<{
      start_date: string | null;
      end_date: string | null;
      start_time: string | null;
      end_time: string | null;
      status: string;
      reschedule_requested: boolean;
      reschedule_reason: string | null;
      reschedule_new_start_date: string | null;
      reschedule_new_end_date: string | null;
      cancel_requested: boolean;
      cancel_reason: string | null;
    }>,
  ) {
    const result = await this.databaseService.query(
      `UPDATE training_assignments
       SET start_date = COALESCE($3::date, start_date),
           end_date = COALESCE($4::date, end_date),
           start_time = COALESCE($5::time, start_time),
           end_time = COALESCE($6::time, end_time),
           status = COALESCE($7, status),
           reschedule_requested = COALESCE($8, reschedule_requested),
           reschedule_reason = COALESCE($9, reschedule_reason),
           reschedule_new_start_date = COALESCE($10::date, reschedule_new_start_date),
           reschedule_new_end_date = COALESCE($11::date, reschedule_new_end_date),
           cancel_requested = COALESCE($12, cancel_requested),
           cancel_reason = COALESCE($13, cancel_reason)
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING *`,
      [
        id,
        organizationId,
        input.start_date ?? null,
        input.end_date ?? null,
        input.start_time ?? null,
        input.end_time ?? null,
        input.status ?? null,
        input.reschedule_requested ?? null,
        input.reschedule_reason ?? null,
        input.reschedule_new_start_date ?? null,
        input.reschedule_new_end_date ?? null,
        input.cancel_requested ?? null,
        input.cancel_reason ?? null,
      ],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Training assignment not found");
    }
    return result.rows[0];
  }

  async approveReschedule(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `UPDATE training_assignments
       SET start_date = COALESCE(reschedule_new_start_date, start_date),
           end_date = COALESCE(reschedule_new_end_date, end_date),
           reschedule_requested = false,
           reschedule_new_start_date = null,
           reschedule_new_end_date = null,
           reschedule_reason = null
       WHERE id = $1::uuid AND organization_id = $2::uuid AND reschedule_requested = true
       RETURNING *`,
      [id, organizationId],
    );
    if (result.rows.length === 0) {
      throw new BadRequestException("Reschedule request not found or already processed");
    }
    return result.rows[0];
  }

  async rejectReschedule(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `UPDATE training_assignments
       SET reschedule_requested = false,
           reschedule_new_start_date = null,
           reschedule_new_end_date = null,
           reschedule_reason = null
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING *`,
      [id, organizationId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Training assignment not found");
    }
    return result.rows[0];
  }

  async approveCancel(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `UPDATE training_assignments
       SET status = 'cancelled',
           cancel_requested = false,
           cancel_reason = null
       WHERE id = $1::uuid AND organization_id = $2::uuid AND cancel_requested = true
       RETURNING *`,
      [id, organizationId],
    );
    if (result.rows.length === 0) {
      throw new BadRequestException("Cancel request not found or already processed");
    }
    return result.rows[0];
  }

  async rejectCancel(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `UPDATE training_assignments
       SET cancel_requested = false,
           cancel_reason = null
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING *`,
      [id, organizationId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Training assignment not found");
    }
    return result.rows[0];
  }

  // Employee records (employee_training)
  async findEmployeeRecords(organizationId: string, employeeId: string) {
    const result = await this.databaseService.query(
      `SELECT * FROM employee_training
       WHERE organization_id = $1::uuid AND employee_id = $2::uuid
       ORDER BY start_date DESC`,
      [organizationId, employeeId],
    );
    return result.rows;
  }

  async createEmployeeRecord(
    organizationId: string,
    userId: string,
    input: {
      employee_id: string;
      training_name: string;
      description?: string | null;
      start_date: string;
      end_date: string;
    },
  ) {
    const result = await this.databaseService.query(
      `INSERT INTO employee_training (organization_id, employee_id, training_name, description, start_date, end_date, created_by)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5::date, $6::date, $7)
       RETURNING *`,
      [
        organizationId,
        input.employee_id,
        input.training_name,
        input.description ?? null,
        input.start_date,
        input.end_date,
        userId,
      ],
    );
    return result.rows[0];
  }

  async updateEmployeeRecord(
    organizationId: string,
    id: string,
    input: Partial<{
      training_name: string;
      description: string | null;
      start_date: string;
      end_date: string;
    }>,
  ) {
    const result = await this.databaseService.query(
      `UPDATE employee_training
       SET training_name = COALESCE($3, training_name),
           description = COALESCE($4, description),
           start_date = COALESCE($5::date, start_date),
           end_date = COALESCE($6::date, end_date)
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING *`,
      [
        id,
        organizationId,
        input.training_name ?? null,
        input.description ?? null,
        input.start_date ?? null,
        input.end_date ?? null,
      ],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Training record not found");
    }
    return result.rows[0];
  }

  async deleteEmployeeRecord(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `DELETE FROM employee_training WHERE id = $1::uuid AND organization_id = $2::uuid RETURNING id`,
      [id, organizationId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Training record not found");
    }
    return { id: result.rows[0].id };
  }

  // Employee training overview
  async findByEmployee(
    organizationId: string,
    employeeId: string,
    start?: string,
    end?: string,
  ) {
    const rangeCond =
      start && end
        ? ` AND ((et.start_date <= $4::date AND et.end_date >= $3::date) OR (ta.start_date <= $4::date AND ta.end_date >= $3::date))`
        : "";
    const values: unknown[] = [organizationId, employeeId];
    if (start && end) {
      values.push(start, end);
    }
    const [personalRes, assignedRes] = await Promise.all([
      this.databaseService.query(
        `SELECT et.* FROM employee_training et
         WHERE et.organization_id = $1::uuid AND et.employee_id = $2::uuid${rangeCond}
         ORDER BY et.start_date DESC`,
        values,
      ),
      this.databaseService.query(
        `SELECT ta.*,
                jsonb_build_object('id', tp.id, 'title', tp.title, 'description', tp.description, 'category', tp.category) AS program
         FROM training_assignments ta
         JOIN training_programs tp ON tp.id = ta.program_id
         WHERE ta.organization_id = $1::uuid AND ta.employee_id = $2::uuid
           AND ta.status <> 'cancelled'${rangeCond}
         ORDER BY ta.start_date DESC`,
        values,
      ),
    ]);
    return { personal: personalRes.rows, assigned: assignedRes.rows };
  }

  // Calendar use (flattened merged view)
  async findCalendarTrainingEvents(
    organizationId: string,
    start: string,
    end: string,
  ) {
    const [selfRes, assignedRes] = await Promise.all([
      this.databaseService.query(
        `SELECT et.id, et.employee_id, et.training_name AS title, et.description,
                et.start_date, et.end_date,
                jsonb_build_object('first_name', e.first_name, 'last_name', e.last_name) AS employee
         FROM employee_training et
         JOIN employees e ON e.id = et.employee_id
         WHERE et.organization_id = $1::uuid
           AND et.start_date <= $3::date AND et.end_date >= $2::date`,
        [organizationId, start, end],
      ),
      this.databaseService.query(
        `SELECT ta.id, ta.employee_id, ta.start_date, ta.end_date,
                tp.title, tp.description,
                jsonb_build_object('first_name', e.first_name, 'last_name', e.last_name) AS employee
         FROM training_assignments ta
         JOIN training_programs tp ON tp.id = ta.program_id
         JOIN employees e ON e.id = ta.employee_id
         WHERE ta.organization_id = $1::uuid
           AND ta.status <> 'cancelled'
           AND ta.start_date <= $3::date AND ta.end_date >= $2::date`,
        [organizationId, start, end],
      ),
    ]);
    const self = selfRes.rows.map((t: any) => ({
      ...t,
      title: `${t.title} — ${t.employee?.first_name || ""} ${t.employee?.last_name || ""}`,
    }));
    const assigned = assignedRes.rows.map((t: any) => ({
      ...t,
      title: `${t.title} — ${t.employee?.first_name || ""} ${t.employee?.last_name || ""}`,
    }));
    return [...self, ...assigned];
  }

  async overview(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT status, reschedule_requested FROM training_assignments
       WHERE organization_id = $1::uuid AND status <> 'cancelled'`,
      [organizationId],
    );
    let assigned = 0,
      inProgress = 0,
      completed = 0,
      rescheduleRequests = 0;
    for (const r of result.rows) {
      if (r.status === "assigned") assigned++;
      else if (r.status === "in_progress") inProgress++;
      else if (r.status === "completed") completed++;
      if (r.reschedule_requested) rescheduleRequests++;
    }
    return { assigned, inProgress, completed, rescheduleRequests };
  }
}
