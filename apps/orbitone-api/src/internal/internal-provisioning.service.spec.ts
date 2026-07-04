import { InternalProvisioningService } from './internal-provisioning.service';

describe('InternalProvisioningService', () => {
  it('creates tenant and admin invite for platform provisioning', async () => {
    const queries: string[] = [];
    const client = {
      query: jest.fn((sql: string) => {
        queries.push(sql);
        if (sql.includes('INSERT INTO organizations')) {
          return Promise.resolve({
            rows: [{ id: 'tenant-1', slug: 'acme-ltd', name: 'Acme Ltd' }],
          });
        }
        if (sql.includes('INSERT INTO organization_invites')) {
          return Promise.resolve({ rows: [{ token: 'invite-token' }] });
        }
        if (sql.includes('INSERT INTO users')) {
          return Promise.resolve({ rows: [{ id: 'user-1' }] });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: jest.fn(),
    };
    const databaseService = { connect: jest.fn().mockResolvedValue(client) };
    const configService = {
      get: jest.fn((key: string) =>
        key === 'ORBITONE_WEB_URL' ? 'https://orbitone.test' : undefined,
      ),
    };
    const service = new InternalProvisioningService(
      databaseService as any,
      configService as any,
    );

    const result = await service.provision({
      platformOrgId: 'platform-org-1',
      name: 'Acme Ltd',
      slug: 'acme-ltd',
      superAdminEmail: 'owner@acme.test',
      superAdminFirstName: 'Owner',
      superAdminLastName: 'User',
    });

    expect(result).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-1',
        userId: 'user-1',
        inviteToken: 'invite-token',
        setPasswordUrl: 'https://orbitone.test/accept-invite?token=invite-token',
      }),
    );
    expect(queries.join('\n')).toContain("role = 'admin'");
    expect(queries.join('\n')).toContain("source = 'platform'");
  });
});
