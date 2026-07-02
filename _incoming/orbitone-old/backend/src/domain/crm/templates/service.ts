import { pool } from "../../../db/postgres.js";
import type { CRMTemplate, CRMTemplateInput } from "../../../../../contracts/orbitone.v2.js";
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
  return planLimits[plan].maxTemplates;
}

export async function listTemplates(scope: CRMScope): Promise<CRMTemplate[]> {
  const result = await pool.query(
    `SELECT * FROM crm_templates
     WHERE ${scopeClause("crm_templates", 1)}
     ORDER BY type ASC, name ASC`,
    scopeParams(scope)
  );
  return result.rows.map(mapTemplate);
}

export async function getTemplate(scope: CRMScope, id: string): Promise<CRMTemplate | null> {
  const result = await pool.query(
    `SELECT * FROM crm_templates
     WHERE id = $1 AND (${scopeClause("crm_templates", 2)})`,
    [id, ...scopeParams(scope)]
  );
  if (result.rowCount === 0) return null;
  return mapTemplate(result.rows[0]);
}

export async function createTemplate(
  scope: CRMScope,
  user: AuthContext,
  input: CRMTemplateInput
): Promise<CRMTemplate> {
  const limit = assertPlanLimit(scope, user);
  if (limit !== null) {
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM crm_templates WHERE ${scopeClause("crm_templates", 1)}`,
      scopeParams(scope)
    );
    if (Number(countResult.rows[0].count) >= limit) {
      throw new TemplateError(`Templates limited to ${limit} on your plan.`, 402);
    }
  }

  const result = await pool.query(
    `INSERT INTO crm_templates
       (organization_id, owner_user_id, name, type, subject, body)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      scope.organizationId,
      scope.ownerUserId,
      input.name,
      input.type,
      input.subject ?? null,
      input.body
    ]
  );
  return mapTemplate(result.rows[0]);
}

export async function updateTemplate(
  scope: CRMScope,
  id: string,
  input: Partial<CRMTemplateInput>
): Promise<CRMTemplate | null> {
  const existing = await getTemplate(scope, id);
  if (!existing) return null;

  const result = await pool.query(
    `UPDATE crm_templates
     SET name = $1, type = $2, subject = $3, body = $4, updated_at = now()
     WHERE id = $5 AND (${scopeClause("crm_templates", 6)})
     RETURNING *`,
    [
      input.name ?? existing.name,
      input.type ?? existing.type,
      input.subject !== undefined ? input.subject : existing.subject,
      input.body ?? existing.body,
      id,
      ...scopeParams(scope)
    ]
  );
  if (result.rowCount === 0) return null;
  return mapTemplate(result.rows[0]);
}

export async function deleteTemplate(scope: CRMScope, id: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM crm_templates
     WHERE id = $1 AND (${scopeClause("crm_templates", 2)})
     RETURNING id`,
    [id, ...scopeParams(scope)]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

function mapTemplate(row: Record<string, unknown>): CRMTemplate {
  return {
    id: row.id as string,
    organizationId: (row.organization_id as string | null) ?? null,
    ownerUserId: (row.owner_user_id as string | null) ?? null,
    name: row.name as string,
    type: row.type as CRMTemplate["type"],
    subject: (row.subject as string | null) ?? null,
    body: row.body as string,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString()
  };
}

export class TemplateError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "TemplateError";
  }
}
