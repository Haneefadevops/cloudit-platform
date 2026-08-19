import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import { DatabaseService } from "../database/database.service";
import type { PoolClient } from "pg";

type StripeEvent = {
  id: string;
  type: string;
  created: number;
  data: { object: Record<string, unknown> };
};

type SubscriptionObject = Record<string, unknown> & {
  id?: string;
  customer?: string;
  status?: string;
  current_period_end?: number;
  trial_end?: number | null;
  cancel_at_period_end?: boolean;
  metadata?: Record<string, string>;
  items?: { data?: Array<{ price?: { id?: string } }> };
};

type Scope = {
  userId: string;
  organizationId: string | null;
  product: "founding_pro" | "teams";
  interval: "monthly" | "annual";
};

@Injectable()
export class StripeWebhookService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  verify(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): StripeEvent {
    const secret = this.config.get<string>("STRIPE_WEBHOOK_SECRET")?.trim();
    if (!secret) {
      throw new ServiceUnavailableException(
        "Billing webhook is not configured.",
      );
    }
    if (!rawBody?.length || !signature) {
      throw new BadRequestException("Invalid billing webhook signature.");
    }
    const parts = signature
      .split(",")
      .reduce<Record<string, string[]>>((all, part) => {
        const [key, value] = part.split("=", 2);
        if (key && value) (all[key] ??= []).push(value);
        return all;
      }, {});
    const timestamp = Number(parts.t?.[0]);
    if (
      !Number.isInteger(timestamp) ||
      Math.abs(Date.now() / 1000 - timestamp) > 300
    ) {
      throw new BadRequestException("Invalid billing webhook signature.");
    }
    const expected = createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody.toString("utf8")}`)
      .digest("hex");
    const valid = (parts.v1 ?? []).some((candidate) => {
      const left = Buffer.from(candidate, "hex");
      const right = Buffer.from(expected, "hex");
      return left.length === right.length && timingSafeEqual(left, right);
    });
    if (!valid) {
      throw new BadRequestException("Invalid billing webhook signature.");
    }
    try {
      const event = JSON.parse(rawBody.toString("utf8")) as StripeEvent;
      if (!event.id || !event.type || !Number.isInteger(event.created))
        throw new Error();
      return event;
    } catch {
      throw new BadRequestException("Invalid billing webhook payload.");
    }
  }

  async process(event: StripeEvent): Promise<{ duplicate: boolean }> {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      const claimed = await client.query(
        `INSERT INTO billing_webhook_events (
           provider_event_id, event_type, event_created
         ) VALUES ($1,$2,$3)
         ON CONFLICT (provider_event_id) DO NOTHING RETURNING provider_event_id`,
        [event.id, event.type.slice(0, 120), event.created],
      );
      if (!claimed.rowCount) {
        await client.query("COMMIT");
        return { duplicate: true };
      }

      if (
        event.type === "customer.subscription.created" ||
        event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted"
      ) {
        await this.applySubscription(client, event);
      } else if (event.type === "checkout.session.completed") {
        await this.recordCheckout(client, event);
      } else if (event.type === "invoice.payment_failed") {
        await this.recordPaymentFailure(client, event);
      }

      await client.query("COMMIT");
      return { duplicate: false };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async applySubscription(client: PoolClient, event: StripeEvent) {
    const object = event.data.object as SubscriptionObject;
    const scope = this.scope(object.metadata);
    const customerId = this.string(object.customer);
    const subscriptionId = this.string(object.id);
    const status = this.subscriptionStatus(object.status);
    if (!scope || !customerId || !subscriptionId || !status) return;
    const priceId = object.items?.data?.[0]?.price?.id ?? null;
    if (
      !(await this.validScope(client, scope)) ||
      !priceId ||
      priceId !== this.expectedPriceId(scope)
    ) {
      return;
    }
    const currentPeriodEnd = this.timestamp(object.current_period_end);
    const result = await client.query(
      `INSERT INTO billing_subscriptions (
         organization_id, owner_user_id, provider_customer_id,
         provider_subscription_id, provider_price_id, product_key,
         billing_interval, status, current_period_end, cancel_at_period_end,
         last_event_created
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (provider_customer_id) DO UPDATE SET
         organization_id = EXCLUDED.organization_id,
         owner_user_id = EXCLUDED.owner_user_id,
         provider_subscription_id = EXCLUDED.provider_subscription_id,
         provider_price_id = EXCLUDED.provider_price_id,
         product_key = EXCLUDED.product_key,
         billing_interval = EXCLUDED.billing_interval,
         status = EXCLUDED.status,
         current_period_end = EXCLUDED.current_period_end,
         cancel_at_period_end = EXCLUDED.cancel_at_period_end,
         last_event_created = EXCLUDED.last_event_created,
         updated_at = now()
       WHERE billing_subscriptions.last_event_created <= EXCLUDED.last_event_created
       RETURNING id`,
      [
        scope.organizationId,
        scope.userId,
        customerId,
        subscriptionId,
        priceId,
        scope.product,
        scope.interval,
        status,
        currentPeriodEnd,
        Boolean(object.cancel_at_period_end),
        event.created,
      ],
    );
    if (result.rowCount) {
      await this.applyEntitlement(
        client,
        scope,
        status,
        currentPeriodEnd,
        this.timestamp(object.trial_end),
      );
    }
  }

  private async recordCheckout(client: PoolClient, event: StripeEvent) {
    const object = event.data.object;
    const metadata = object.metadata as Record<string, string> | undefined;
    const scope = this.scope(metadata);
    const customerId = this.string(object.customer);
    const subscriptionId = this.string(object.subscription);
    if (!scope || !customerId || !subscriptionId) return;
    if (!(await this.validScope(client, scope))) return;
    await client.query(
      `INSERT INTO billing_subscriptions (
         organization_id, owner_user_id, provider_customer_id,
         provider_subscription_id, product_key, billing_interval,
         status, last_event_created
       ) VALUES ($1,$2,$3,$4,$5,$6,'incomplete',$7)
       ON CONFLICT (provider_customer_id) DO UPDATE SET
         provider_subscription_id = EXCLUDED.provider_subscription_id,
         last_event_created = EXCLUDED.last_event_created,
         updated_at = now()
       WHERE billing_subscriptions.last_event_created <= EXCLUDED.last_event_created`,
      [
        scope.organizationId,
        scope.userId,
        customerId,
        subscriptionId,
        scope.product,
        scope.interval,
        event.created,
      ],
    );
  }

  private async recordPaymentFailure(client: PoolClient, event: StripeEvent) {
    const subscriptionId = this.string(event.data.object.subscription);
    if (!subscriptionId) return;
    const result = await client.query<{
      organization_id: string | null;
      owner_user_id: string;
      product_key: "founding_pro" | "teams";
      billing_interval: "monthly" | "annual";
    }>(
      `UPDATE billing_subscriptions
       SET status = 'past_due', last_event_created = $2, updated_at = now()
       WHERE provider_subscription_id = $1 AND last_event_created <= $2
       RETURNING organization_id, owner_user_id, product_key, billing_interval`,
      [subscriptionId, event.created],
    );
    const row = result.rows[0];
    if (row) {
      await this.applyEntitlement(
        client,
        {
          organizationId: row.organization_id,
          userId: row.owner_user_id,
          product: row.product_key,
          interval: row.billing_interval,
        },
        "past_due",
        null,
        null,
      );
    }
  }

  private async applyEntitlement(
    client: PoolClient,
    scope: Scope,
    status: string,
    renewalAt: Date | null,
    trialEndsAt: Date | null,
  ) {
    const entitled = ["trialing", "active", "past_due"].includes(status);
    const plan = entitled
      ? scope.product === "teams"
        ? "pro_business_starter"
        : "pro_individual"
      : "free";
    const planStatus =
      status === "trialing"
        ? "trialing"
        : status === "past_due" || status === "unpaid"
          ? "past_due"
          : status === "active"
            ? "active"
            : "cancelled";
    if (scope.organizationId) {
      await client.query(
        `UPDATE organizations SET plan = $2, plan_status = $3,
           trial_ends_at = $4, subscription_renewal_at = $5, updated_at = now()
         WHERE id = $1`,
        [scope.organizationId, plan, planStatus, trialEndsAt, renewalAt],
      );
    } else {
      await client.query(
        "UPDATE users SET plan = $2, updated_at = now() WHERE id = $1",
        [scope.userId, plan],
      );
    }
  }

  private scope(metadata: Record<string, string> | undefined): Scope | null {
    const userId = metadata?.notchme_user_id;
    const product = metadata?.notchme_product;
    const interval = metadata?.notchme_interval;
    if (
      !userId ||
      (product !== "founding_pro" && product !== "teams") ||
      (interval !== "monthly" && interval !== "annual")
    ) {
      return null;
    }
    return {
      userId,
      organizationId: metadata?.notchme_organization_id || null,
      product,
      interval,
    };
  }

  private async validScope(client: PoolClient, scope: Scope): Promise<boolean> {
    const result = scope.organizationId
      ? await client.query(
          `SELECT 1 FROM users
           WHERE id = $1 AND organization_id = $2`,
          [scope.userId, scope.organizationId],
        )
      : await client.query(
          `SELECT 1 FROM users
           WHERE id = $1 AND organization_id IS NULL`,
          [scope.userId],
        );
    return Boolean(result.rowCount);
  }

  private expectedPriceId(scope: Scope): string | null {
    const product = scope.product === "founding_pro" ? "FOUNDING_PRO" : "TEAMS";
    return (
      this.config
        .get<string>(
          `STRIPE_${product}_${scope.interval.toUpperCase()}_PRICE_ID`,
        )
        ?.trim() || null
    );
  }

  private subscriptionStatus(value: unknown): string | null {
    const allowed = [
      "incomplete",
      "incomplete_expired",
      "trialing",
      "active",
      "past_due",
      "canceled",
      "unpaid",
      "paused",
    ];
    return typeof value === "string" && allowed.includes(value) ? value : null;
  }

  private string(value: unknown): string | null {
    return typeof value === "string" && value.length <= 255 ? value : null;
  }

  private timestamp(value: unknown): Date | null {
    return typeof value === "number" && Number.isFinite(value)
      ? new Date(value * 1000)
      : null;
  }
}
