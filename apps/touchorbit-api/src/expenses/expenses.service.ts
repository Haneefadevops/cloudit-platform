import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import type { AuthContext } from "../auth/types";

@Injectable()
export class ExpensesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll(organizationId: string, user: AuthContext, employeeId?: string) {
    const values: unknown[] = [organizationId];
    const conditions = ["ec.organization_id = $1::uuid"];
    if (user.role === "employee") {
      values.push(user.id);
      conditions.push(`e.user_id = $${values.length}::uuid`);
    } else if (employeeId) {
      values.push(employeeId);
      conditions.push(`ec.employee_id = $${values.length}::uuid`);
    }
    const result = await this.databaseService.query(
      `SELECT ec.*,
              json_build_object(
                'first_name', e.first_name,
                'last_name', e.last_name,
                'department', e.department,
                'department_id', e.department_id,
                'branch_id', e.branch_id
              ) AS employee,
              CASE WHEN cat.id IS NULL THEN NULL
                   ELSE json_build_object('name', cat.name) END AS category
       FROM expense_claims ec
       JOIN employees e
         ON e.id = ec.employee_id AND e.organization_id = ec.organization_id
       LEFT JOIN expense_categories cat
         ON cat.id = ec.category_id AND cat.organization_id = ec.organization_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY ec.claim_date DESC, ec.created_at DESC`,
      values,
    );
    return result.rows;
  }

  async findCategories(organizationId: string, includeInactive = false) {
    const result = await this.databaseService.query(
      `SELECT id, name, description, max_claim_amount::float AS max_claim_amount, is_active
       FROM expense_categories
       WHERE organization_id = $1::uuid
         AND ($2::boolean = true OR is_active = true)
       ORDER BY name`,
      [organizationId, includeInactive],
    );
    return result.rows;
  }

  async createCategory(
    organizationId: string,
    input: {
      name: string;
      description?: string | null;
      max_claim_amount?: number | null;
      is_active?: boolean;
    },
  ) {
    try {
      const result = await this.databaseService.query(
        `INSERT INTO expense_categories (
           organization_id, name, description, max_claim_amount, is_active
         )
         VALUES ($1::uuid, $2, $3, $4, COALESCE($5::boolean, true))
         RETURNING id, name, description, max_claim_amount::float AS max_claim_amount, is_active`,
        [
          organizationId,
          input.name,
          input.description ?? null,
          input.max_claim_amount ?? null,
          input.is_active ?? true,
        ],
      );
      return result.rows[0];
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      ) {
        throw new ConflictException("Expense category already exists");
      }
      throw error;
    }
  }

  async updateCategory(
    organizationId: string,
    id: string,
    input: {
      name?: string;
      description?: string | null;
      max_claim_amount?: number | null;
      is_active?: boolean;
    },
  ) {
    try {
      const result = await this.databaseService.query(
        `UPDATE expense_categories
         SET name = COALESCE($3, name),
             description = CASE WHEN $4::boolean THEN $5 ELSE description END,
             max_claim_amount = CASE WHEN $6::boolean THEN $7 ELSE max_claim_amount END,
             is_active = COALESCE($8::boolean, is_active)
         WHERE id = $1::uuid AND organization_id = $2::uuid
         RETURNING id, name, description, max_claim_amount::float AS max_claim_amount, is_active`,
        [
          id,
          organizationId,
          input.name,
          Object.prototype.hasOwnProperty.call(input, "description"),
          input.description ?? null,
          Object.prototype.hasOwnProperty.call(input, "max_claim_amount"),
          input.max_claim_amount ?? null,
          input.is_active,
        ],
      );
      if (result.rows.length === 0) throw new NotFoundException("Expense category not found");
      return result.rows[0];
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      ) {
        throw new ConflictException("Expense category already exists");
      }
      throw error;
    }
  }

  async create(
    organizationId: string,
    user: AuthContext,
    input: {
      employee_id: string;
      category_id: string;
      amount: number;
      currency: string;
      claim_date: string;
      description?: string;
    },
  ) {
    const employee = await this.databaseService.query<{ user_id: string | null }>(
      `SELECT user_id FROM employees
       WHERE id = $1::uuid AND organization_id = $2::uuid`,
      [input.employee_id, organizationId],
    );
    if (employee.rows.length === 0) throw new NotFoundException("Employee not found");
    if (user.role === "employee" && employee.rows[0].user_id !== user.id) {
      throw new ForbiddenException("Cannot create an expense for another employee");
    }

    const category = await this.databaseService.query(
      `SELECT id FROM expense_categories
       WHERE id = $1::uuid AND organization_id = $2::uuid AND is_active = true`,
      [input.category_id, organizationId],
    );
    if (category.rows.length === 0) throw new NotFoundException("Expense category not found");

    const result = await this.databaseService.query(
      `INSERT INTO expense_claims (
         organization_id, employee_id, category_id, amount, currency,
         claim_date, description, status
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6::date, $7, 'pending')
       RETURNING *`,
      [
        organizationId,
        input.employee_id,
        input.category_id,
        input.amount,
        input.currency,
        input.claim_date,
        input.description ?? null,
      ],
    );
    return result.rows[0];
  }
}
