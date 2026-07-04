import { InternalProvisioningService } from './internal-provisioning.service';

describe('InternalProvisioningService', () => {
  it('creates tenant, owner user, owner security role, and invite token', async () => {
    const queries: string[] = [];
    const client = {
      query: jest.fn((sql: string) => {
        queries.push(sql);
        if (sql.includes('INSERT INTO organizations')) {
          return Promise.resolve({
            rows: [{ id: 'tenant-1', name: 'Acme Ltd', slug: 'acme-ltd' }],
          });
        }
        if (sql.includes('INSERT INTO users')) {
          return Promise.resolve({
            rows: [
              {
                id: 'user-1',
                email: 'owner@acme.test',
                first_name: 'Owner',
                last_name: 'User',
                role: 'owner',
                organization_id: 'tenant-1',
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      }),
      release: jest.fn(),
    };
    const databaseService = { connect: jest.fn().mockResolvedValue(client) };
    const configService = {
      get: jest.fn((key: string) =>
        key === 'TOUCHORBIT_WEB_URL' ? 'https://touchorbit.test' : undefined,
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
        setPasswordUrl: expect.stringContaining('/set-password?token='),
      }),
    );
    expect(queries.join('\n')).toContain('INSERT INTO user_security_roles');
    expect(queries.join('\n')).toContain('INSERT INTO user_invite_tokens');
  });
});
