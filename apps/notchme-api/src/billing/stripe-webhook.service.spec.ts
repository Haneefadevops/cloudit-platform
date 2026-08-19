import { createHmac } from "node:crypto";
import { StripeWebhookService } from "./stripe-webhook.service";

describe("StripeWebhookService", () => {
  const db = { connect: jest.fn() };
  const config = {
    get: jest.fn((key: string) => {
      if (key === "STRIPE_WEBHOOK_SECRET") return "whsec_test";
      if (key === "STRIPE_TEAMS_MONTHLY_PRICE_ID") return "price_teams";
      if (key === "STRIPE_FOUNDING_PRO_MONTHLY_PRICE_ID") return "price_pro";
      return undefined;
    }),
  };
  const service = new StripeWebhookService(db as never, config as never);

  beforeEach(() => jest.clearAllMocks());

  function signed(payload: object, timestamp = Math.floor(Date.now() / 1000)) {
    const body = Buffer.from(JSON.stringify(payload));
    const digest = createHmac("sha256", "whsec_test")
      .update(`${timestamp}.${body.toString("utf8")}`)
      .digest("hex");
    return { body, signature: `t=${timestamp},v1=${digest}` };
  }

  it("verifies the unmodified raw body and rejects stale signatures", () => {
    const payload = {
      id: "evt_1",
      type: "customer.subscription.updated",
      created: 1,
      data: { object: {} },
    };
    const valid = signed(payload);
    expect(service.verify(valid.body, valid.signature)).toEqual(payload);
    const stale = signed(payload, Math.floor(Date.now() / 1000) - 301);
    expect(() => service.verify(stale.body, stale.signature)).toThrow(
      "Invalid billing webhook signature",
    );
  });

  it("atomically grants an organization plan from a signed subscription state", async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    db.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({});
    await service.process({
      id: "evt_active",
      type: "customer.subscription.updated",
      created: 100,
      data: {
        object: {
          id: "sub_1",
          customer: "cus_1",
          status: "active",
          current_period_end: 2000000000,
          cancel_at_period_end: false,
          metadata: {
            notchme_user_id: "user-1",
            notchme_organization_id: "org-1",
            notchme_product: "teams",
            notchme_interval: "monthly",
          },
          items: { data: [{ price: { id: "price_teams" } }] },
        },
      },
    });
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE organizations SET plan"),
      [
        "org-1",
        "pro_business_starter",
        "active",
        null,
        new Date(2000000000 * 1000),
      ],
    );
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });

  it("does not grant a plan for an unconfigured price or invalid scope", async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    db.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({});
    await service.process({
      id: "evt_wrong_price",
      type: "customer.subscription.updated",
      created: 101,
      data: {
        object: {
          id: "sub_1",
          customer: "cus_1",
          status: "active",
          metadata: {
            notchme_user_id: "user-1",
            notchme_organization_id: "org-1",
            notchme_product: "teams",
            notchme_interval: "monthly",
          },
          items: { data: [{ price: { id: "price_not_configured" } }] },
        },
      },
    });
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes("UPDATE organizations SET plan"),
      ),
    ).toBe(false);
  });

  it("deduplicates provider event IDs before applying entitlements", async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    db.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({});
    await expect(
      service.process({
        id: "evt_duplicate",
        type: "customer.subscription.updated",
        created: 100,
        data: { object: {} },
      }),
    ).resolves.toEqual({ duplicate: true });
    expect(
      client.query.mock.calls.some(([sql]) =>
        String(sql).includes("UPDATE organizations"),
      ),
    ).toBe(false);
  });

  it("revokes an individual entitlement after subscription deletion", async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    db.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({});
    await service.process({
      id: "evt_deleted",
      type: "customer.subscription.deleted",
      created: 102,
      data: {
        object: {
          id: "sub_pro",
          customer: "cus_pro",
          status: "canceled",
          metadata: {
            notchme_user_id: "user-2",
            notchme_product: "founding_pro",
            notchme_interval: "monthly",
          },
          items: { data: [{ price: { id: "price_pro" } }] },
        },
      },
    });
    expect(client.query).toHaveBeenCalledWith(
      "UPDATE users SET plan = $2, updated_at = now() WHERE id = $1",
      ["user-2", "free"],
    );
  });

  it("marks the billing scope past due after an invoice failure", async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    db.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({
        rows: [
          {
            organization_id: "org-1",
            owner_user_id: "user-1",
            product_key: "teams",
            billing_interval: "monthly",
          },
        ],
      })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({});
    await service.process({
      id: "evt_failed",
      type: "invoice.payment_failed",
      created: 103,
      data: { object: { subscription: "sub_teams" } },
    });
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE organizations SET plan"),
      ["org-1", "pro_business_starter", "past_due", null, null],
    );
  });
});
