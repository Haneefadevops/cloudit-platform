import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { AuthContext } from "../auth/types";
import { DatabaseService } from "../database/database.service";
import type { CheckoutInput } from "./billing.schemas";
import { LemonSqueezyBillingProvider } from "./lemon-squeezy-billing.provider";

type SubscriptionRow = {
  provider: "stripe" | "lemon_squeezy";
  provider_customer_id: string;
  provider_subscription_id: string | null;
  product_key: "founding_pro" | "teams";
  billing_interval: "monthly" | "annual";
  status: string;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
};

@Injectable()
export class BillingService {
  constructor(
    private readonly db: DatabaseService,
    private readonly provider: LemonSqueezyBillingProvider,
  ) {}

  async status(user: AuthContext) {
    const subscription = await this.subscription(user);
    const products = {
      foundingPro: {
        monthly: this.provider.configured({
          product: "founding_pro" as const,
          interval: "monthly" as const,
        }),
        annual: this.provider.configured({
          product: "founding_pro" as const,
          interval: "annual" as const,
        }),
      },
      teams: {
        monthly: this.provider.configured({
          product: "teams" as const,
          interval: "monthly" as const,
        }),
        annual: this.provider.configured({
          product: "teams" as const,
          interval: "annual" as const,
        }),
      },
    };
    return {
      provider: "lemon_squeezy" as const,
      checkoutEnabled: Object.values(products).some((product) =>
        Object.values(product).some(Boolean),
      ),
      products,
      subscription: subscription ? this.serialize(subscription) : null,
      taxNotice:
        "Lemon Squeezy is the merchant of record and calculates, collects, and remits applicable sales tax and VAT at checkout.",
    };
  }

  async checkout(user: AuthContext, selection: CheckoutInput) {
    this.assertBillingAuthority(user);
    if (selection.product === "teams" && !user.organizationId) {
      throw new ConflictException(
        "Create a team workspace before choosing the Teams plan.",
      );
    }
    if (!this.provider.configured(selection)) {
      throw new ServiceUnavailableException(
        "This billing option is not configured.",
      );
    }
    const existing = await this.subscription(user);
    if (
      existing?.provider_subscription_id &&
      ["trialing", "active", "past_due", "paused"].includes(existing.status)
    ) {
      throw new ConflictException(
        "Manage the existing subscription in the billing portal.",
      );
    }
    const session = await this.provider.createCheckout({
      selection,
      userId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      trialEligible: !existing,
    });
    return { url: this.safeLemonSqueezyUrl(session.url) };
  }

  async portal(user: AuthContext) {
    this.assertBillingAuthority(user);
    const subscription = await this.subscription(user);
    if (!subscription?.provider_subscription_id) {
      throw new NotFoundException("No billing account is available yet.");
    }
    if (subscription.provider !== "lemon_squeezy") {
      throw new ConflictException(
        "This legacy subscription cannot be managed through the active billing provider.",
      );
    }
    const session = await this.provider.createPortal(
      subscription.provider_subscription_id,
    );
    return { url: this.safeLemonSqueezyUrl(session.url) };
  }

  private assertBillingAuthority(user: AuthContext): void {
    if (
      user.organizationId &&
      user.role !== "admin" &&
      !user.isBillingContact
    ) {
      throw new ForbiddenException(
        "Only an organization admin or billing contact can manage billing.",
      );
    }
  }

  private async subscription(
    user: AuthContext,
  ): Promise<SubscriptionRow | null> {
    const result = user.organizationId
      ? await this.db.query<SubscriptionRow>(
          `SELECT * FROM billing_subscriptions
           WHERE organization_id = $1`,
          [user.organizationId],
        )
      : await this.db.query<SubscriptionRow>(
          `SELECT * FROM billing_subscriptions
           WHERE organization_id IS NULL AND owner_user_id = $1`,
          [user.id],
        );
    return result.rows[0] ?? null;
  }

  private serialize(row: SubscriptionRow) {
    return {
      product: row.product_key,
      interval: row.billing_interval,
      status: row.status,
      currentPeriodEnd: row.current_period_end?.toISOString() ?? null,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      canManage: Boolean(row.provider_subscription_id),
    };
  }

  private safeLemonSqueezyUrl(value: string | null): string {
    if (!value) {
      throw new ServiceUnavailableException(
        "The billing provider returned no redirect.",
      );
    }
    try {
      const url = new URL(value);
      if (
        url.protocol !== "https:" ||
        (url.hostname !== "lemonsqueezy.com" &&
          !url.hostname.endsWith(".lemonsqueezy.com"))
      )
        throw new Error();
      return url.toString();
    } catch {
      throw new ServiceUnavailableException(
        "The billing provider returned an invalid redirect.",
      );
    }
  }
}
