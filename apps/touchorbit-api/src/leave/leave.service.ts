import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
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
              jsonb_build_object(
                'id', e.id,
                'first_name', e.first_name,
                'last_name', e.last_name,
                'job_title', e.job_title,
                'department', e.department,
                'department_id', e.department_id,
                'branch_id', e.branch_id,
                'photo_url', e.photo_url,
                'employee_number', e.employee_number
              ) AS employee,
              COALESCE(approvals.approvals, '[]'::jsonb) AS approvals
       FROM leave_records lr
       JOIN employees e ON e.id = lr.employee_id
       LEFT JOIN LATERAL (
         SELECT jsonb_agg(
           jsonb_build_object(
             'id', lra.id,
             'level', lra.level,
             'approver_role', lra.approver_role,
             'status', lra.status,
             'notes', lra.notes,
             'decided_at', lra.decided_at,
             'approver', jsonb_build_object(
               'first_name', au.first_name,
               'last_name', au.last_name
             )
           ) ORDER BY lra.level
         ) AS approvals
         FROM leave_request_approvals lra
         LEFT JOIN users au ON au.id = lra.approver_user_id
         WHERE lra.request_id = lr.id
       ) approvals ON true
       WHERE ${conditions.join(" AND ")}
       ORDER BY lr.created_at DESC`,
      values,
    );
    return result.rows;
  }

  async findRequestById(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `SELECT lr.*,
              jsonb_build_object(
                'id', e.id,
                'first_name', e.first_name,
                'last_name', e.last_name,
                'job_title', e.job_title,
                'department', e.department,
                'department_id', e.department_id,
                'branch_id', e.branch_id,
                'photo_url', e.photo_url,
                'employee_number', e.employee_number
              ) AS employee,
              COALESCE(approvals.approvals, '[]'::jsonb) AS approvals
       FROM leave_records lr
       JOIN employees e ON e.id = lr.employee_id
       LEFT JOIN LATERAL (
         SELECT jsonb_agg(
           jsonb_build_object(
             'id', lra.id,
             'level', lra.level,
             'approver_role', lra.approver_role,
             'status', lra.status,
             'notes', lra.notes,
             'decided_at', lra.decided_at,
             'approver', jsonb_build_object(
               'first_name', au.first_name,
               'last_name', au.last_name
             )
           ) ORDER BY lra.level
         ) AS approvals
         FROM leave_request_approvals lra
         LEFT JOIN users au ON au.id = lra.approver_user_id
         WHERE lra.request_id = lr.id
       ) approvals ON true
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
      await client.query(
        `SELECT set_config('touchorbit.current_user_id', $1, true)`,
        [input.userId],
      );
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

  async updateRequest(
    organizationId: string,
    id: string,
    input: {
      startDate?: string;
      endDate?: string;
      reason?: string;
      status?: string;
      cancellationRequested?: boolean;
    },
  ) {
    // Direct status/cancellation updates (e.g. cancellation approvals)
    if (input.status || input.cancellationRequested !== undefined) {
      const result = await this.databaseService.query(
        `UPDATE leave_records
         SET status = COALESCE($3, status),
             cancellation_requested = COALESCE($4, cancellation_requested),
             updated_at = now()
         WHERE id = $2::uuid AND organization_id = $1::uuid
         RETURNING *`,
        [
          organizationId,
          id,
          input.status ?? null,
          input.cancellationRequested ?? null,
        ],
      );
      if (result.rows.length === 0) {
        throw new NotFoundException("Leave request not found");
      }
      return result.rows[0];
    }

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
    approveAllLevels = false,
  ) {
    return this.advanceRequest(
      organizationId,
      id,
      userId,
      "approved",
      notes,
      approveAllLevels,
    );
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
    approveAllLevels = false,
  ) {
    const pendingLevels = await this.databaseService.query<{ level: number }>(
      `SELECT DISTINCT level FROM leave_request_approvals
       WHERE request_id = $1::uuid AND status = 'pending'
       ORDER BY level`,
      [id],
    );
    const levels =
      status === "approved" && approveAllLevels
        ? pendingLevels.rows.map((row) => row.level)
        : [pendingLevels.rows[0]?.level ?? 1];
    if (levels.length === 0) levels.push(1);

    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `SELECT set_config('touchorbit.current_user_id', $1, true)`,
        [userId],
      );
      let finalStatus: string = status;
      for (const level of levels) {
        const result = await client.query<{ advance_leave_request: string }>(
          `SELECT advance_leave_request($1::uuid, $2, $3, $4) AS advance_leave_request`,
          [id, level, status, notes ?? null],
        );
        finalStatus = result.rows[0].advance_leave_request;
      }
      await client.query("COMMIT");
      return { id, status: finalStatus };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findBalances(organizationId: string, employeeId?: string) {
    const conditions = ["lb.organization_id = $1::uuid"];
    const values: unknown[] = [organizationId];
    if (employeeId) {
      conditions.push("lb.employee_id = $2::uuid");
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
      days?: number;
      entitledDays?: number;
      reason?: string;
    },
    changedByUserId: string,
    changedByName: string,
  ) {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");
      const year = new Date().getFullYear();
      let balanceResult;
      if (input.entitledDays !== undefined) {
        balanceResult = await client.query(
          `UPDATE leave_balances
           SET entitled_days = $4
           WHERE organization_id = $1::uuid
             AND employee_id = $2::uuid
             AND leave_type = $3
             AND year = $5
           RETURNING *`,
          [
            organizationId,
            employeeId,
            input.leaveType,
            input.entitledDays,
            year,
          ],
        );
      } else {
        const days = input.days ?? 0;
        balanceResult = await client.query(
          `UPDATE leave_balances
           SET remaining_days = GREATEST(remaining_days + $4, 0)
           WHERE organization_id = $1::uuid
             AND employee_id = $2::uuid
             AND leave_type = $3
             AND year = $5
           RETURNING *`,
          [organizationId, employeeId, input.leaveType, days, year],
        );
      }
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
           jsonb_build_object(
             'leave_type', $6::text,
             'days', $7::numeric,
             'reason', $8::text
           )
         )`,
        [
          employeeId,
          organizationId,
          input.entitledDays !== undefined
            ? `Updated ${input.leaveType} entitlement to ${input.entitledDays} days`
            : `Adjusted ${input.leaveType} balance by ${input.days ?? 0} days`,
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

  async findCompOffRecords(
    organizationId: string,
    employeeId?: string,
    status?: string,
  ) {
    const conditions = ["c.organization_id = $1::uuid"];
    const values: unknown[] = [organizationId];
    if (employeeId) {
      values.push(employeeId);
      conditions.push(`c.employee_id = $${values.length}::uuid`);
    }
    if (status) {
      values.push(status);
      conditions.push(`c.status = $${values.length}`);
    }
    const result = await this.databaseService.query(
      `SELECT c.*,
              jsonb_build_object(
                'id', e.id,
                'first_name', e.first_name,
                'last_name', e.last_name,
                'employee_number', e.employee_number
              ) AS employees,
              jsonb_build_object(
                'id', h.id,
                'name', h.name,
                'date', h.date
              ) AS holidays
       FROM comp_off_records c
       JOIN employees e ON e.id = c.employee_id
       LEFT JOIN holidays h ON h.id = c.holiday_id
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
      status?: string;
    },
  ) {
    const result = await this.databaseService.query(
      `INSERT INTO comp_off_records (
         organization_id, employee_id, worked_date, holiday_id, notes, status
       )
       VALUES ($1::uuid, $2::uuid, $3::date, $4::uuid, $5, $6)
       RETURNING *`,
      [
        organizationId,
        input.employeeId,
        input.workedDate,
        input.holidayId ?? null,
        input.notes ?? null,
        input.status ?? "pending",
      ],
    );
    return result.rows[0];
  }

  async approveCompOffRecord(
    organizationId: string,
    id: string,
    userId: string,
  ) {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");
      const orgResult = await client.query(
        `SELECT comp_off_expiry_months FROM organizations WHERE id = $1::uuid`,
        [organizationId],
      );
      const expiryMonths = orgResult.rows[0]?.comp_off_expiry_months || 3;

      const recordResult = await client.query(
        `SELECT worked_date FROM comp_off_records WHERE id = $1::uuid AND organization_id = $2::uuid`,
        [id, organizationId],
      );
      if (recordResult.rows.length === 0) {
        throw new NotFoundException("Comp-off record not found");
      }

      const workedDate = new Date(recordResult.rows[0].worked_date);
      const expiryDate = new Date(workedDate);
      expiryDate.setMonth(expiryDate.getMonth() + expiryMonths);

      const result = await client.query(
        `UPDATE comp_off_records
         SET status = 'approved',
             approved_by = $3::uuid,
             approved_at = now(),
             expiry_date = $4::date,
             updated_at = now()
         WHERE id = $1::uuid AND organization_id = $2::uuid
         RETURNING *`,
        [id, organizationId, userId, expiryDate.toISOString().split("T")[0]],
      );
      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async rejectCompOffRecord(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `DELETE FROM comp_off_records
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING *`,
      [id, organizationId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Comp-off record not found");
    }
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
              jsonb_build_object(
                'id', e.id,
                'first_name', e.first_name,
                'last_name', e.last_name,
                'employee_number', e.employee_number
              ) AS employee
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
    const balanceResult = await this.databaseService.query(
      `SELECT remaining_days
       FROM leave_balances
       WHERE organization_id = $1::uuid
         AND employee_id = $2::uuid
         AND leave_type = 'annual'
         AND year = $3`,
      [organizationId, input.employeeId, input.year],
    );
    const remaining = Number(balanceResult.rows[0]?.remaining_days ?? 0);
    if (remaining < input.daysRequested) {
      throw new BadRequestException("Insufficient annual leave balance");
    }

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

  async approveEncashmentRequest(
    organizationId: string,
    id: string,
    userId: string,
  ) {
    const result = await this.databaseService.query(
      `UPDATE leave_encashment_requests
       SET status = 'approved',
           reviewed_at = now(),
           reviewed_by = $3::uuid,
           updated_at = now()
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING *`,
      [id, organizationId, userId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Encashment request not found");
    }
    return result.rows[0];
  }

  async rejectEncashmentRequest(
    organizationId: string,
    id: string,
    userId: string,
  ) {
    const result = await this.databaseService.query(
      `UPDATE leave_encashment_requests
       SET status = 'rejected',
           reviewed_at = now(),
           reviewed_by = $3::uuid,
           updated_at = now()
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING *`,
      [id, organizationId, userId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Encashment request not found");
    }
    return result.rows[0];
  }

  private calculateDays(startDate: string, endDate: string): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }
}
