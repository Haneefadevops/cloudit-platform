import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { PlanService } from "../../common/services/plan.service";
import type {
  CustomFieldDefinition,
  CustomFieldInput,
  CustomFieldValue,
} from "../../common/contracts/orbitone.v2";
import type { AuthContext } from "../../auth/types";
import { CRMScope, getCRMScope } from "../crm.types";

export { getCRMScope };
export type { CRMScope };

@Injectable()
export class CustomFieldsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly planService: PlanService,
  ) {}

  private scopeClause(alias: string, offset: number) {
    return `${alias}.organization_id = $${offset} OR ${alias}.owner_user_id = $${offset + 1}`;
  }

  private scopeParams(scope: CRMScope): [string | null, string | null] {
    return [scope.organizationId, scope.ownerUserId];
  }

  private assertPlanLimit(scope: CRMScope, user: AuthContext): number | null {
    const plan = this.planService.getUserEffectivePlan(user);
    return this.planService.getPlanLimit(plan).maxCustomFields;
  }

  async listCustomFields(user: AuthContext): Promise<CustomFieldDefinition[]> {
    const scope = getCRMScope(user);
    const result = await this.databaseService.query(
      `SELECT * FROM custom_field_definitions
       WHERE ${this.scopeClause("custom_field_definitions", 1)}
       ORDER BY "order" ASC, name ASC`,
      this.scopeParams(scope),
    );
    return result.rows.map((row) => this.mapCustomFieldDefinition(row));
  }

  async getCustomField(
    user: AuthContext,
    id: string,
  ): Promise<CustomFieldDefinition | null> {
    const scope = getCRMScope(user);
    const result = await this.databaseService.query(
      `SELECT * FROM custom_field_definitions
       WHERE id = $1 AND (${this.scopeClause("custom_field_definitions", 2)})`,
      [id, ...this.scopeParams(scope)],
    );
    if (result.rowCount === 0) return null;
    return this.mapCustomFieldDefinition(result.rows[0]);
  }

  async createCustomField(
    user: AuthContext,
    input: CustomFieldInput,
  ): Promise<CustomFieldDefinition> {
    const scope = getCRMScope(user);
    const limit = this.assertPlanLimit(scope, user);
    if (limit !== null) {
      const countResult = await this.databaseService.query(
        `SELECT COUNT(*) FROM custom_field_definitions WHERE ${this.scopeClause("custom_field_definitions", 1)}`,
        this.scopeParams(scope),
      );
      if (Number(countResult.rows[0].count) >= limit) {
        throw new CustomFieldError(
          `Custom fields limited to ${limit} on your plan.`,
          402,
        );
      }
    }

    this.validateCustomFieldInput(input);

    const result = await this.databaseService.query(
      `INSERT INTO custom_field_definitions
         (organization_id, owner_user_id, name, key, type, options, "order", is_required)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        scope.organizationId,
        scope.ownerUserId,
        input.name,
        input.key,
        input.type,
        JSON.stringify(input.options ?? []),
        input.order ?? 0,
        input.isRequired ?? false,
      ],
    );
    return this.mapCustomFieldDefinition(result.rows[0]);
  }

  async updateCustomField(
    user: AuthContext,
    id: string,
    input: Partial<CustomFieldInput>,
  ): Promise<CustomFieldDefinition | null> {
    const scope = getCRMScope(user);
    const existing = await this.getCustomField(user, id);
    if (!existing) return null;

    const merged: CustomFieldInput = {
      name: input.name ?? existing.name,
      key: input.key ?? existing.key,
      type: input.type ?? existing.type,
      options: input.options ?? existing.options,
      order: input.order ?? existing.order,
      isRequired: input.isRequired ?? existing.isRequired,
    };
    this.validateCustomFieldInput(merged);

    const result = await this.databaseService.query(
      `UPDATE custom_field_definitions
       SET name = $1, key = $2, type = $3, options = $4, "order" = $5, is_required = $6, updated_at = now()
       WHERE id = $7 AND (${this.scopeClause("custom_field_definitions", 8)})
       RETURNING *`,
      [
        merged.name,
        merged.key,
        merged.type,
        JSON.stringify(merged.options),
        merged.order,
        merged.isRequired,
        id,
        ...this.scopeParams(scope),
      ],
    );
    if (result.rowCount === 0) return null;
    return this.mapCustomFieldDefinition(result.rows[0]);
  }

  async deleteCustomField(user: AuthContext, id: string): Promise<boolean> {
    const scope = getCRMScope(user);
    const result = await this.databaseService.query(
      `DELETE FROM custom_field_definitions
       WHERE id = $1 AND (${this.scopeClause("custom_field_definitions", 2)})
       RETURNING id`,
      [id, ...this.scopeParams(scope)],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async getCustomFieldValuesForCustomer(
    customerId: string,
  ): Promise<CustomFieldValue[]> {
    const result = await this.databaseService.query(
      `SELECT custom_field_definition_id AS definition_id, value
       FROM custom_field_values
       WHERE customer_id = $1`,
      [customerId],
    );
    return result.rows.map((row) => ({
      definitionId: row.definition_id as string,
      value: row.value as unknown,
    }));
  }

  async setCustomFieldValues(
    customerId: string,
    values: CustomFieldValue[],
  ): Promise<void> {
    if (values.length === 0) return;
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");
      for (const item of values) {
        await client.query(
          `INSERT INTO custom_field_values (customer_id, custom_field_definition_id, value)
           VALUES ($1, $2, $3)
           ON CONFLICT (customer_id, custom_field_definition_id)
           DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [customerId, item.definitionId, JSON.stringify(item.value)],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private validateCustomFieldInput(input: CustomFieldInput) {
    if (!input.name || input.name.trim().length === 0) {
      throw new CustomFieldError("Field name is required.", 400);
    }
    if (!input.key || !/^[a-z0-9_]+$/.test(input.key)) {
      throw new CustomFieldError(
        "Field key must contain only lowercase letters, numbers, and underscores.",
        400,
      );
    }
    const validTypes = [
      "text",
      "number",
      "date",
      "single_select",
      "multi_select",
      "url",
      "email",
    ];
    if (!validTypes.includes(input.type)) {
      throw new CustomFieldError("Invalid field type.", 400);
    }
    if (["single_select", "multi_select"].includes(input.type)) {
      if (!Array.isArray(input.options) || input.options.length === 0) {
        throw new CustomFieldError(
          "Select fields require at least one option.",
          400,
        );
      }
    }
  }

  private mapCustomFieldDefinition(
    row: Record<string, unknown>,
  ): CustomFieldDefinition {
    return {
      id: row.id as string,
      organizationId: (row.organization_id as string | null) ?? null,
      ownerUserId: (row.owner_user_id as string | null) ?? null,
      name: row.name as string,
      key: row.key as string,
      type: row.type as CustomFieldDefinition["type"],
      options: Array.isArray(row.options) ? (row.options as string[]) : [],
      order: Number(row.order ?? 0),
      isRequired: (row.is_required as boolean) ?? false,
    };
  }
}

export class CustomFieldError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "CustomFieldError";
  }
}
