import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CheckoutInput } from "./billing.schemas";

type CheckoutResponse = {
  data?: { id?: string; attributes?: { url?: string } };
};

type SubscriptionResponse = {
  data?: {
    attributes?: { urls?: { customer_portal?: string | null } };
  };
};

@Injectable()
export class LemonSqueezyBillingProvider {
  constructor(private readonly config: ConfigService) {}

  enabled(): boolean {
    return Boolean(
      this.config.get<string>("LEMON_SQUEEZY_API_KEY")?.trim() &&
      this.config.get<string>("LEMON_SQUEEZY_WEBHOOK_SECRET")?.trim() &&
      this.storeId() &&
      this.testMode() !== null,
    );
  }

  variantId(input: CheckoutInput): string | null {
    const product = input.product === "founding_pro" ? "FOUNDING_PRO" : "TEAMS";
    return (
      this.config
        .get<string>(
          `LEMON_SQUEEZY_${product}_${input.interval.toUpperCase()}_VARIANT_ID`,
        )
        ?.trim() || null
    );
  }

  configured(input: CheckoutInput): boolean {
    return this.enabled() && Boolean(this.variantId(input));
  }

  async createCheckout(input: {
    selection: CheckoutInput;
    userId: string;
    organizationId: string | null;
    email: string;
    trialEligible: boolean;
  }): Promise<{ id: string; url: string | null }> {
    const storeId = this.storeId();
    const variantId = this.variantId(input.selection);
    const webUrl = this.webUrl();
    if (!this.enabled() || !storeId || !variantId || !webUrl) {
      throw new ServiceUnavailableException("Billing is not configured.");
    }

    const custom: Record<string, string> = {
      notchme_user_id: input.userId,
      notchme_product: input.selection.product,
      notchme_interval: input.selection.interval,
    };
    if (input.organizationId) {
      custom.notchme_organization_id = input.organizationId;
    }

    const response = await this.request<CheckoutResponse>("/v1/checkouts", {
      method: "POST",
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            product_options: {
              redirect_url: `${webUrl}/dashboard/upgrade?checkout=success`,
              receipt_button_text: "Return to NotchMe",
              receipt_link_url: `${webUrl}/dashboard/upgrade`,
            },
            checkout_options: {
              embed: false,
              skip_trial: !input.trialEligible,
            },
            checkout_data: { email: input.email, custom },
          },
          relationships: {
            store: { data: { type: "stores", id: storeId } },
            variant: { data: { type: "variants", id: variantId } },
          },
        },
      }),
    });
    return {
      id: response.data?.id ?? "",
      url: response.data?.attributes?.url ?? null,
    };
  }

  async createPortal(subscriptionId: string): Promise<{ url: string | null }> {
    if (!this.enabled() || !/^\d+$/.test(subscriptionId)) {
      throw new ServiceUnavailableException("Billing is not configured.");
    }
    const response = await this.request<SubscriptionResponse>(
      `/v1/subscriptions/${subscriptionId}`,
      { method: "GET" },
    );
    return {
      url: response.data?.attributes?.urls?.customer_portal ?? null,
    };
  }

  private storeId(): string | null {
    const value = this.config.get<string>("LEMON_SQUEEZY_STORE_ID")?.trim();
    return value && /^\d+$/.test(value) ? value : null;
  }

  private testMode(): boolean | null {
    const value = this.config.get<string>("LEMON_SQUEEZY_TEST_MODE")?.trim();
    if (value === "true") return true;
    if (value === "false") return false;
    return null;
  }

  private webUrl(): string | null {
    const value = this.config.get<string>("NOTCHME_WEB_URL")?.trim();
    if (!value) return null;
    try {
      const url = new URL(value);
      const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
      if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
        return null;
      }
      return url.origin;
    } catch {
      return null;
    }
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const apiKey = this.config.get<string>("LEMON_SQUEEZY_API_KEY")?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException("Billing is not configured.");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`https://api.lemonsqueezy.com${path}`, {
        ...init,
        headers: {
          Accept: "application/vnd.api+json",
          "Content-Type": "application/vnd.api+json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new ServiceUnavailableException(
          "The billing provider is temporarily unavailable.",
        );
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(
        "The billing provider is temporarily unavailable.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
