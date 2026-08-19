import { SessionAuthGuard } from "./session-auth.guard";

describe("SessionAuthGuard email verification", () => {
  const reflector = { getAllAndOverride: jest.fn(() => false) };
  const sessions = { getAuthUserWithOrg: jest.fn() };
  const config = { get: jest.fn(() => "true") };
  const guard = new SessionAuthGuard(
    reflector as never,
    sessions as never,
    config as never,
  );

  beforeEach(() => jest.clearAllMocks());

  function context(url: string) {
    const request = { url };
    return {
      request,
      context: {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({ getRequest: () => request }),
      } as never,
    };
  }

  it("blocks non-authenticated-workspace APIs until required verification", async () => {
    sessions.getAuthUserWithOrg.mockResolvedValue({
      id: "user-1",
      emailVerifiedAt: null,
    });
    const { context: requestContext } = context("/api/v2/customers");
    await expect(guard.canActivate(requestContext)).rejects.toThrow(
      "Verify your email",
    );
  });

  it("allows the verification/auth routes for an unverified session", async () => {
    sessions.getAuthUserWithOrg.mockResolvedValue({
      id: "user-1",
      emailVerifiedAt: null,
    });
    const { context: requestContext } = context(
      "/api/v2/auth/request-verification",
    );
    await expect(guard.canActivate(requestContext)).resolves.toBe(true);
  });
});
