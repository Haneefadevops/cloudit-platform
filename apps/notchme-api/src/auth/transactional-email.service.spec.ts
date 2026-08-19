import { TransactionalEmailService } from "./transactional-email.service";

describe("TransactionalEmailService", () => {
  const values: Record<string, string> = {
    RESEND_API_KEY: "re_test",
    NOTCHME_EMAIL_FROM: "NotchMe <no-reply@notchme.test>",
    NOTCHME_WEB_URL: "https://app.notchme.test",
    NOTCHME_REQUIRE_EMAIL_VERIFICATION: "true",
  };
  const config = { get: jest.fn((key: string) => values[key]) };
  const service = new TransactionalEmailService(config as never);
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("keeps credentials server-side and sends a bounded verification link", async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    global.fetch = fetchMock as never;
    await service.sendVerification(
      "user@example.test",
      "User",
      "private-token",
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer re_test");
    const body = JSON.parse(String(init.body));
    expect(body.text).toContain(
      "https://app.notchme.test/verify-email?token=private-token",
    );
    expect(body).not.toHaveProperty("apiKey");
  });
});
