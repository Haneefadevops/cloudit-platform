import { StripeBillingProvider } from "./stripe-billing.provider";

describe("StripeBillingProvider", () => {
  const values: Record<string, string> = {
    STRIPE_SECRET_KEY: "sk_test_example",
    STRIPE_WEBHOOK_SECRET: "whsec_example",
    STRIPE_FOUNDING_PRO_MONTHLY_PRICE_ID: "price_monthly",
    NOTCHME_WEB_URL: "https://app.notchme.test/path",
  };
  const config = { get: jest.fn((key: string) => values[key]) };
  const provider = new StripeBillingProvider(config as never);
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("creates a tax-aware first checkout with scoped metadata and trial", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: "cs_test",
          url: "https://checkout.stripe.com/c/pay/test",
        }),
    });
    global.fetch = fetchMock as never;

    await provider.createCheckout({
      selection: { product: "founding_pro", interval: "monthly" },
      userId: "user-1",
      organizationId: "org-1",
      email: "owner@example.test",
      customerId: null,
      trialEligible: true,
    });

    const [, init] = fetchMock.mock.calls[0];
    const form = init.body as URLSearchParams;
    expect(form.get("automatic_tax[enabled]")).toBe("true");
    expect(form.get("tax_id_collection[enabled]")).toBe("true");
    expect(form.get("subscription_data[trial_period_days]")).toBe("14");
    expect(form.get("payment_method_collection")).toBe("if_required");
    expect(form.get("metadata[notchme_organization_id]")).toBe("org-1");
    expect(form.get("line_items[0][price]")).toBe("price_monthly");
  });

  it("does not grant a repeat trial to an existing billing customer", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: "cs_test",
          url: "https://checkout.stripe.com/c/pay/test",
        }),
    });
    global.fetch = fetchMock as never;
    await provider.createCheckout({
      selection: { product: "founding_pro", interval: "monthly" },
      userId: "user-1",
      organizationId: null,
      email: "owner@example.test",
      customerId: "cus_existing",
      trialEligible: false,
    });
    const form = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(form.get("subscription_data[trial_period_days]")).toBeNull();
    expect(form.get("payment_method_collection")).toBe("always");
    expect(form.get("customer")).toBe("cus_existing");
    expect(form.get("customer_email")).toBeNull();
  });
});
