import { InternalProvisioningService } from "./internal-provisioning.service";

describe("InternalProvisioningService", () => {
  it("creates tenant and admin invite for platform provisioning", async () => {
    const queries: string[] = [];
    const client = {
      query: jest.fn((sql: string) => {
        queries.push(sql);
        if (sql.includes("INSERT INTO organizations")) {
          return Promise.resolve({
            rows: [{ id: "tenant-1", slug: "acme-ltd", name: "Acme Ltd" }],
          });
        }
        if (sql.includes("INSERT INTO organization_invites")) {
          return Promise.resolve({ rows: [{ token: "invite-token" }] });
        }
        if (sql.includes("INSERT INTO users")) {
          return Promise.resolve({ rows: [{ id: "user-1" }] });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: jest.fn(),
    };
    const databaseService = { connect: jest.fn().mockResolvedValue(client) };
    const configService = {
      get: jest.fn((key: string) =>
        key === "NOTCHME_WEB_URL" ? "https://notchme.test" : undefined,
      ),
    };
    const service = new InternalProvisioningService(
      databaseService as any,
      configService as any,
    );

    const result = await service.provision({
      platformOrgId: "platform-org-1",
      name: "Acme Ltd",
      slug: "acme-ltd",
      superAdminEmail: "owner@acme.test",
      superAdminFirstName: "Owner",
      superAdminLastName: "User",
    });

    expect(result).toEqual(
      expect.objectContaining({
        tenantId: "tenant-1",
        userId: "user-1",
        inviteToken: "invite-token",
        setPasswordUrl: "https://notchme.test/accept-invite?token=invite-token",
      }),
    );
    expect(queries.join("\n")).toContain("role = 'admin'");
    expect(queries.join("\n")).toContain("source = 'platform'");
  });

  it("uses the NotchMe local web port when no web URL is configured", () => {
    const service = new InternalProvisioningService(
      {} as any,
      { get: jest.fn().mockReturnValue(undefined) } as any,
    );

    const acceptInviteUrl = (
      service as unknown as {
        acceptInviteUrl(token: string): string;
      }
    ).acceptInviteUrl.bind(service);

    expect(acceptInviteUrl("invite-token")).toBe(
      "http://localhost:3005/accept-invite?token=invite-token",
    );
  });
});
