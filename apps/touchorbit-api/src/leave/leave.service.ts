import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

@Injectable()
export class LeaveService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findRequests(
    organizationId: string,
    filters: {
      employeeId?: string;
      status?: string;
      from?: string;
      to?: string;
    },
  ) {
    const conditions = ["lr.organization_id = $1::uuid"];
    const values: unknown[] = [organizationId];
    let paramIndex = 1;

    if (filters.employeeId) {
      paramIndex += 1;
      conditions.push(`lr.employee_id = $${paramIndex}::uuid`);
      values.push(filters.employeeId);
    }
    if (filters.status) {
      paramIndex += 1;
      conditions.push(`lr.status = $${paramIndex}`);
      values.push(filters.status);
    }
    if (filters.from) {
      paramIndex += 1;
      conditions.push(`lr.start_date >= $${paramIndex}::date`);
      values.push(filters.from);
    }
    if (filters.to) {
      paramIndex += 1;
      conditions.push(`lr.end_date <= $${paramIndex}::date`);
      values.push(filters.to);
    }

    const result = await this.databaseService.query(
      `SELECT lr.*,
              e.first_name || ' ' || e.last_name AS employee_name
       FROM leave_records lr
       JOIN employees e ON e.id = lr.employee_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY lr.created_at DESC`,
      values,
    );
    return result.rows;
  }

  async findRequestById(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `SELECT lr.*,
              e.first_name || ' ' || e.last_name AS employee_name
       FROM leave_records lr
       JOIN employees e ON e.id = lr.employee_id
       WHERE lr.id = $2::uuid AND lr.organization_id = $1::uuid`,
      [organizationId, id],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Leave request not found");
    }
    return result.rows[0];
  }

  async createRequest(
    organizationId: string,
    input: {
      employeeId: string;
      leaveType: string;
      startDate: string;
      endDate: string;
      reason?: string;
      userId: string;
    },
  ) {
    const daysCount = this.calculateDays(input.startDate, input.endDate);
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL touchorbit.current_user_id = $1`, [input.userId]);
      const insertResult = await client.query(
        `INSERT INTO leave_records (
           organization_id, employee_id, leave_type, start_date, end_date,
           days_count, reason, status
         )
         VALUES ($1::uuid, $2::uuid, $3, $4::date, $5::date, $6, $7, 'pending')
         RETURNING *`,
        [
          organizationId,
          input.employeeId,
          input.leaveType,
          input.startDate,
          input.endDate,
          daysCount,
          input.reason ?? null,
        ],
      );
      const record = insertResult.rows[0];
      await client.query("SELECT route_leave_request($1::uuid)", [record.id]);
      const refreshed = await client.query(
        `SELECT * FROM leave_records WHERE id = $1::uuid`,
        [record.id],
      );
      await client.query("COMMIT");
      return refreshed.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updatePendingRequest(
    organizationId: string,
    id: string,
    input: {
      startDate?: string;
      endDate?: string;
      reason?: string;
    },
  ) {
    const existing = await this.findRequestById(organizationId, id);
    if (existing.status !== "pending") {
      throw new NotFoundException("Only pending requests can be updated");
    }
    const startDate = input.startDate ?? existing.start_date;
    const endDate = input.endDate ?? existing.end_date;
    const daysCount = this.calculateDays(startDate, endDate);
    const result = await this.databaseService.query(
      `UPDATE leave_records
       SET start_date = $3::date,
           end_date = $4::date,
           days_count = $5,
           reason = COALESCE($6, reason),
           updated_at = now()
       WHERE id = $2::uuid AND organization_id = $1::uuid AND status = 'pending'
       RETURNING *`,
      [organizationId, id, startDate, endDate, daysCount, input.reason ?? null],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Leave request not found");
    }
    return result.rows[0];
  }

  async approveRequest(
    organizationId: string,
    id: string,
    userId: string,
    notes?: string,
  ) {
    return this.advanceRequest(organizationId, id, userId, "approved", notes);
  }

  async rejectRequest(
    organizationId: string,
    id: string,
    userId: string,
    notes?: string,
  ) {
    return this.advanceRequest(organizationId, id, userId, "rejected", notes);
  }

  private async advanceRequest(
    organizationId: string,
    id: string,
    userId: string,
    status: "approved" | "rejected",
    notes?: string,
  ) {
    const pendingLevel = await this.databaseService.query<{ level: number }>(
      `SELECT level FROM leave_request_approvals
       WHERE request_id = $1::uuid AND status = 'pending'
       ORDER BY level LIMIT 1`,
      [id],
    );
    const level = pendingLevel.rows[0]?.level ?? 1;

    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SET LOCAL touchorbit.current_user_id = $1`, [userId]);
      const result = await client.query<{ advance_leave_request: string }>(
        `SELECT advance_leave_request($1::uuid, $2, $3, $4) AS advance_leave_request`,
        [id, level, status, notes ?? null],
      );
      await client.query("COMMIT");
      return { id, status: result.rows[0].advance_leave_request };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findBalances(organizationId: string, employeeId?: string) {
    const conditions = ["organization_id = $1::uuid"];
    const values: unknown[] = [organizationId];
    if (employeeId) {
      conditions.push("employee_id = $2::uuid");
      values.push(employeeId);
    }
    const result = await this.databaseService.query(
      `SELECT lb.*,
              e.first_name || ' ' || e.last_name AS employee_name
       FROM leave_balances lb
       JOIN employees e ON e.id = lb.employee_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY lb.year DESC, lb.leave_type`,
      values,
    );
    return result.rows;
  }

  async findBalancesByEmployee(organizationId: string, employeeId: string) {
    const result = await this.databaseService.query(
      `SELECT lb.*,
              e.first_name || ' ' || e.last_name AS employee_name
       FROM leave_balances lb
       JOIN employees e ON e.id = lb.employee_id
       WHERE lb.organization_id = $1::uuid AND lb.employee_id = $2::uuid
       ORDER BY lb.year DESC, lb.leave_type`,
      [organizationId, employeeId],
    );
    return result.rows;
  }

  async adjustBalance(
    organizationId: string,
    employeeId: string,
    input: {
      leaveType: string;
      days: number;
      reason?: string;
    },
    changedByUserId: string,
    changedByName: string,
  ) {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");
      const year = new Date().getFullYear();
      const balanceResult = await client.query(
        `UPDATE leave_balances
         SET remaining_days = GREATEST(remaining_days + $4, 0)
         WHERE organization_id = $1::uuid
           AND employee_id = $2::uuid
           AND leave_type = $3
           AND year = $5
         RETURNING *`,
        [organizationId, employeeId, input.leaveType, input.days, year],
      );
      if (balanceResult.rows.length === 0) {
        throw new NotFoundException("Leave balance not found");
      }
      await client.query(
        `INSERT INTO employee_history (
           employee_id, organization_id, event_type, event_date,
           description, changed_by, changed_by_name, details
         )
         VALUES (
           $1::uuid, $2::uuid, 'leave_balance_adjusted', now(),
           $3, $4::uuid, $5,
           jsonb_build_object('leave_type', $6, 'days', $7, 'reason', $8)
         )`,
        [
          employeeId,
          organizationId,
          `Adjusted ${input.leaveType} balance by ${input.days} days`,
          changedByUserId,
          changedByName,
          input.leaveType,
          input.days,
          input.reason ?? null,
        ],
      );
      await client.query("COMMIT");
      return balanceResult.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findCompOffRecords(organizationId: string, employeeId?: string) {
    const conditions = ["c.organization_id = $1::uuid"];
    const values: unknown[] = [organizationId];
    if (employeeId) {
      conditions.push("c.employee_id = $2::uuid");
      values.push(employeeId);
    }
    const result = await this.databaseService.query(
      `SELECT c.*,
              e.first_name || ' ' || e.last_name AS employee_name
       FROM comp_off_records c
       JOIN employees e ON e.id = c.employee_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY c.worked_date DESC`,
      values,
    );
    return result.rows;
  }

  async createCompOffRecord(
    organizationId: string,
    input: {
      employeeId: string;
      workedDate: string;
      holidayId?: string;
      notes?: string;
    },
  ) {
    const result = await this.databaseService.query(
      `INSERT INTO comp_off_records (
         organization_id, employee_id, worked_date, holiday_id, notes, status
       )
       VALUES ($1::uuid, $2::uuid, $3::date, $4::uuid, $5, 'pending')
       RETURNING *`,
      [
        organizationId,
        input.employeeId,
        input.workedDate,
        input.holidayId ?? null,
        input.notes ?? null,
      ],
    );
    return result.rows[0];
  }

  async findEncashmentRequests(organizationId: string, employeeId?: string) {
    const conditions = ["er.organization_id = $1::uuid"];
    const values: unknown[] = [organizationId];
    if (employeeId) {
      conditions.push("er.employee_id = $2::uuid");
      values.push(employeeId);
    }
    const result = await this.databaseService.query(
      `SELECT er.*,
              e.first_name || ' ' || e.last_name AS employee_name
       FROM leave_encashment_requests er
       JOIN employees e ON e.id = er.employee_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY er.created_at DESC`,
      values,
    );
    return result.rows;
  }

  async createEncashmentRequest(
    organizationId: string,
    input: {
      employeeId: string;
      year: number;
      daysRequested: number;
      amount: number;
      reason?: string;
    },
  ) {
    const result = await this.databaseService.query(
      `INSERT INTO leave_encashment_requests (
         organization_id, employee_id, year, days_requested, amount, reason, status
       )
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [
        organizationId,
        input.employeeId,
        input.year,
        input.daysRequested,
        input.amount,
        input.reason ?? null,
      ],
    );
    return result.rows[0];
  }

  private calculateDays(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }
}
