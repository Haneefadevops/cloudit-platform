import { pool } from "../../../db/postgres.js";
import type {
  ActivityTypeDefinition,
  ActivityTypeDefinitionInput
} from "../../../../../contracts/orbitone.v2.js";
import type { AuthContext } from "../../../lib/auth.js";
import { getEffectivePlan, planLimits } from "../../../middleware/plan.js";
import type { CRMScope } from "../custom-fields/service.js";

function scopeClause(alias: string, offset: number) {
  return `${alias}.organization_id = $${offset} OR ${alias}.owner_user_id = $${offset + 1}`;
}

function scopeParams(scope: CRMScope): [string | null, string | null] {
  return [scope.organizationId, scope.ownerUserId];
}

function assertPlanLimit(scope: CRMScope, user: AuthContext): number | null {
  const plan = getEffectivePlan({
    organizationId: user.organizationId,
    plan: user.plan,
    organization: user.organization
  });
  return planLimits[plan].maxActivityTypes;
}

export async function listActivityTypes(scope: CRMScope): Promise<ActivityTypeDefinition[]> {
  const result = await pool.query(
    `SELECT * FROM activity_type_definitions
     WHERE ${scopeClause("activity_type_definitions", 1)}
     ORDER BY "order" ASC, name ASC`,
    scopeParams(scope)
  );
  return result.rows.map(mapActivityType);
}

export async function getActivityType(scope: CRMScope, id: string): Promise<ActivityTypeDefinition | null> {
  const result = await pool.query(
    `SELECT * FROM activity_type_definitions
     WHERE id = $1 AND (${scopeClause("activity_type_definitions", 2)})`,
    [id, ...scopeParams(scope)]
  );
  if (result.rowCount === 0) return null;
  return mapActivityType(result.rows[0]);
}

export async function getActivityTypeByKey(
  scope: CRMScope,
  key: string
): Promise<ActivityTypeDefinition | null> {
  const result = await pool.query(
    `SELECT * FROM activity_type_definitions
     WHERE key = $1 AND (${scopeClause("activity_type_definitions", 2)})`,
    [key, ...scopeParams(scope)]
  );
  if (result.rowCount === 0) return null;
  return mapActivityType(result.rows[0]);
}

export async function createActivityType(
  scope: CRMScope,
  user: AuthContext,
  input: ActivityTypeDefinitionInput
): Promise<ActivityTypeDefinition> {
  const limit = assertPlanLimit(scope, user);
  if (limit !== null) {
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM activity_type_definitions WHERE ${scopeClause("activity_type_definitions", 1)}`,
      scopeParams(scope)
    );
    if (Number(countResult.rows[0].count) >= limit) {
      throw new ActivityTypeError(`Activity types limited to ${limit} on your plan.`, 402);
    }
  }

  validateInput(input);

  const result = await pool.query(
    `INSERT INTO activity_type_definitions
       (organization_id, owner_user_id, key, name, icon, "order")
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      scope.organizationId,
      scope.ownerUserId,
      input.key,
      input.name,
      input.icon ?? null,
      input.order ?? 0
    ]
  );
  return mapActivityType(result.rows[0]);
}

export async function updateActivityType(
  scope: CRMScope,
  id: string,
  input: Partial<ActivityTypeDefinitionInput>
): Promise<ActivityTypeDefinition | null> {
  const existing = await getActivityType(scope, id);
  if (!existing) return null;

  const merged: ActivityTypeDefinitionInput = {
    key: input.key ?? existing.key,
    name: input.name ?? existing.name,
    icon: input.icon !== undefined ? input.icon : existing.icon,
    order: input.order ?? existing.order
  };
  validateInput(merged);

  const result = await pool.query(
    `UPDATE activity_type_definitions
     SET key = $1, name = $2, icon = $3, "order" = $4, updated_at = now()
     WHERE id = $5 AND (${scopeClause("activity_type_definitions", 6)})
     RETURNING *`,
    [merged.key, merged.name, merged.icon, merged.order, id, ...scopeParams(scope)]
  );
  if (result.rowCount === 0) return null;
  return mapActivityType(result.rows[0]);
}

export async function deleteActivityType(scope: CRMScope, id: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM activity_type_definitions
     WHERE id = $1 AND (${scopeClause("activity_type_definitions", 2)})
     RETURNING id`,
    [id, ...scopeParams(scope)]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

function validateInput(input: ActivityTypeDefinitionInput) {
  if (!input.name || input.name.trim().length === 0) {
    throw new ActivityTypeError("Name is required.", 400);
  }
  if (!input.key || !/^[a-z0-9_]+$/.test(input.key)) {
    throw new ActivityTypeError("Key must contain only lowercase letters, numbers, and underscores.", 400);
  }
}

function mapActivityType(row: Record<string, unknown>): ActivityTypeDefinition {
  return {
    id: row.id as string,
    organizationId: (row.organization_id as string | null) ?? null,
    ownerUserId: (row.owner_user_id as string | null) ?? null,
    key: row.key as string,
    name: row.name as string,
    icon: (row.icon as string | null) ?? null,
    order: Number(row.order ?? 0),
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString()
  };
}

export class ActivityTypeError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "ActivityTypeError";
  }
}
