import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("billing foundation migration", () => {
  const sql = readFileSync(
    resolve(__dirname, "../../migrations/0022_billing_foundation.sql"),
    "utf8",
  ).toLowerCase();

  it("stores provider lifecycle identifiers without payment credentials", () => {
    expect(sql).toContain("create table if not exists billing_subscriptions");
    expect(sql).toContain("provider_subscription_id text unique");
    expect(sql).toContain("cancel_at_period_end boolean");
    expect(sql).toContain("create table if not exists billing_webhook_events");
    expect(sql).not.toMatch(/card_number|card_cvc|payment_method_secret/);
  });

  it("enforces one billing scope and webhook idempotency", () => {
    expect(sql).toContain("billing_subscriptions_org_unique_idx");
    expect(sql).toContain("billing_subscriptions_individual_unique_idx");
    expect(sql).toContain("provider_event_id text primary key");
  });
});
