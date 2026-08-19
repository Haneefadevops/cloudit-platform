import bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";

describe("AuthService verification and recovery", () => {
  const db = { query: jest.fn(), connect: jest.fn() };
  const sessions = {
    revokeAllUserSessions: jest.fn(),
  };
  const email = {
    enabled: jest.fn(() => true),
    verificationRequired: jest.fn(() => true),
    sendPasswordReset: jest.fn(),
    sendVerification: jest.fn(),
  };
  const service = new AuthService(
    db as never,
    sessions as never,
    {} as never,
    email as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    email.enabled.mockReturnValue(true);
  });

  it("uses a generic no-op for an unknown reset email", async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await service.requestPasswordReset("missing@example.test");
    expect(email.sendPasswordReset).not.toHaveBeenCalled();
  });

  it("stores only a SHA-256 token hash and sends the one-time token", async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: "user-1", email: "user@example.test", full_name: "User" }],
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: "token-row" }] });
    email.sendPasswordReset.mockResolvedValue(undefined);

    await service.requestPasswordReset("user@example.test");
    const insertValues = db.query.mock.calls[2][1] as unknown[];
    const deliveredToken = email.sendPasswordReset.mock.calls[0][2] as string;
    expect(insertValues[2]).toMatch(/^[a-f0-9]{64}$/);
    expect(insertValues[2]).not.toBe(deliveredToken);
    expect(deliveredToken.length).toBeGreaterThanOrEqual(32);
  });

  it("changes the password transactionally and revokes every session", async () => {
    jest.spyOn(bcrypt, "hash").mockResolvedValue("new-hash" as never);
    const client = { query: jest.fn(), release: jest.fn() };
    db.connect.mockResolvedValue(client);
    sessions.revokeAllUserSessions.mockResolvedValue(undefined);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: "token-1", user_id: "user-1" }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await service.resetPassword("a".repeat(43), "new-password");
    expect(client.query).toHaveBeenCalledWith(
      "UPDATE users SET password_hash = $2, updated_at = now() WHERE id = $1",
      ["user-1", "new-hash"],
    );
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(sessions.revokeAllUserSessions).toHaveBeenCalledWith("user-1");
    jest.restoreAllMocks();
  });
});
