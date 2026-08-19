import { createHmac } from "node:crypto";
import { LemonSqueezyWebhookService } from "./lemon-squeezy-webhook.service";

describe("LemonSqueezyWebhookService", () => {
  const values: Record<string, string> = {
    LEMON_SQUEEZY_WEBHOOK_SECRET: "webhook_secret",
    LEMON_SQUEEZY_STORE_ID: "100",
    LEMON_SQUEEZY_FOUNDING_PRO_MONTHLY_VARIANT_ID: "200",
    LEMON_SQUEEZY_TEST_MODE: "true",
  };
  const config = { get: jest.fn((key: string) => values[key]) };
  const query = jest.fn();
  const client = { query, release: jest.fn() };
  const db = { connect: jest.fn(() => Promise.resolve(client)) };
  const service = new LemonSqueezyWebhookService(db as never, config as never);

  const payload = (overrides: Record<string, unknown> = {}) => ({
    meta: {
      event_name: "subscription_updated",
      custom_data: {
        notchme_user_id: "user-1",
        notchme_organization_id: "org-1",
        notchme_product: "founding_pro",
        notchme_interval: "monthly",
      },
    },
    data: {
      type: "subscriptions",
      id: "300",
      attributes: {
        store_id: 100,
        customer_id: 400,
        variant_id: 200,
        status: "active",
        cancelled: false,
        renews_at: "2026-10-01T00:00:00.000Z",
        trial_ends_at: null,
        updated_at: "2026-09-01T00:00:00.000Z",
        test_mode: true,
        ...overrides,
      },
    },
  });

  const signed = (value: object) => {
    const raw = Buffer.from(JSON.stringify(value));
    const signature = createHmac("sha256", "webhook_secret")
      .update(raw)
      .digest("hex");
    return { raw, signature };
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects an invalid signature and a mismatched test mode", () => {
    const first = signed(payload());
    expect(() =>
      service.verify(first.raw, "invalid", "subscription_updated"),
    ).toThrow("Invalid billing webhook signature");

    const second = signed(payload({ test_mode: false }));
    expect(() =>
      service.verify(second.raw, second.signature, "subscription_updated"),
    ).toThrow("Invalid billing webhook payload");
  });

  it("atomically grants the scoped plan from a valid subscription", async () => {
    const value = signed(payload());
    const event = service.verify(
      value.raw,
      value.signature,
      "subscription_updated",
    );
    query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({});

    await expect(service.process(event)).resolves.toEqual({ duplicate: false });
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("provider = EXCLUDED.provider"),
      ),
    ).toBe(true);
    expect(
      query.mock.calls.some(
        ([sql, params]) =>
          String(sql).includes("UPDATE organizations") &&
          params[1] === "pro_individual" &&
          params[2] === "active",
      ),
    ).toBe(true);
    expect(query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
  });

  it("retains access for cancellation grace and revokes it on expiry", async () => {
    const cancelledPayload = payload({
      status: "cancelled",
      cancelled: true,
      ends_at: "2026-10-01T00:00:00.000Z",
    });
    const cancelled = signed(cancelledPayload);
    const cancelEvent = service.verify(
      cancelled.raw,
      cancelled.signature,
      "subscription_updated",
    );
    expect(cancelEvent.status).toBe("active");
    expect(cancelEvent.cancelAtPeriodEnd).toBe(true);

    const expiredPayload = payload({
      status: "expired",
      cancelled: true,
      ends_at: "2026-10-01T00:00:00.000Z",
    });
    const expired = signed(expiredPayload);
    const expireEvent = service.verify(
      expired.raw,
      expired.signature,
      "subscription_updated",
    );
    query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({});
    await service.process(expireEvent);
    expect(
      query.mock.calls.some(
        ([sql, params]) =>
          String(sql).includes("UPDATE organizations") &&
          params[1] === "free" &&
          params[2] === "cancelled",
      ),
    ).toBe(true);
  });

  it("deduplicates an identical signed delivery", async () => {
    const value = signed(payload());
    const event = service.verify(
      value.raw,
      value.signature,
      "subscription_updated",
    );
    query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({});
    await expect(service.process(event)).resolves.toEqual({ duplicate: true });
    expect(query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
  });

  it("does not grant access for an unexpected product variant", async () => {
    const value = signed(payload({ variant_id: 201 }));
    const event = service.verify(
      value.raw,
      value.signature,
      "subscription_updated",
    );
    query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({});
    await expect(service.process(event)).resolves.toEqual({ duplicate: false });
    expect(
      query.mock.calls.some(([sql]) =>
        String(sql).includes("INSERT INTO billing_subscriptions"),
      ),
    ).toBe(false);
    expect(query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
  });
});
