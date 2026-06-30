import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../../database/database.service";
import { PlanService } from "../../common/services/plan.service";
import type {
  WebhookSubscription,
  WebhookSubscriptionInput,
  WebhookDelivery,
  CRMContext,
} from "../../common/contracts/orbitone.v2";
import type { AuthContext } from "../../auth/types";
import { CRMScope, getCRMScope } from "../crm.types";

@Injectable()
export class WebhooksService {
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
    return this.planService.getPlanLimit(plan).maxWebhooks;
  }

  async listWebhookSubscriptions(
    user: AuthContext,
  ): Promise<WebhookSubscription[]> {
    const scope = getCRMScope(user);
    const result = await this.databaseService.query(
      `SELECT * FROM webhook_subscriptions
       WHERE ${this.scopeClause("webhook_subscriptions", 1)}
       ORDER BY created_at DESC`,
      this.scopeParams(scope),
    );
    return result.rows.map((row) => this.mapSubscription(row));
  }

  async getWebhookSubscription(
    user: AuthContext,
    id: string,
  ): Promise<WebhookSubscription | null> {
    const scope = getCRMScope(user);
    const result = await this.databaseService.query(
      `SELECT * FROM webhook_subscriptions
       WHERE id = $1 AND (${this.scopeClause("webhook_subscriptions", 2)})`,
      [id, ...this.scopeParams(scope)],
    );
    if (result.rowCount === 0) return null;
    return this.mapSubscription(result.rows[0]);
  }

  async createWebhookSubscription(
    user: AuthContext,
    input: WebhookSubscriptionInput,
  ): Promise<WebhookSubscription> {
    const scope = getCRMScope(user);
    const limit = this.assertPlanLimit(scope, user);
    if (limit !== null) {
      const countResult = await this.databaseService.query(
        `SELECT COUNT(*) FROM webhook_subscriptions WHERE ${this.scopeClause("webhook_subscriptions", 1)}`,
        this.scopeParams(scope),
      );
      if (Number(countResult.rows[0].count) >= limit) {
        throw new WebhookError(
          `Webhook subscriptions limited to ${limit} on your plan.`,
          402,
        );
      }
    }

    const result = await this.databaseService.query(
      `INSERT INTO webhook_subscriptions
         (organization_id, owner_user_id, url, events, secret)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        scope.organizationId,
        scope.ownerUserId,
        input.url,
        input.events,
        input.secret ?? null,
      ],
    );
    return this.mapSubscription(result.rows[0]);
  }

  async updateWebhookSubscription(
    user: AuthContext,
    id: string,
    input: Partial<WebhookSubscriptionInput>,
  ): Promise<WebhookSubscription | null> {
    const scope = getCRMScope(user);
    const existing = await this.getWebhookSubscription(user, id);
    if (!existing) return null;

    const result = await this.databaseService.query(
      `UPDATE webhook_subscriptions
       SET url = $1, events = $2, secret = $3, updated_at = now()
       WHERE id = $4 AND (${this.scopeClause("webhook_subscriptions", 5)})
       RETURNING *`,
      [
        input.url ?? existing.url,
        input.events ?? existing.events,
        input.secret !== undefined ? input.secret : existing.secret,
        id,
        ...this.scopeParams(scope),
      ],
    );
    if (result.rowCount === 0) return null;
    return this.mapSubscription(result.rows[0]);
  }

  async deleteWebhookSubscription(
    user: AuthContext,
    id: string,
  ): Promise<boolean> {
    const scope = getCRMScope(user);
    const result = await this.databaseService.query(
      `DELETE FROM webhook_subscriptions
       WHERE id = $1 AND (${this.scopeClause("webhook_subscriptions", 2)})
       RETURNING id`,
      [id, ...this.scopeParams(scope)],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  async listWebhookDeliveries(
    user: AuthContext,
    subscriptionId?: string,
  ): Promise<WebhookDelivery[]> {
    const scope = getCRMScope(user);
    const base = `SELECT d.* FROM webhook_deliveries d
      JOIN webhook_subscriptions s ON s.id = d.subscription_id
      WHERE ${this.scopeClause("s", 1)}`;
    const params: (string | null)[] = [...this.scopeParams(scope)];
    let query = base;
    if (subscriptionId) {
      query += ` AND d.subscription_id = $3`;
      params.push(subscriptionId);
    }
    query += ` ORDER BY d.created_at DESC LIMIT 100`;
    const result = await this.databaseService.query(query, params);
    return result.rows.map((row) => this.mapDelivery(row));
  }

  async dispatchWebhook(
    context: CRMContext,
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const scope: CRMScope = {
      organizationId: context.organizationId,
      ownerUserId: context.organizationId ? null : context.userId,
    };

    const subsResult = await this.databaseService.query(
      `SELECT * FROM webhook_subscriptions
       WHERE is_active = TRUE AND ($1 = ANY(events) OR events @> ARRAY['*']::text[]) AND (${this.scopeClause("webhook_subscriptions", 2)})`,
      [event, ...this.scopeParams(scope)],
    );

    for (const row of subsResult.rows) {
      const subscription = this.mapSubscription(row);
      const deliveryResult = await this.databaseService.query(
        `INSERT INTO webhook_deliveries (subscription_id, event, payload, status)
         VALUES ($1, $2, $3, 'pending')
         RETURNING *`,
        [subscription.id, event, JSON.stringify(payload)],
      );
      const delivery = this.mapDelivery(deliveryResult.rows[0]);
      this.sendDelivery(subscription, delivery).catch(() => {});
    }
  }

  private async sendDelivery(
    subscription: WebhookSubscription,
    delivery: WebhookDelivery,
  ): Promise<void> {
    const body = JSON.stringify({
      event: delivery.event,
      payload: delivery.payload,
      deliveredAt: new Date().toISOString(),
    });

    let status = 0;
    let responseBody = "";
    let deliveryStatus: WebhookDelivery["status"] = "failed";

    try {
      const response = await fetch(subscription.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(subscription.secret
            ? { "X-OrbitOne-Secret": subscription.secret }
            : {}),
        },
        body,
      });
      status = response.status;
      responseBody = await response.text().catch(() => "");
      deliveryStatus = response.ok ? "delivered" : "failed";
    } catch (error) {
      deliveryStatus = "failed";
      responseBody = error instanceof Error ? error.message : "Network error";
    }

    await this.databaseService.query(
      `UPDATE webhook_deliveries
       SET status = $1, response_status = $2, response_body = $3, attempted_at = now()
       WHERE id = $4`,
      [deliveryStatus, status || null, responseBody, delivery.id],
    );
  }

  private mapSubscription(row: Record<string, unknown>): WebhookSubscription {
    return {
      id: row.id as string,
      organizationId: (row.organization_id as string | null) ?? null,
      ownerUserId: (row.owner_user_id as string | null) ?? null,
      url: row.url as string,
      events: Array.isArray(row.events) ? (row.events as string[]) : [],
      secret: (row.secret as string | null) ?? null,
      isActive: (row.is_active as boolean) ?? true,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  }

  private mapDelivery(row: Record<string, unknown>): WebhookDelivery {
    return {
      id: row.id as string,
      subscriptionId: row.subscription_id as string,
      event: row.event as string,
      payload: row.payload,
      status: row.status as WebhookDelivery["status"],
      responseStatus: (row.response_status as number | null) ?? null,
      attemptedAt: (row.attempted_at as Date | null)?.toISOString() ?? null,
      createdAt: (row.created_at as Date).toISOString(),
    };
  }
}

export class WebhookError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "WebhookError";
  }
}
