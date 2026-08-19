import { LemonSqueezyBillingProvider } from "./lemon-squeezy-billing.provider";

describe("LemonSqueezyBillingProvider", () => {
  const values: Record<string, string> = {
    LEMON_SQUEEZY_API_KEY: "test_api_key",
    LEMON_SQUEEZY_WEBHOOK_SECRET: "test_webhook_secret",
    LEMON_SQUEEZY_STORE_ID: "100",
    LEMON_SQUEEZY_FOUNDING_PRO_MONTHLY_VARIANT_ID: "200",
    LEMON_SQUEEZY_TEST_MODE: "true",
    NOTCHME_WEB_URL: "https://app.notchme.test/path",
  };
  const config = { get: jest.fn((key: string) => values[key]) };
  const provider = new LemonSqueezyBillingProvider(config as never);
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("creates a scoped hosted checkout without granting access", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            id: "checkout-1",
            attributes: {
              url: "https://notchme.lemonsqueezy.com/checkout/custom/1",
            },
          },
        }),
    });
    global.fetch = fetchMock as never;

    await expect(
      provider.createCheckout({
        selection: { product: "founding_pro", interval: "monthly" },
        userId: "user-1",
        organizationId: "org-1",
        email: "owner@example.test",
        trialEligible: true,
      }),
    ).resolves.toEqual({
      id: "checkout-1",
      url: "https://notchme.lemonsqueezy.com/checkout/custom/1",
    });

    const [url, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init.body));
    expect(url).toBe("https://api.lemonsqueezy.com/v1/checkouts");
    expect(init.headers.Authorization).toBe("Bearer test_api_key");
    expect(body.data.relationships.store.data.id).toBe("100");
    expect(body.data.relationships.variant.data.id).toBe("200");
    expect(body.data.attributes.checkout_options.skip_trial).toBe(false);
    expect(body.data.attributes.checkout_data.custom).toEqual({
      notchme_user_id: "user-1",
      notchme_product: "founding_pro",
      notchme_interval: "monthly",
      notchme_organization_id: "org-1",
    });
  });

  it("prevents a repeat trial for a previously known billing scope", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            id: "checkout-2",
            attributes: {
              url: "https://notchme.lemonsqueezy.com/checkout/custom/2",
            },
          },
        }),
    });
    global.fetch = fetchMock as never;
    await provider.createCheckout({
      selection: { product: "founding_pro", interval: "monthly" },
      userId: "user-1",
      organizationId: null,
      email: "owner@example.test",
      trialEligible: false,
    });
    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
    expect(body.data.attributes.checkout_options.skip_trial).toBe(true);
  });

  it("retrieves a fresh signed customer portal URL", async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: {
            attributes: {
              urls: {
                customer_portal:
                  "https://notchme.lemonsqueezy.com/billing?signature=test",
              },
            },
          },
        }),
    });
    global.fetch = fetchMock as never;
    await expect(provider.createPortal("300")).resolves.toEqual({
      url: "https://notchme.lemonsqueezy.com/billing?signature=test",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.lemonsqueezy.com/v1/subscriptions/300",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
