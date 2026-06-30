import { pool } from "../../../db/postgres.js";
import type {
  WebhookSubscription,
  WebhookSubscriptionInput,
  WebhookDelivery,
  CRMContext
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
  return planLimits[plan].maxWebhooks;
}

export async function listWebhookSubscriptions(scope: CRMScope): Promise<WebhookSubscription[]> {
  const result = await pool.query(
    `SELECT * FROM webhook_subscriptions
     WHERE ${scopeClause("webhook_subscriptions", 1)}
     ORDER BY created_at DESC`,
    scopeParams(scope)
  );
  return result.rows.map(mapSubscription);
}

export async function getWebhookSubscription(scope: CRMScope, id: string): Promise<WebhookSubscription | null> {
  const result = await pool.query(
    `SELECT * FROM webhook_subscriptions
     WHERE id = $1 AND (${scopeClause("webhook_subscriptions", 2)})`,
    [id, ...scopeParams(scope)]
  );
  if (result.rowCount === 0) return null;
  return mapSubscription(result.rows[0]);
}

export async function createWebhookSubscription(
  scope: CRMScope,
  user: AuthContext,
  input: WebhookSubscriptionInput
): Promise<WebhookSubscription> {
  const limit = assertPlanLimit(scope, user);
  if (limit !== null) {
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM webhook_subscriptions WHERE ${scopeClause("webhook_subscriptions", 1)}`,
      scopeParams(scope)
    );
    if (Number(countResult.rows[0].count) >= limit) {
      throw new WebhookError(`Webhook subscriptions limited to ${limit} on your plan.`, 402);
    }
  }

  const result = await pool.query(
    `INSERT INTO webhook_subscriptions
       (organization_id, owner_user_id, url, events, secret)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      scope.organizationId,
      scope.ownerUserId,
      input.url,
      input.events,
      input.secret ?? null
    ]
  );
  return mapSubscription(result.rows[0]);
}

export async function updateWebhookSubscription(
  scope: CRMScope,
  id: string,
  input: Partial<WebhookSubscriptionInput>
): Promise<WebhookSubscription | null> {
  const existing = await getWebhookSubscription(scope, id);
  if (!existing) return null;

  const result = await pool.query(
    `UPDATE webhook_subscriptions
     SET url = $1, events = $2, secret = $3, updated_at = now()
     WHERE id = $4 AND (${scopeClause("webhook_subscriptions", 5)})
     RETURNING *`,
    [
      input.url ?? existing.url,
      input.events ?? existing.events,
      input.secret !== undefined ? input.secret : existing.secret,
      id,
      ...scopeParams(scope)
    ]
  );
  if (result.rowCount === 0) return null;
  return mapSubscription(result.rows[0]);
}

export async function deleteWebhookSubscription(scope: CRMScope, id: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM webhook_subscriptions
     WHERE id = $1 AND (${scopeClause("webhook_subscriptions", 2)})
     RETURNING id`,
    [id, ...scopeParams(scope)]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function listWebhookDeliveries(scope: CRMScope, subscriptionId?: string): Promise<WebhookDelivery[]> {
  const base = `SELECT d.* FROM webhook_deliveries d
    JOIN webhook_subscriptions s ON s.id = d.subscription_id
    WHERE ${scopeClause("s", 1)}`;
  const params: (string | null)[] = [...scopeParams(scope)];
  let query = base;
  if (subscriptionId) {
    query += ` AND d.subscription_id = $3`;
    params.push(subscriptionId);
  }
  query += ` ORDER BY d.created_at DESC LIMIT 100`;
  const result = await pool.query(query, params);
  return result.rows.map(mapDelivery);
}

export async function dispatchWebhook(
  context: CRMContext,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  const scope: CRMScope = {
    organizationId: context.organizationId,
    ownerUserId: context.organizationId ? null : context.userId
  };

  const subsResult = await pool.query(
    `SELECT * FROM webhook_subscriptions
     WHERE is_active = TRUE AND ($1 = ANY(events) OR events @> ARRAY['*']::text[]) AND (${scopeClause("webhook_subscriptions", 2)})`,
    [event, ...scopeParams(scope)]
  );

  for (const row of subsResult.rows) {
    const subscription = mapSubscription(row);
    const deliveryResult = await pool.query(
      `INSERT INTO webhook_deliveries (subscription_id, event, payload, status)
       VALUES ($1, $2, $3, 'pending')
       RETURNING *`,
      [subscription.id, event, JSON.stringify(payload)]
    );
    const delivery = mapDelivery(deliveryResult.rows[0]);
    sendDelivery(subscription, delivery).catch(() => {});
  }
}

async function sendDelivery(
  subscription: WebhookSubscription,
  delivery: WebhookDelivery
): Promise<void> {
  const body = JSON.stringify({
    event: delivery.event,
    payload: delivery.payload,
    deliveredAt: new Date().toISOString()
  });

  let status = 0;
  let responseBody = "";
  let deliveryStatus: WebhookDelivery["status"] = "failed";

  try {
    const response = await fetch(subscription.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(subscription.secret ? { "X-OrbitOne-Secret": subscription.secret } : {})
      },
      body
    });
    status = response.status;
    responseBody = await response.text().catch(() => "");
    deliveryStatus = response.ok ? "delivered" : "failed";
  } catch (error) {
    deliveryStatus = "failed";
    responseBody = error instanceof Error ? error.message : "Network error";
  }

  await pool.query(
    `UPDATE webhook_deliveries
     SET status = $1, response_status = $2, response_body = $3, attempted_at = now()
     WHERE id = $4`,
    [deliveryStatus, status || null, responseBody, delivery.id]
  );
}

function mapSubscription(row: Record<string, unknown>): WebhookSubscription {
  return {
    id: row.id as string,
    organizationId: (row.organization_id as string | null) ?? null,
    ownerUserId: (row.owner_user_id as string | null) ?? null,
    url: row.url as string,
    events: Array.isArray(row.events) ? (row.events as string[]) : [],
    secret: (row.secret as string | null) ?? null,
    isActive: (row.is_active as boolean) ?? true,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString()
  };
}

function mapDelivery(row: Record<string, unknown>): WebhookDelivery {
  return {
    id: row.id as string,
    subscriptionId: row.subscription_id as string,
    event: row.event as string,
    payload: row.payload as unknown,
    status: row.status as WebhookDelivery["status"],
    responseStatus: (row.response_status as number | null) ?? null,
    attemptedAt: (row.attempted_at as Date | null)?.toISOString() ?? null,
    createdAt: (row.created_at as Date).toISOString()
  };
}

export class WebhookError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "WebhookError";
  }
}
