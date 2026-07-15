import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
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

  async findCategories(organizationId: string) {
    const result = await this.databaseService.query(
      `SELECT id, name, max_claim_amount
       FROM expense_categories
       WHERE organization_id = $1::uuid AND is_active = true
       ORDER BY name`,
      [organizationId],
    );
    return result.rows;
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
