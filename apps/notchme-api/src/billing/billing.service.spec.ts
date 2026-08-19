import { BillingService } from "./billing.service";

describe("BillingService", () => {
  const db = { query: jest.fn() };
  const provider = {
    enabled: jest.fn(() => true),
    configured: jest.fn(() => true),
    createCheckout: jest.fn(),
    createPortal: jest.fn(),
  };
  const service = new BillingService(db as never, provider as never);
  const owner = {
    id: "user-1",
    email: "owner@example.test",
    organizationId: "org-1",
    role: "admin",
    isBillingContact: true,
  } as never;

  beforeEach(() => jest.clearAllMocks());

  it("cannot change a plan directly and returns only hosted checkout", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    provider.createCheckout.mockResolvedValue({
      id: "cs_test",
      url: "https://checkout.stripe.com/c/pay/test",
    });
    await expect(
      service.checkout(owner, {
        product: "founding_pro",
        interval: "monthly",
      }),
    ).resolves.toEqual({ url: "https://checkout.stripe.com/c/pay/test" });
    expect(provider.createCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        organizationId: "org-1",
        trialEligible: true,
      }),
    );
    expect(
      db.query.mock.calls.some(([sql]) =>
        String(sql).toLowerCase().includes("update users set plan"),
      ),
    ).toBe(false);
  });

  it("rejects organization members without billing authority", async () => {
    await expect(
      service.checkout(
        { ...owner, role: "staff", isBillingContact: false } as never,
        { product: "founding_pro", interval: "monthly" },
      ),
    ).rejects.toThrow("Only an organization admin");
    expect(provider.createCheckout).not.toHaveBeenCalled();
  });

  it("sends active subscribers to the portal rather than a second checkout", async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        {
          provider_customer_id: "cus_1",
          provider_subscription_id: "sub_1",
          status: "active",
        },
      ],
    });
    await expect(
      service.checkout(owner, {
        product: "founding_pro",
        interval: "monthly",
      }),
    ).rejects.toThrow("existing subscription");
  });

  it("accepts only the expected Stripe hosted redirect", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    provider.createCheckout.mockResolvedValue({
      id: "cs_test",
      url: "https://attacker.example/collect",
    });
    await expect(
      service.checkout(owner, {
        product: "founding_pro",
        interval: "monthly",
      }),
    ).rejects.toThrow("invalid redirect");
  });
});
