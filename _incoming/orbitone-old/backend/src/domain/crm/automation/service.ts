import { pool } from "../../../db/postgres.js";
import type {
  AutomationRule,
  AutomationRuleInput,
  AutomationTrigger,
  CRMContext
} from "../../../../../contracts/orbitone.v2.js";
import type { AuthContext } from "../../../lib/auth.js";
import { getEffectivePlan, planLimits } from "../../../middleware/plan.js";
import type { CRMScope } from "../custom-fields/service.js";
import { dispatchWebhook } from "../webhooks/service.js";

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
  return planLimits[plan].maxAutomationRules;
}

export async function listAutomationRules(scope: CRMScope): Promise<AutomationRule[]> {
  const result = await pool.query(
    `SELECT * FROM crm_automation_rules
     WHERE ${scopeClause("crm_automation_rules", 1)}
     ORDER BY created_at DESC`,
    scopeParams(scope)
  );
  return result.rows.map(mapRule);
}

export async function getAutomationRule(scope: CRMScope, id: string): Promise<AutomationRule | null> {
  const result = await pool.query(
    `SELECT * FROM crm_automation_rules
     WHERE id = $1 AND (${scopeClause("crm_automation_rules", 2)})`,
    [id, ...scopeParams(scope)]
  );
  if (result.rowCount === 0) return null;
  return mapRule(result.rows[0]);
}

export async function createAutomationRule(
  scope: CRMScope,
  user: AuthContext,
  input: AutomationRuleInput
): Promise<AutomationRule> {
  const limit = assertPlanLimit(scope, user);
  if (limit !== null) {
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM crm_automation_rules WHERE ${scopeClause("crm_automation_rules", 1)}`,
      scopeParams(scope)
    );
    if (Number(countResult.rows[0].count) >= limit) {
      throw new AutomationError(`Automation rules limited to ${limit} on your plan.`, 402);
    }
  }

  const result = await pool.query(
    `INSERT INTO crm_automation_rules
       (organization_id, owner_user_id, name, trigger_event, conditions, actions, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      scope.organizationId,
      scope.ownerUserId,
      input.name,
      input.triggerEvent,
      JSON.stringify(input.conditions ?? {}),
      JSON.stringify(input.actions),
      input.isActive ?? true
    ]
  );
  return mapRule(result.rows[0]);
}

export async function updateAutomationRule(
  scope: CRMScope,
  id: string,
  input: Partial<AutomationRuleInput>
): Promise<AutomationRule | null> {
  const existing = await getAutomationRule(scope, id);
  if (!existing) return null;

  const result = await pool.query(
    `UPDATE crm_automation_rules
     SET name = $1, trigger_event = $2, conditions = $3, actions = $4, is_active = $5, updated_at = now()
     WHERE id = $6 AND (${scopeClause("crm_automation_rules", 7)})
     RETURNING *`,
    [
      input.name ?? existing.name,
      input.triggerEvent ?? existing.triggerEvent,
      JSON.stringify(input.conditions ?? existing.conditions ?? {}),
      JSON.stringify(input.actions ?? existing.actions),
      input.isActive ?? existing.isActive,
      id,
      ...scopeParams(scope)
    ]
  );
  if (result.rowCount === 0) return null;
  return mapRule(result.rows[0]);
}

export async function deleteAutomationRule(scope: CRMScope, id: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM crm_automation_rules
     WHERE id = $1 AND (${scopeClause("crm_automation_rules", 2)})
     RETURNING id`,
    [id, ...scopeParams(scope)]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function runAutomationRules(
  context: CRMContext,
  event: AutomationTrigger,
  payload: Record<string, unknown>
): Promise<void> {
  const scope: CRMScope = {
    organizationId: context.organizationId,
    ownerUserId: context.organizationId ? null : context.userId
  };

  const rulesResult = await pool.query(
    `SELECT * FROM crm_automation_rules
     WHERE trigger_event = $1 AND is_active = TRUE AND (${scopeClause("crm_automation_rules", 2)})
     ORDER BY created_at ASC`,
    [event, ...scopeParams(scope)]
  );

  for (const row of rulesResult.rows) {
    const rule = mapRule(row);
    if (!matchesConditions(payload, rule.conditions ?? {})) continue;
    await executeActions(context, payload, rule.actions);
  }
}

function matchesConditions(payload: Record<string, unknown>, conditions: Record<string, unknown>): boolean {
  for (const [key, expected] of Object.entries(conditions)) {
    const actual = payload[key];
    if (typeof expected === "object" && expected !== null && !Array.isArray(expected)) {
      const expObj = expected as Record<string, unknown>;
      if (expObj.eq !== undefined && actual !== expObj.eq) return false;
      if (expObj.neq !== undefined && actual === expObj.neq) return false;
      if (expObj.in !== undefined && Array.isArray(expObj.in) && !expObj.in.includes(actual)) return false;
      if (expObj.contains !== undefined && typeof actual === "string" && !actual.includes(String(expObj.contains))) return false;
    } else {
      if (actual !== expected) return false;
    }
  }
  return true;
}

async function executeActions(
  context: CRMContext,
  payload: Record<string, unknown>,
  actions: AutomationRule["actions"]
): Promise<void> {
  const customerId = payload.customerId as string | undefined;
  if (!customerId) return;

  const baseWhere = context.organizationId
    ? "id = $1 AND organization_id = $2"
    : "id = $1 AND assigned_to_user_id = $2";
  const access = await pool.query(`SELECT id FROM customers WHERE ${baseWhere}`, [
    customerId,
    context.organizationId ?? context.userId
  ]);
  if (access.rowCount === 0) return;

  for (const action of actions) {
    try {
      switch (action.type) {
        case "create_follow_up": {
          const config = action.config as { title?: string; dueDays?: number };
          const title = config.title ?? "Follow-up";
          const dueDays = config.dueDays ?? 1;
          const dueAt = new Date();
          dueAt.setDate(dueAt.getDate() + dueDays);
          await pool.query(
            `INSERT INTO customer_follow_ups (customer_id, created_by_user_id, title, due_at)
             VALUES ($1, $2, $3, $4)`,
            [customerId, context.userId, title, dueAt.toISOString()]
          );
          break;
        }
        case "create_activity": {
          const config = action.config as { title?: string; body?: string; type?: string };
          await pool.query(
            `INSERT INTO customer_activities (customer_id, created_by_user_id, type, title, body, occurred_at)
             VALUES ($1, $2, $3, $4, $5, now())`,
            [customerId, context.userId, config.type ?? "other", config.title ?? "Automated activity", config.body ?? null]
          );
          break;
        }
        case "send_webhook":
          await dispatchWebhook(context, "automation_rule_triggered", {
            customerId,
            ruleAction: action.config
          });
          break;
      }
    } catch {
      // Ignore individual action failures so one broken action doesn't stop others.
    }
  }
}

function mapRule(row: Record<string, unknown>): AutomationRule {
  return {
    id: row.id as string,
    organizationId: (row.organization_id as string | null) ?? null,
    ownerUserId: (row.owner_user_id as string | null) ?? null,
    name: row.name as string,
    triggerEvent: row.trigger_event as AutomationTrigger,
    conditions: (row.conditions as Record<string, unknown> | null) ?? null,
    actions: Array.isArray(row.actions) ? (row.actions as AutomationRule["actions"]) : [],
    isActive: (row.is_active as boolean) ?? true,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString()
  };
}

export class AutomationError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AutomationError";
  }
}
