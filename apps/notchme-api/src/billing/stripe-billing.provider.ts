import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CheckoutInput } from "./billing.schemas";

type StripeSession = { id: string; url: string | null };

@Injectable()
export class StripeBillingProvider {
  constructor(private readonly config: ConfigService) {}

  enabled(): boolean {
    return Boolean(
      this.config.get<string>("STRIPE_SECRET_KEY")?.trim() &&
      this.config.get<string>("STRIPE_WEBHOOK_SECRET")?.trim(),
    );
  }

  priceId(input: CheckoutInput): string | null {
    const suffix = `${input.product === "founding_pro" ? "FOUNDING_PRO" : "TEAMS"}_${input.interval.toUpperCase()}_PRICE_ID`;
    return this.config.get<string>(`STRIPE_${suffix}`)?.trim() || null;
  }

  configured(input: CheckoutInput): boolean {
    return this.enabled() && Boolean(this.priceId(input));
  }

  async createCheckout(input: {
    selection: CheckoutInput;
    userId: string;
    organizationId: string | null;
    email: string;
    customerId: string | null;
    trialEligible: boolean;
  }): Promise<StripeSession> {
    const price = this.priceId(input.selection);
    const webUrl = this.webUrl();
    if (!this.enabled() || !price || !webUrl) {
      throw new ServiceUnavailableException("Billing is not configured.");
    }
    const form = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": price,
      "line_items[0][quantity]": "1",
      success_url: `${webUrl}/dashboard/upgrade?checkout=success`,
      cancel_url: `${webUrl}/dashboard/upgrade?checkout=cancelled`,
      client_reference_id: input.organizationId ?? input.userId,
      "automatic_tax[enabled]": "true",
      "tax_id_collection[enabled]": "true",
      billing_address_collection: "required",
      payment_method_collection: input.trialEligible ? "if_required" : "always",
      "subscription_data[metadata][notchme_user_id]": input.userId,
      "subscription_data[metadata][notchme_product]": input.selection.product,
      "subscription_data[metadata][notchme_interval]": input.selection.interval,
      "metadata[notchme_user_id]": input.userId,
      "metadata[notchme_product]": input.selection.product,
      "metadata[notchme_interval]": input.selection.interval,
    });
    if (input.trialEligible) {
      form.set("subscription_data[trial_period_days]", "14");
      form.set(
        "subscription_data[trial_settings][end_behavior][missing_payment_method]",
        "cancel",
      );
    }
    if (input.organizationId) {
      form.set(
        "subscription_data[metadata][notchme_organization_id]",
        input.organizationId,
      );
      form.set("metadata[notchme_organization_id]", input.organizationId);
    }
    if (input.customerId) {
      form.set("customer", input.customerId);
      form.set("customer_update[address]", "auto");
      form.set("customer_update[name]", "auto");
    } else {
      form.set("customer_email", input.email);
    }
    return this.request<StripeSession>("/v1/checkout/sessions", form);
  }

  async createPortal(customerId: string): Promise<StripeSession> {
    const webUrl = this.webUrl();
    if (!this.enabled() || !webUrl) {
      throw new ServiceUnavailableException("Billing is not configured.");
    }
    return this.request<StripeSession>(
      "/v1/billing_portal/sessions",
      new URLSearchParams({
        customer: customerId,
        return_url: `${webUrl}/dashboard/upgrade`,
      }),
    );
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

  private async request<T>(path: string, form: URLSearchParams): Promise<T> {
    const secret = this.config.get<string>("STRIPE_SECRET_KEY")?.trim();
    if (!secret) {
      throw new ServiceUnavailableException("Billing is not configured.");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(`https://api.stripe.com${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secret}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form,
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
