import bcrypt from "bcryptjs";
import { AccountService } from "./account.service";

describe("AccountService", () => {
  const db = { query: jest.fn(), connect: jest.fn() };
  const sessions = { revokeAllUserSessions: jest.fn() };
  const service = new AccountService(db as never, sessions as never);
  const user = {
    id: "user-1",
    organizationId: null,
    role: "freelancer",
  } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    sessions.revokeAllUserSessions.mockResolvedValue(undefined);
    jest.spyOn(bcrypt, "compare").mockResolvedValue(true as never);
  });

  afterEach(() => jest.restoreAllMocks());

  it("blocks deletion while a subscription remains active", async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    db.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [
          {
            id: "user-1",
            password_hash: "hash",
            role: "freelancer",
            organization_id: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ status: "active" }] })
      .mockResolvedValueOnce({});

    await expect(
      service.remove(user, {
        password: "password",
        confirmation: "DELETE MY ACCOUNT",
      }),
    ).rejects.toThrow("End the active subscription");
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(sessions.revokeAllUserSessions).not.toHaveBeenCalled();
  });

  it("deletes an individual account transactionally and revokes all sessions", async () => {
    const client = { query: jest.fn(), release: jest.fn() };
    db.connect.mockResolvedValue(client);
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        rows: [
          {
            id: "user-1",
            password_hash: "hash",
            role: "freelancer",
            organization_id: null,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [{ status: "canceled" }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await service.remove(user, {
      password: "password",
      confirmation: "DELETE MY ACCOUNT",
    });
    expect(client.query).toHaveBeenCalledWith(
      "DELETE FROM users WHERE id = $1",
      ["user-1"],
    );
    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(sessions.revokeAllUserSessions).toHaveBeenCalledWith("user-1");
  });

  it("exports authorized data without querying credential or token columns", async () => {
    for (let index = 0; index < 11; index += 1) {
      db.query.mockResolvedValueOnce({ rows: [] });
    }
    const result = await service.export(user);
    expect(result.exclusions).toContain("password hashes and reset tokens");
    const sql = db.query.mock.calls
      .map(([statement]) => String(statement).toLowerCase())
      .join(" ");
    expect(sql).not.toMatch(
      /password_hash|access_token|refresh_token|management_token/,
    );
  });
});
