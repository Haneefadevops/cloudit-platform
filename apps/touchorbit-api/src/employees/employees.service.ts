import { Injectable, NotFoundException } from "@nestjs/common";
import bcrypt from "bcryptjs";
import { DatabaseService } from "../database/database.service";
import { StorageService } from "../storage/storage.service";

export interface Actor {
  id: string;
  name: string;
}

export interface ListEmployeesFilters {
  status?: string;
  departmentId?: string;
  search?: string;
  limit: number;
  offset: number;
}

export interface CreateEmployeeInput {
  first_name: string;
  last_name: string;
  email: string;
  employee_number?: string;
  department_id?: string;
  branch_id?: string;
  job_title?: string;
  hire_date?: string;
  employment_status?: string;
  manager_id?: string;
}

export interface UpdateEmployeeInput {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  department_id?: string;
  branch_id?: string;
  job_title?: string;
  hire_date?: string;
  employment_status?: string;
  manager_id?: string;
  basic_salary?: number;
}

export interface TerminateEmployeeInput {
  termination_date?: string;
  termination_reason?: string;
  last_working_day?: string;
}

export interface EmergencyContactInput {
  name: string;
  relationship: string;
  phone: string;
  email?: string;
  is_primary?: boolean;
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly storageService: StorageService,
  ) {}

  async findAll(organizationId: string, filters: ListEmployeesFilters) {
    const params: unknown[] = [organizationId];
    const conditions = ["e.organization_id = $1::uuid"];

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`e.employment_status = $${params.length}`);
    }

    if (filters.departmentId) {
      params.push(filters.departmentId);
      conditions.push(`e.department_id = $${params.length}::uuid`);
    }

    if (filters.search) {
      params.push(`%${filters.search}%`);
      conditions.push(
        `(e.first_name ILIKE $${params.length} OR e.last_name ILIKE $${params.length} OR e.email ILIKE $${params.length})`,
      );
    }

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;
    params.push(filters.limit, filters.offset);

    const result = await this.databaseService.query(
      `SELECT
         e.*,
         d.name AS department_name,
         b.name AS branch_name,
         COALESCE(m.first_name || ' ' || m.last_name, '') AS manager_name
       FROM employees e
       LEFT JOIN departments d
         ON d.id = e.department_id AND d.organization_id = e.organization_id
       LEFT JOIN branches b
         ON b.id = e.branch_id AND b.organization_id = e.organization_id
       LEFT JOIN employees m
         ON m.id = e.manager_id AND m.organization_id = e.organization_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY e.created_at DESC
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      params,
    );

    return result.rows;
  }

  async findOne(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `SELECT
         e.*,
         d.name AS department_name,
         b.name AS branch_name,
         COALESCE(m.first_name || ' ' || m.last_name, '') AS manager_name
       FROM employees e
       LEFT JOIN departments d
         ON d.id = e.department_id AND d.organization_id = e.organization_id
       LEFT JOIN branches b
         ON b.id = e.branch_id AND b.organization_id = e.organization_id
       LEFT JOIN employees m
         ON m.id = e.manager_id AND m.organization_id = e.organization_id
       WHERE e.id = $1::uuid AND e.organization_id = $2::uuid`,
      [id, organizationId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException("Employee not found");
    }

    return result.rows[0];
  }

  async create(
    organizationId: string,
    actor: Actor,
    input: CreateEmployeeInput,
  ) {
    const client = await this.databaseService.connect();

    try {
      await client.query("BEGIN");

      const countResult = await client.query(
        `SELECT COUNT(*)::int AS count FROM employees WHERE organization_id = $1::uuid`,
        [organizationId],
      );
      const nextNumber = (countResult.rows[0]?.count ?? 0) + 1;
      const employeeNumber = input.employee_number ?? `EMP-${nextNumber}`;

      const userResult = await client.query(
        `INSERT INTO users (
           organization_id, email, password_hash, first_name, last_name, role, is_active
         )
         VALUES ($1::uuid, $2, NULL, $3, $4, 'employee', true)
         RETURNING id`,
        [
          organizationId,
          input.email.toLowerCase().trim(),
          input.first_name,
          input.last_name,
        ],
      );
      const userId = userResult.rows[0].id as string;

      const employeeResult = await client.query(
        `INSERT INTO employees (
           organization_id, user_id, employee_number, first_name, last_name, email,
           department_id, branch_id, job_title, hire_date, employment_status, manager_id
         )
         VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7::uuid, $8::uuid, $9, $10, $11, $12::uuid)
         RETURNING *`,
        [
          organizationId,
          userId,
          employeeNumber,
          input.first_name,
          input.last_name,
          input.email.toLowerCase().trim(),
          input.department_id ?? null,
          input.branch_id ?? null,
          input.job_title ?? null,
          input.hire_date ?? null,
          input.employment_status ?? "active",
          input.manager_id ?? null,
        ],
      );
      const employee = employeeResult.rows[0];

      await client.query(
        `INSERT INTO employee_history (
           employee_id, organization_id, event_type, description, changed_by, changed_by_name, details
         )
         VALUES ($1::uuid, $2::uuid, 'created', 'Employee record created', $3::uuid, $4, $5)`,
        [
          employee.id,
          organizationId,
          actor.id,
          actor.name,
          JSON.stringify({ user_id: userId, employee_number: employeeNumber }),
        ],
      );

      await client.query("COMMIT");
      return employee;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async update(
    organizationId: string,
    actor: Actor,
    id: string,
    input: UpdateEmployeeInput,
  ) {
    const current = await this.findOne(organizationId, id);
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    const setClauses: string[] = [];
    const params: unknown[] = [id, organizationId];

    const add = (column: string, value: unknown, from: unknown) => {
      if (value !== undefined) {
        params.push(value);
        setClauses.push(`${column} = $${params.length}`);
        if (value !== from) {
          changes[column] = { from, to: value };
        }
      }
    };

    add("first_name", input.first_name, current.first_name);
    add("last_name", input.last_name, current.last_name);
    add("email", input.email?.toLowerCase().trim(), current.email);
    add("phone", input.phone, current.phone);
    add("department_id", input.department_id, current.department_id);
    add("branch_id", input.branch_id, current.branch_id);
    add("job_title", input.job_title, current.job_title);
    add("hire_date", input.hire_date, current.hire_date);
    add(
      "employment_status",
      input.employment_status,
      current.employment_status,
    );
    add("manager_id", input.manager_id, current.manager_id);
    add("basic_salary", input.basic_salary, current.basic_salary);

    if (setClauses.length === 0) {
      return current;
    }

    setClauses.push("updated_at = now()");

    const sql = `UPDATE employees
                 SET ${setClauses.join(", ")}
                 WHERE id = $1::uuid AND organization_id = $2::uuid
                 RETURNING *`;

    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");

      const updateResult = await client.query(sql, params);
      const employee = updateResult.rows[0];

      await client.query(
        `INSERT INTO employee_history (
           employee_id, organization_id, event_type, description, changed_by, changed_by_name, details
         )
         VALUES ($1::uuid, $2::uuid, 'updated', 'Employee record updated', $3::uuid, $4, $5)`,
        [
          id,
          organizationId,
          actor.id,
          actor.name,
          JSON.stringify({ changed: changes }),
        ],
      );

      await client.query("COMMIT");
      return employee;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async terminate(
    organizationId: string,
    actor: Actor,
    id: string,
    input: TerminateEmployeeInput,
  ) {
    const client = await this.databaseService.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `UPDATE employees
         SET employment_status = 'terminated',
             termination_date = COALESCE($3, CURRENT_DATE),
             termination_reason = $4,
             last_working_day = $5,
             terminated_by = $6::uuid,
             updated_at = now()
         WHERE id = $1::uuid AND organization_id = $2::uuid
         RETURNING *`,
        [
          id,
          organizationId,
          input.termination_date ?? null,
          input.termination_reason ?? null,
          input.last_working_day ?? null,
          actor.id,
        ],
      );

      if (result.rows.length === 0) {
        throw new NotFoundException("Employee not found");
      }

      const employee = result.rows[0];

      if (employee.user_id) {
        await client.query(
          `UPDATE users SET is_active = false WHERE id = $1::uuid`,
          [employee.user_id],
        );
      }

      await client.query(
        `INSERT INTO employee_history (
           employee_id, organization_id, event_type, description, changed_by, changed_by_name, details
         )
         VALUES ($1::uuid, $2::uuid, 'terminated', 'Employee terminated', $3::uuid, $4, $5)`,
        [
          id,
          organizationId,
          actor.id,
          actor.name,
          JSON.stringify({
            termination_date: input.termination_date,
            termination_reason: input.termination_reason,
            last_working_day: input.last_working_day,
          }),
        ],
      );

      await client.query("COMMIT");
      return employee;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async toggleAccess(
    organizationId: string,
    actor: Actor,
    id: string,
    enabled: boolean,
  ) {
    const client = await this.databaseService.connect();

    try {
      await client.query("BEGIN");

      const employeeResult = await client.query(
        `SELECT id, user_id FROM employees WHERE id = $1::uuid AND organization_id = $2::uuid`,
        [id, organizationId],
      );

      if (employeeResult.rows.length === 0) {
        throw new NotFoundException("Employee not found");
      }

      const userId = employeeResult.rows[0].user_id as string | undefined;
      if (!userId) {
        throw new NotFoundException("Employee has no linked user account");
      }

      await client.query(
        `UPDATE users SET is_active = $1 WHERE id = $2::uuid`,
        [enabled, userId],
      );

      await client.query(
        `INSERT INTO employee_history (
           employee_id, organization_id, event_type, description, changed_by, changed_by_name, details
         )
         VALUES ($1::uuid, $2::uuid, 'access_toggled', $3, $4::uuid, $5, $6)`,
        [
          id,
          organizationId,
          `Account access ${enabled ? "enabled" : "disabled"}`,
          actor.id,
          actor.name,
          JSON.stringify({ is_active: enabled }),
        ],
      );

      await client.query("COMMIT");
      return { enabled };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async resetPassword(organizationId: string, id: string, password: string) {
    const result = await this.databaseService.query(
      `SELECT user_id FROM employees WHERE id = $1::uuid AND organization_id = $2::uuid`,
      [id, organizationId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException("Employee not found");
    }

    const userId = result.rows[0].user_id as string | undefined;
    if (!userId) {
      throw new NotFoundException("Employee has no linked user account");
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await this.databaseService.query(
      `UPDATE users SET password_hash = $1, is_active = true WHERE id = $2::uuid`,
      [passwordHash, userId],
    );

    return { reset: true };
  }

  async uploadPhoto(
    organizationId: string,
    id: string,
    bucket: string,
    key: string,
    contentType: string,
  ) {
    const result = await this.databaseService.query(
      `SELECT id FROM employees WHERE id = $1::uuid AND organization_id = $2::uuid`,
      [id, organizationId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException("Employee not found");
    }

    const { url, publicUrl } = await this.storageService.presignedUpload(
      bucket,
      key,
      contentType,
    );

    const updateResult = await this.databaseService.query(
      `UPDATE employees SET photo_url = $1, updated_at = now()
       WHERE id = $2::uuid AND organization_id = $3::uuid
       RETURNING *`,
      [publicUrl, id, organizationId],
    );

    return { uploadUrl: url, publicUrl, employee: updateResult.rows[0] };
  }

  async findHistory(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `SELECT h.*
       FROM employee_history h
       JOIN employees e ON e.id = h.employee_id
       WHERE h.employee_id = $1::uuid AND e.organization_id = $2::uuid
       ORDER BY h.event_date DESC`,
      [id, organizationId],
    );

    return result.rows;
  }

  async findEmergencyContacts(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `SELECT c.*
       FROM employee_emergency_contacts c
       JOIN employees e ON e.id = c.employee_id
       WHERE c.employee_id = $1::uuid AND e.organization_id = $2::uuid
       ORDER BY c.is_primary DESC, c.created_at DESC`,
      [id, organizationId],
    );

    return result.rows;
  }

  async createEmergencyContact(
    organizationId: string,
    id: string,
    input: EmergencyContactInput,
  ) {
    const result = await this.databaseService.query(
      `SELECT id FROM employees WHERE id = $1::uuid AND organization_id = $2::uuid`,
      [id, organizationId],
    );

    if (result.rows.length === 0) {
      throw new NotFoundException("Employee not found");
    }

    const insertResult = await this.databaseService.query(
      `INSERT INTO employee_emergency_contacts (
         employee_id, organization_id, name, relationship, phone, email, is_primary
       )
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        id,
        organizationId,
        input.name,
        input.relationship,
        input.phone,
        input.email ?? null,
        input.is_primary ?? false,
      ],
    );

    return insertResult.rows[0];
  }
}
