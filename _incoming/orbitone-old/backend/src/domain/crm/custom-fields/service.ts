import { pool } from "../../../db/postgres.js";
import type {
  CustomFieldDefinition,
  CustomFieldInput,
  CustomFieldValue
} from "../../../../../contracts/orbitone.v2.js";
import type { AuthContext } from "../../../lib/auth.js";
import { getEffectivePlan, planLimits } from "../../../middleware/plan.js";

export type CRMScope = {
  organizationId: string | null;
  ownerUserId: string | null;
};

export function getCRMScope(user: AuthContext): CRMScope {
  return {
    organizationId: user.organizationId,
    ownerUserId: user.organizationId ? null : user.id
  };
}

function scopeClause(alias: string, offset: number) {
  return `${alias}.organization_id = $${offset} OR ${alias}.owner_user_id = $${offset + 1}`;
}

function scopeParams(scope: CRMScope): [string | null, string | null] {
  return [scope.organizationId, scope.ownerUserId];
}

function assertPlanLimit(scope: CRMScope, user: AuthContext) {
  const plan = getEffectivePlan({
    organizationId: user.organizationId,
    plan: user.plan,
    organization: user.organization
  });
  const limit = planLimits[plan].maxCustomFields;
  if (limit === null) return;

  return limit;
}

export async function listCustomFields(scope: CRMScope): Promise<CustomFieldDefinition[]> {
  const result = await pool.query(
    `SELECT * FROM custom_field_definitions
     WHERE ${scopeClause("custom_field_definitions", 1)}
     ORDER BY "order" ASC, name ASC`,
    scopeParams(scope)
  );
  return result.rows.map(mapCustomFieldDefinition);
}

export async function getCustomField(scope: CRMScope, id: string): Promise<CustomFieldDefinition | null> {
  const result = await pool.query(
    `SELECT * FROM custom_field_definitions
     WHERE id = $1 AND (${scopeClause("custom_field_definitions", 2)})`,
    [id, ...scopeParams(scope)]
  );
  if (result.rowCount === 0) return null;
  return mapCustomFieldDefinition(result.rows[0]);
}

export async function createCustomField(
  scope: CRMScope,
  user: AuthContext,
  input: CustomFieldInput
): Promise<CustomFieldDefinition> {
  const limit = assertPlanLimit(scope, user);
  if (limit !== undefined) {
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM custom_field_definitions WHERE ${scopeClause("custom_field_definitions", 1)}`,
      scopeParams(scope)
    );
    const count = Number(countResult.rows[0].count);
    if (count >= limit) {
      throw new CustomFieldError(`Custom fields limited to ${limit} on your plan.`, 402);
    }
  }

  validateCustomFieldInput(input);

  const result = await pool.query(
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
      input.isRequired ?? false
    ]
  );
  return mapCustomFieldDefinition(result.rows[0]);
}

export async function updateCustomField(
  scope: CRMScope,
  id: string,
  input: Partial<CustomFieldInput>
): Promise<CustomFieldDefinition | null> {
  const existing = await getCustomField(scope, id);
  if (!existing) return null;

  const merged: CustomFieldInput = {
    name: input.name ?? existing.name,
    key: input.key ?? existing.key,
    type: input.type ?? existing.type,
    options: input.options ?? existing.options,
    order: input.order ?? existing.order,
    isRequired: input.isRequired ?? existing.isRequired
  };
  validateCustomFieldInput(merged);

  const result = await pool.query(
    `UPDATE custom_field_definitions
     SET name = $1, key = $2, type = $3, options = $4, "order" = $5, is_required = $6, updated_at = now()
     WHERE id = $7 AND (${scopeClause("custom_field_definitions", 8)})
     RETURNING *`,
    [merged.name, merged.key, merged.type, JSON.stringify(merged.options), merged.order, merged.isRequired, id, ...scopeParams(scope)]
  );
  if (result.rowCount === 0) return null;
  return mapCustomFieldDefinition(result.rows[0]);
}

export async function deleteCustomField(scope: CRMScope, id: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM custom_field_definitions
     WHERE id = $1 AND (${scopeClause("custom_field_definitions", 2)})
     RETURNING id`,
    [id, ...scopeParams(scope)]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function getCustomFieldValuesForCustomer(customerId: string): Promise<CustomFieldValue[]> {
  const result = await pool.query(
    `SELECT custom_field_definition_id AS definition_id, value
     FROM custom_field_values
     WHERE customer_id = $1`,
    [customerId]
  );
  return result.rows.map((row) => ({
    definitionId: row.definition_id as string,
    value: row.value as unknown
  }));
}

export async function setCustomFieldValues(
  customerId: string,
  values: CustomFieldValue[]
): Promise<void> {
  if (values.length === 0) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const item of values) {
      await client.query(
        `INSERT INTO custom_field_values (customer_id, custom_field_definition_id, value)
         VALUES ($1, $2, $3)
         ON CONFLICT (customer_id, custom_field_definition_id)
         DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [customerId, item.definitionId, JSON.stringify(item.value)]
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

function validateCustomFieldInput(input: CustomFieldInput) {
  if (!input.name || input.name.trim().length === 0) {
    throw new CustomFieldError("Field name is required.", 400);
  }
  if (!input.key || !/^[a-z0-9_]+$/.test(input.key)) {
    throw new CustomFieldError("Field key must contain only lowercase letters, numbers, and underscores.", 400);
  }
  const validTypes = ["text", "number", "date", "single_select", "multi_select", "url", "email"];
  if (!validTypes.includes(input.type)) {
    throw new CustomFieldError("Invalid field type.", 400);
  }
  if (["single_select", "multi_select"].includes(input.type)) {
    if (!Array.isArray(input.options) || input.options.length === 0) {
      throw new CustomFieldError("Select fields require at least one option.", 400);
    }
  }
}

function mapCustomFieldDefinition(row: Record<string, unknown>): CustomFieldDefinition {
  return {
    id: row.id as string,
    organizationId: (row.organization_id as string | null) ?? null,
    ownerUserId: (row.owner_user_id as string | null) ?? null,
    name: row.name as string,
    key: row.key as string,
    type: row.type as CustomFieldDefinition["type"],
    options: Array.isArray(row.options) ? (row.options as string[]) : [],
    order: Number(row.order ?? 0),
    isRequired: (row.is_required as boolean) ?? false
  };
}

export class CustomFieldError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "CustomFieldError";
  }
}
