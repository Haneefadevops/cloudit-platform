import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { PoolClient } from "pg";
import { DatabaseService } from "../database/database.service";

type Product = "founding_pro" | "teams";
type Interval = "monthly" | "annual";
type Scope = {
  userId: string;
  organizationId: string | null;
  product: Product;
  interval: Interval;
};

type LemonSqueezyEvent = {
  eventName: string;
  eventId: string;
  eventCreated: number;
  scope: Scope;
  subscriptionId: string;
  customerId: string;
  variantId: string;
  status: string;
  currentPeriodEnd: Date | null;
  trialEndsAt: Date | null;
  cancelAtPeriodEnd: boolean;
};

type WebhookPayload = {
  meta?: {
    event_name?: unknown;
    custom_data?: Record<string, unknown>;
  };
  data?: {
    type?: unknown;
    id?: unknown;
    attributes?: Record<string, unknown>;
  };
};

@Injectable()
export class LemonSqueezyWebhookService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  verify(
    rawBody: Buffer | undefined,
    signature: string | undefined,
    headerEventName: string | undefined,
  ): LemonSqueezyEvent {
    const secret = this.config
      .get<string>("LEMON_SQUEEZY_WEBHOOK_SECRET")
      ?.trim();
    if (!secret) {
      throw new ServiceUnavailableException(
        "Billing webhook is not configured.",
      );
    }
    if (!rawBody?.length || !signature || !headerEventName) {
      throw new BadRequestException("Invalid billing webhook signature.");
    }
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const left = Buffer.from(signature, "utf8");
    const right = Buffer.from(expected, "utf8");
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new BadRequestException("Invalid billing webhook signature.");
    }

    let payload: WebhookPayload;
    try {
      payload = JSON.parse(rawBody.toString("utf8")) as WebhookPayload;
    } catch {
      throw new BadRequestException("Invalid billing webhook payload.");
    }
    const eventName = this.string(payload.meta?.event_name, 120);
    const allowedEvents = new Set([
      "subscription_created",
      "subscription_updated",
      "subscription_cancelled",
      "subscription_resumed",
      "subscription_expired",
      "subscription_paused",
      "subscription_unpaused",
    ]);
    if (
      eventName !== headerEventName ||
      !eventName ||
      !allowedEvents.has(eventName) ||
      payload.data?.type !== "subscriptions"
    ) {
      throw new BadRequestException("Invalid billing webhook payload.");
    }

    const attributes = payload.data.attributes;
    const scope = this.scope(payload.meta?.custom_data);
    const subscriptionId = this.identifier(payload.data.id);
    const customerId = this.identifier(attributes?.customer_id);
    const variantId = this.identifier(attributes?.variant_id);
    const storeId = this.identifier(attributes?.store_id);
    const status = this.normalizedStatus(attributes?.status);
    const updatedAt = this.date(attributes?.updated_at);
    const expectedMode = this.testMode();
    if (
      !scope ||
      !subscriptionId ||
      !customerId ||
      !variantId ||
      !storeId ||
      storeId !== this.config.get<string>("LEMON_SQUEEZY_STORE_ID")?.trim() ||
      !status ||
      !updatedAt ||
      expectedMode === null ||
      attributes?.test_mode !== expectedMode
    ) {
      throw new BadRequestException("Invalid billing webhook payload.");
    }

    const cancelled = attributes.cancelled === true;
    const periodValue = cancelled ? attributes.ends_at : attributes.renews_at;
    return {
      eventName,
      eventId: `lemon_squeezy:${createHash("sha256").update(rawBody).digest("hex")}`,
      eventCreated: updatedAt.getTime(),
      scope,
      subscriptionId,
      customerId,
      variantId,
      status,
      currentPeriodEnd: this.date(periodValue),
      trialEndsAt: this.date(attributes.trial_ends_at),
      cancelAtPeriodEnd: cancelled,
    };
  }

  async process(event: LemonSqueezyEvent): Promise<{ duplicate: boolean }> {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      const claimed = await client.query(
        `INSERT INTO billing_webhook_events (
           provider_event_id, event_type, event_created
         ) VALUES ($1,$2,$3)
         ON CONFLICT (provider_event_id) DO NOTHING RETURNING provider_event_id`,
        [event.eventId, event.eventName, event.eventCreated],
      );
      if (!claimed.rowCount) {
        await client.query("COMMIT");
        return { duplicate: true };
      }

      if (
        !(await this.validScope(client, event.scope)) ||
        event.variantId !== this.expectedVariantId(event.scope)
      ) {
        await client.query("COMMIT");
        return { duplicate: false };
      }

      const result = await client.query(
        `INSERT INTO billing_subscriptions (
           organization_id, owner_user_id, provider, provider_customer_id,
           provider_subscription_id, provider_price_id, product_key,
           billing_interval, status, current_period_end, cancel_at_period_end,
           last_event_created
         ) VALUES ($1,$2,'lemon_squeezy',$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (provider_customer_id) DO UPDATE SET
           organization_id = EXCLUDED.organization_id,
           owner_user_id = EXCLUDED.owner_user_id,
           provider = EXCLUDED.provider,
           provider_subscription_id = EXCLUDED.provider_subscription_id,
           provider_price_id = EXCLUDED.provider_price_id,
           product_key = EXCLUDED.product_key,
           billing_interval = EXCLUDED.billing_interval,
           status = EXCLUDED.status,
           current_period_end = EXCLUDED.current_period_end,
           cancel_at_period_end = EXCLUDED.cancel_at_period_end,
           last_event_created = EXCLUDED.last_event_created,
           updated_at = now()
         WHERE billing_subscriptions.provider = 'lemon_squeezy'
           AND billing_subscriptions.last_event_created <= EXCLUDED.last_event_created
         RETURNING id`,
        [
          event.scope.organizationId,
          event.scope.userId,
          event.customerId,
          event.subscriptionId,
          event.variantId,
          event.scope.product,
          event.scope.interval,
          event.status,
          event.currentPeriodEnd,
          event.cancelAtPeriodEnd,
          event.eventCreated,
        ],
      );
      if (result.rowCount) {
        await this.applyEntitlement(client, event);
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

  private async applyEntitlement(client: PoolClient, event: LemonSqueezyEvent) {
    const entitled = [
      "trialing",
      "active",
      "past_due",
      "paused",
      "unpaid",
    ].includes(event.status);
    const plan = entitled
      ? event.scope.product === "teams"
        ? "pro_business_starter"
        : "pro_individual"
      : "free";
    const planStatus =
      event.status === "trialing"
        ? "trialing"
        : event.status === "past_due" || event.status === "unpaid"
          ? "past_due"
          : entitled
            ? "active"
            : "cancelled";
    if (event.scope.organizationId) {
      await client.query(
        `UPDATE organizations SET plan = $2, plan_status = $3,
           trial_ends_at = $4, subscription_renewal_at = $5, updated_at = now()
         WHERE id = $1`,
        [
          event.scope.organizationId,
          plan,
          planStatus,
          event.trialEndsAt,
          event.currentPeriodEnd,
        ],
      );
    } else {
      await client.query(
        "UPDATE users SET plan = $2, updated_at = now() WHERE id = $1",
        [event.scope.userId, plan],
      );
    }
  }

  private scope(value: Record<string, unknown> | undefined): Scope | null {
    const userId = this.string(value?.notchme_user_id, 255);
    const organizationId = this.string(value?.notchme_organization_id, 255);
    const product = value?.notchme_product;
    const interval = value?.notchme_interval;
    if (
      !userId ||
      (product !== "founding_pro" && product !== "teams") ||
      (interval !== "monthly" && interval !== "annual")
    ) {
      return null;
    }
    return { userId, organizationId, product, interval };
  }

  private async validScope(client: PoolClient, scope: Scope): Promise<boolean> {
    const result = scope.organizationId
      ? await client.query(
          "SELECT 1 FROM users WHERE id = $1 AND organization_id = $2",
          [scope.userId, scope.organizationId],
        )
      : await client.query(
          "SELECT 1 FROM users WHERE id = $1 AND organization_id IS NULL",
          [scope.userId],
        );
    return Boolean(result.rowCount);
  }

  private expectedVariantId(scope: Scope): string | null {
    const product = scope.product === "founding_pro" ? "FOUNDING_PRO" : "TEAMS";
    return (
      this.config
        .get<string>(
          `LEMON_SQUEEZY_${product}_${scope.interval.toUpperCase()}_VARIANT_ID`,
        )
        ?.trim() || null
    );
  }

  private normalizedStatus(value: unknown): string | null {
    const mapped: Record<string, string> = {
      on_trial: "trialing",
      active: "active",
      paused: "paused",
      past_due: "past_due",
      unpaid: "unpaid",
      cancelled: "active",
      expired: "canceled",
    };
    return typeof value === "string" ? (mapped[value] ?? null) : null;
  }

  private testMode(): boolean | null {
    const value = this.config.get<string>("LEMON_SQUEEZY_TEST_MODE")?.trim();
    if (value === "true") return true;
    if (value === "false") return false;
    return null;
  }

  private identifier(value: unknown): string | null {
    if (
      typeof value === "number" &&
      Number.isSafeInteger(value) &&
      value >= 0
    ) {
      return String(value);
    }
    return typeof value === "string" && /^\d+$/.test(value) ? value : null;
  }

  private string(value: unknown, max: number): string | null {
    return typeof value === "string" && value.length > 0 && value.length <= max
      ? value
      : null;
  }

  private date(value: unknown): Date | null {
    if (typeof value !== "string") return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
}

export type { LemonSqueezyEvent };
