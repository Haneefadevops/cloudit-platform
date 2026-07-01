import { Injectable, NotFoundException } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";

interface AssetInput {
  categoryId?: string | null;
  branchId?: string | null;
  name?: string;
  serialNumber?: string | null;
  modelNumber?: string | null;
  purchaseDate?: string | null;
  purchaseCost?: number | null;
  condition?: string | null;
  status?: string | null;
  notes?: string | null;
}

interface AssignmentInput {
  assetId: string;
  employeeId: string;
  assignedAt?: string | null;
  expectedReturnAt?: string | null;
  conditionOnAssignment?: string | null;
  notes?: string | null;
}

@Injectable()
export class AssetsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT a.*,
              ac.name AS category_name,
              b.name AS branch_name,
              active_assignment.employee_id AS assigned_employee_id,
              active_assignment.employee_name AS assigned_employee_name
       FROM assets a
       LEFT JOIN asset_categories ac
         ON ac.id = a.category_id AND ac.organization_id = a.organization_id
       LEFT JOIN branches b
         ON b.id = a.branch_id AND b.organization_id = a.organization_id
       LEFT JOIN LATERAL (
         SELECT aa.employee_id,
                concat_ws(' ', e.first_name, e.last_name) AS employee_name
         FROM asset_assignments aa
         JOIN employees e ON e.id = aa.employee_id
         WHERE aa.asset_id = a.id
           AND aa.organization_id = a.organization_id
           AND aa.status = 'active'
         ORDER BY aa.assigned_at DESC
         LIMIT 1
       ) active_assignment ON true
       WHERE a.organization_id = $1::uuid
       ORDER BY a.created_at DESC`,
      [organizationId],
    );
    return result.rows;
  }

  async create(organizationId: string, input: AssetInput) {
    const result = await this.databaseService.query(
      `INSERT INTO assets (
         organization_id, category_id, branch_id, name, serial_number,
         model_number, purchase_date, purchase_cost, condition, status, notes
       )
       VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4, $5,
         $6, $7::date, $8, COALESCE($9, 'good'), COALESCE($10, 'available'), $11
       )
       RETURNING *`,
      [
        organizationId,
        input.categoryId ?? null,
        input.branchId ?? null,
        input.name,
        input.serialNumber ?? null,
        input.modelNumber ?? null,
        input.purchaseDate ?? null,
        input.purchaseCost ?? null,
        input.condition ?? null,
        input.status ?? null,
        input.notes ?? null,
      ],
    );
    return result.rows[0];
  }

  async findOne(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `SELECT a.*,
              ac.name AS category_name,
              b.name AS branch_name
       FROM assets a
       LEFT JOIN asset_categories ac
         ON ac.id = a.category_id AND ac.organization_id = a.organization_id
       LEFT JOIN branches b
         ON b.id = a.branch_id AND b.organization_id = a.organization_id
       WHERE a.id = $1::uuid AND a.organization_id = $2::uuid`,
      [id, organizationId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Asset not found");
    }
    return result.rows[0];
  }

  async update(organizationId: string, id: string, input: AssetInput) {
    const params: unknown[] = [id, organizationId];
    const setClauses: string[] = [];
    const add = (column: string, value: unknown, cast = "") => {
      if (value !== undefined) {
        params.push(value);
        setClauses.push(`${column} = $${params.length}${cast}`);
      }
    };

    add("category_id", input.categoryId, "::uuid");
    add("branch_id", input.branchId, "::uuid");
    add("name", input.name);
    add("serial_number", input.serialNumber);
    add("model_number", input.modelNumber);
    add("purchase_date", input.purchaseDate, "::date");
    add("purchase_cost", input.purchaseCost);
    add("condition", input.condition);
    add("status", input.status);
    add("notes", input.notes);

    if (setClauses.length === 0) {
      return this.findOne(organizationId, id);
    }

    setClauses.push("updated_at = now()");
    const result = await this.databaseService.query(
      `UPDATE assets
       SET ${setClauses.join(", ")}
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING *`,
      params,
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Asset not found");
    }
    return result.rows[0];
  }

  async delete(organizationId: string, id: string) {
    const result = await this.databaseService.query(
      `DELETE FROM assets
       WHERE id = $1::uuid AND organization_id = $2::uuid
       RETURNING id`,
      [id, organizationId],
    );
    if (result.rows.length === 0) {
      throw new NotFoundException("Asset not found");
    }
    return { deleted: true, id: result.rows[0].id };
  }

  async findCategories(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT ac.*,
              COUNT(a.id)::int AS asset_count
       FROM asset_categories ac
       LEFT JOIN assets a
         ON a.category_id = ac.id AND a.organization_id = ac.organization_id
       WHERE ac.organization_id = $1::uuid
       GROUP BY ac.id
       ORDER BY ac.name`,
      [organizationId],
    );
    return result.rows;
  }

  async createCategory(
    organizationId: string,
    input: { name: string; description?: string | null },
  ) {
    const result = await this.databaseService.query(
      `INSERT INTO asset_categories (organization_id, name, description)
       VALUES ($1::uuid, $2, $3)
       RETURNING *`,
      [organizationId, input.name, input.description ?? null],
    );
    return result.rows[0];
  }

  async findAssignments(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT aa.*,
              jsonb_build_object(
                'id', a.id,
                'name', a.name,
                'serial_number', a.serial_number,
                'model_number', a.model_number,
                'status', a.status,
                'category_id', a.category_id,
                'category_name', ac.name
              ) AS asset,
              jsonb_build_object(
                'id', e.id,
                'first_name', e.first_name,
                'last_name', e.last_name,
                'employee_number', e.employee_number,
                'department_id', e.department_id,
                'branch_id', e.branch_id
              ) AS employee,
              concat_ws(' ', e.first_name, e.last_name) AS employee_name,
              a.name AS asset_name,
              a.serial_number AS asset_serial_number
       FROM asset_assignments aa
       JOIN assets a ON a.id = aa.asset_id
       JOIN employees e ON e.id = aa.employee_id
       LEFT JOIN asset_categories ac ON ac.id = a.category_id
       WHERE aa.organization_id = $1::uuid
       ORDER BY aa.assigned_at DESC`,
      [organizationId],
    );
    return result.rows;
  }

  async createAssignment(organizationId: string, input: AssignmentInput) {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");

      const assetResult = await client.query(
        `SELECT id
         FROM assets
         WHERE id = $1::uuid AND organization_id = $2::uuid
         FOR UPDATE`,
        [input.assetId, organizationId],
      );
      if (assetResult.rows.length === 0) {
        throw new NotFoundException("Asset not found");
      }

      const employeeResult = await client.query(
        `SELECT id
         FROM employees
         WHERE id = $1::uuid AND organization_id = $2::uuid`,
        [input.employeeId, organizationId],
      );
      if (employeeResult.rows.length === 0) {
        throw new NotFoundException("Employee not found");
      }

      await client.query(
        `UPDATE asset_assignments
         SET status = 'returned',
             returned_at = COALESCE(returned_at, now())
         WHERE organization_id = $1::uuid
           AND asset_id = $2::uuid
           AND status = 'active'`,
        [organizationId, input.assetId],
      );

      const result = await client.query(
        `INSERT INTO asset_assignments (
           organization_id, asset_id, employee_id, assigned_at,
           expected_return_at, condition_on_assignment, notes, status
         )
         VALUES ($1::uuid, $2::uuid, $3::uuid, COALESCE($4::timestamptz, now()), $5::date, $6, $7, 'active')
         RETURNING *`,
        [
          organizationId,
          input.assetId,
          input.employeeId,
          input.assignedAt ?? null,
          input.expectedReturnAt ?? null,
          input.conditionOnAssignment ?? null,
          input.notes ?? null,
        ],
      );

      await client.query(
        `UPDATE assets
         SET status = 'assigned',
             updated_at = now()
         WHERE id = $1::uuid AND organization_id = $2::uuid`,
        [input.assetId, organizationId],
      );

      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}
