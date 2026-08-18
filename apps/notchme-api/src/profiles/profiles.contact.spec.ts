import { ProfilesController } from "./profiles.controller";
import { ProfilesService } from "./profiles.service";
import { publicContactCaptureSchema } from "./profiles.schemas";

const validInput = {
  fullName: "Ada Lovelace",
  email: "ADA@EXAMPLE.COM",
  phone: "+44 20 1234 5678",
  company: "Analytical Engines",
  message: "<script>ignore()</script>Hello",
  acknowledgement: true as const,
};

describe("public profile contact capture", () => {
  const client = { query: jest.fn(), release: jest.fn() };
  const database = { connect: jest.fn(() => client) };
  const service = new ProfilesService(database as never);

  beforeEach(() => jest.clearAllMocks());

  function publishedTarget(organizationId: string | null = "org-1") {
    client.query
      .mockResolvedValueOnce({}) // BEGIN
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            profile_id: "profile-1",
            user_id: "owner-1",
            organization_id: organizationId,
          },
        ],
      });
  }

  it("validates required name, contact method, formats, limits, acknowledgement, and rejects supplied tenant IDs", () => {
    expect(
      publicContactCaptureSchema.safeParse({ ...validInput, fullName: "" })
        .success,
    ).toBe(false);
    expect(
      publicContactCaptureSchema.safeParse({
        ...validInput,
        email: "",
        phone: "",
      }).success,
    ).toBe(false);
    expect(
      publicContactCaptureSchema.safeParse({ ...validInput, email: "bad" })
        .success,
    ).toBe(false);
    expect(
      publicContactCaptureSchema.safeParse({ ...validInput, phone: "123" })
        .success,
    ).toBe(false);
    expect(
      publicContactCaptureSchema.safeParse({
        ...validInput,
        message: "x".repeat(1001),
      }).success,
    ).toBe(false);
    expect(
      publicContactCaptureSchema.safeParse({
        ...validInput,
        organizationId: "attacker",
      }).success,
    ).toBe(false);
    expect(publicContactCaptureSchema.parse(validInput)).toMatchObject({
      email: "ada@example.com",
      phone: "+442012345678",
    });
  });

  it("creates a new person and factual introduction activity within the organization derived from the published slug", async () => {
    publishedTarget();
    client.query
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "person-1" }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await expect(
      service.capturePublicContact(
        "published-owner",
        publicContactCaptureSchema.parse(validInput),
      ),
    ).resolves.toBe(true);
    expect(client.query.mock.calls[1][1]).toEqual(["published-owner"]);
    expect(client.query.mock.calls[3][1]).toContain("org-1");
    expect(client.query.mock.calls[4][0]).toContain("Public page introduction");
    expect(client.query.mock.calls[4][1][2]).toContain("Hello");
    expect(client.query.mock.calls[4][1][2]).not.toContain("script");
  });

  it("matches only normalized email or phone in the resolved scope and never overwrites trusted populated fields", async () => {
    publishedTarget("org-1");
    client.query
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ id: "existing-person" }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    await service.capturePublicContact(
      "published-owner",
      publicContactCaptureSchema.parse(validInput),
    );

    expect(client.query.mock.calls[2][0]).toContain("email = $2 OR phone = $3");
    expect(client.query.mock.calls[2][1]).toEqual([
      "org-1",
      "ada@example.com",
      "+442012345678",
    ]);
    expect(client.query.mock.calls[3][0]).toContain("COALESCE(email, $1)");
    expect(client.query.mock.calls[3][0]).toContain("COALESCE(company, $3)");
  });

  it("safely rejects unpublished or missing profiles without creating data", async () => {
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({});
    await expect(
      service.capturePublicContact(
        "missing",
        publicContactCaptureSchema.parse(validInput),
      ),
    ).resolves.toBe(false);
    expect(client.query).toHaveBeenCalledTimes(3);
  });

  it("rolls back all writes if introduction activity creation fails", async () => {
    publishedTarget();
    client.query
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: "person-1" }] })
      .mockRejectedValueOnce(new Error("activity failure"))
      .mockResolvedValueOnce({});
    await expect(
      service.capturePublicContact(
        "published-owner",
        publicContactCaptureSchema.parse(validInput),
      ),
    ).rejects.toThrow("activity failure");
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
  });
});

describe("public contact controller", () => {
  it("returns the same generic success for a honeypot submission without storage", async () => {
    const profilesService = { capturePublicContact: jest.fn() };
    const controller = new ProfilesController(profilesService as never);
    const status = jest.fn();
    const result = await controller.capturePublicContact(
      "published-owner",
      { ...validInput, website: "bot.example" },
      { status } as never,
    );
    expect(result).toEqual({ ok: true, data: { accepted: true } });
    expect(profilesService.capturePublicContact).not.toHaveBeenCalled();
  });
});
