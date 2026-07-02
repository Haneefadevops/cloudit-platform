import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { PlanService } from "../../common/services/plan.service";
import type {
  AutomationRule,
  AutomationRuleInput,
  AutomationTrigger,
  CRMContext,
} from "../../common/contracts/orbitone.v2";
import type { AuthContext } from "../../auth/types";
import { CRMScope, getCRMScope } from "../crm.types";
import { WebhooksService } from "../webhooks/webhooks.service";

@Injectable()
export class AutomationService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly planService: PlanService,
    private readonly webhooksService: WebhooksService,
  ) {}

  private scopeClause(alias: string, offset: number) {
    return `${alias}.organization_id = $${offset} OR ${alias}.owner_user_id = $${offset + 1}`;
  }

  private scopeParams(scope: CRMScope): [string | null, string | null] {
    return [scope.organizationId, scope.ownerUserId];
  }

  private assertPlanLimit(scope: CRMScope, user: AuthContext): number | null {
    const plan = this.planService.getUserEffectivePlan(user);
    return this.planService.getPlanLimit(plan).maxAutomationRules;
  }

  async listAutomationRules(user: AuthContext): Promise<AutomationRule[]> {
    const scope = getCRMScope(user);
    const result = await this.databaseService.query(
      `SELECT * FROM crm_automation_rules
       WHERE ${this.scopeClause("crm_automation_rules", 1)}
       ORDER BY created_at DESC`,
      this.scopeParams(scope),
    );
    return result.rows.map((row) => this.mapRule(row));
  }

  async getAutomationRule(
    user: AuthContext,
    id: string,
  ): Promise<AutomationRule | null> {
    const scope = getCRMScope(user);
    const result = await this.databaseService.query(
      `SELECT * FROM crm_automation_rules
       WHERE id = $1 AND (${this.scopeClause("crm_automation_rules", 2)})`,
      [id, ...this.scopeParams(scope)],
    );
    if (result.rowCount === 0) return null;
    return this.mapRule(result.rows[0]);
  }

  async createAutomationRule(
    user: AuthContext,
    input: AutomationRuleInput,
  ): Promise<AutomationRule> {
    const scope = getCRMScope(user);
    const limit = this.assertPlanLimit(scope, user);
    if (limit !== null) {
      const countResult = await this.databaseService.query(
        `SELECT COUNT(*) FROM crm_automation_rules WHERE ${this.scopeClause("crm_automation_rules", 1)}`,
        this.scopeParams(scope),
      );
      if (Number(countResult.rows[0].count) >= limit) {
        throw new AutomationError(
          `Automation rules limited to ${limit} on your plan.`,
          402,
        );
      }
    }

    const result = await this.databaseService.query(
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
        input.isActive ?? true,
      ],
    );
    return this.mapRule(result.rows[0]);
  }

  async updateAutomationRule(
    user: AuthContext,
    id: string,
    input: Partial<AutomationRuleInput>,
  ): Promise<AutomationRule | null> {
    const scope = getCRMScope(user);
    const existing = await this.getAutomationRule(user, id);
    if (!existing) return null;

    const result = await this.databaseService.query(
      `UPDATE crm_automation_rules
       SET name = $1, trigger_event = $2, conditions = $3, actions = $4, is_active = $5, updated_at = now()
       WHERE id = $6 AND (${this.scopeClause("crm_automation_rules", 7)})
       RETURNING *`,
      [
        input.name ?? existing.name,
        input.triggerEvent ?? existing.triggerEvent,
        JSON.stringify(input.conditions ?? existing.conditions ?? {}),
        JSON.stringify(input.actions ?? existing.actions),
        input.isActive ?? existing.isActive,
        id,
        ...this.scopeParams(scope),
      ],
    );
    if (result.rowCount === 0) return null;
    return this.mapRule(result.rows[0]);
  }

  async deleteAutomationRule(user: AuthContext, id: string): Promise<boolean> {
    const scope = getCRMScope(user);
    const result = await this.databaseService.query(
      `DELETE FROM crm_automation_rules
       WHERE id = $1 AND (${this.scopeClause("crm_automation_rules", 2)})
       RETURNING id`,
      [id, ...this.scopeParams(scope)],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async runAutomationRules(
    context: CRMContext,
    event: AutomationTrigger,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const scope: CRMScope = {
      organizationId: context.organizationId,
      ownerUserId: context.organizationId ? null : context.userId,
    };

    const rulesResult = await this.databaseService.query(
      `SELECT * FROM crm_automation_rules
       WHERE trigger_event = $1 AND is_active = TRUE AND (${this.scopeClause("crm_automation_rules", 2)})
       ORDER BY created_at ASC`,
      [event, ...this.scopeParams(scope)],
    );

    for (const row of rulesResult.rows) {
      const rule = this.mapRule(row);
      if (!this.matchesConditions(payload, rule.conditions ?? {})) continue;
      await this.executeActions(context, payload, rule.actions);
    }
  }

  private matchesConditions(
    payload: Record<string, unknown>,
    conditions: Record<string, unknown>,
  ): boolean {
    for (const [key, expected] of Object.entries(conditions)) {
      const actual = payload[key];
      if (
        typeof expected === "object" &&
        expected !== null &&
        !Array.isArray(expected)
      ) {
        const expObj = expected as Record<string, unknown>;
        if (expObj.eq !== undefined && actual !== expObj.eq) return false;
        if (expObj.neq !== undefined && actual === expObj.neq) return false;
        if (
          expObj.in !== undefined &&
          Array.isArray(expObj.in) &&
          !expObj.in.includes(actual)
        )
          return false;
        if (
          expObj.contains !== undefined &&
          typeof actual === "string" &&
          typeof expObj.contains === "string" &&
          !actual.includes(expObj.contains)
        )
          return false;
      } else {
        if (actual !== expected) return false;
      }
    }
    return true;
  }

  private async executeActions(
    context: CRMContext,
    payload: Record<string, unknown>,
    actions: AutomationRule["actions"],
  ): Promise<void> {
    const customerId = payload.customerId as string | undefined;
    if (!customerId) return;

    const baseWhere = context.organizationId
      ? "id = $1 AND organization_id = $2"
      : "id = $1 AND assigned_to_user_id = $2";
    const access = await this.databaseService.query(
      `SELECT id FROM customers WHERE ${baseWhere}`,
      [customerId, context.organizationId ?? context.userId],
    );
    if (access.rowCount === 0) return;

    for (const action of actions) {
      try {
        switch (action.type) {
          case "create_follow_up": {
            const config = action.config as {
              title?: string;
              dueDays?: number;
            };
            const title = config.title ?? "Follow-up";
            const dueDays = config.dueDays ?? 1;
            const dueAt = new Date();
            dueAt.setDate(dueAt.getDate() + dueDays);
            await this.databaseService.query(
              `INSERT INTO customer_follow_ups (customer_id, created_by_user_id, title, due_at)
               VALUES ($1, $2, $3, $4)`,
              [customerId, context.userId, title, dueAt.toISOString()],
            );
            break;
          }
          case "create_activity": {
            const config = action.config as {
              title?: string;
              body?: string;
              type?: string;
            };
            await this.databaseService.query(
              `INSERT INTO customer_activities (customer_id, created_by_user_id, type, title, body, occurred_at)
               VALUES ($1, $2, $3, $4, $5, now())`,
              [
                customerId,
                context.userId,
                config.type ?? "other",
                config.title ?? "Automated activity",
                config.body ?? null,
              ],
            );
            break;
          }
          case "send_webhook":
            await this.webhooksService.dispatchWebhook(
              context,
              "automation_rule_triggered",
              {
                customerId,
                ruleAction: action.config,
              },
            );
            break;
        }
      } catch {
        // Ignore individual action failures so one broken action doesn't stop others.
      }
    }
  }

  private mapRule(row: Record<string, unknown>): AutomationRule {
    return {
      id: row.id as string,
      organizationId: (row.organization_id as string | null) ?? null,
      ownerUserId: (row.owner_user_id as string | null) ?? null,
      name: row.name as string,
      triggerEvent: row.trigger_event as AutomationTrigger,
      conditions: (row.conditions as Record<string, unknown> | null) ?? null,
      actions: Array.isArray(row.actions)
        ? (row.actions as AutomationRule["actions"])
        : [],
      isActive: (row.is_active as boolean) ?? true,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  }
}

export class AutomationError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "AutomationError";
  }
}
