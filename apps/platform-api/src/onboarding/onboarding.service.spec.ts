import axios from 'axios';
import { OnboardingService } from './onboarding.service';

jest.mock('axios');

describe('OnboardingService', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  function makeService() {
    const prisma = {
      organization: {
        create: jest.fn().mockResolvedValue({
          id: 'platform-org-1',
          name: 'Acme Ltd',
          slug: 'acme-ltd',
        }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'platform-org-1',
          name: 'Acme Ltd',
          slug: 'acme-ltd',
          productModules: [],
          provisioning: [],
          customFields: [],
          featureFlags: [],
        }),
      },
      organizationProvisioning: {
        create: jest.fn().mockResolvedValue({ id: 'prov-1' }),
        update: jest.fn().mockResolvedValue({ id: 'prov-1' }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const modulesService = {
      getRegistry: jest.fn().mockReturnValue([
        {
          key: 'touchorbit',
          label: 'TouchOrbit',
          modules: [{ key: 'employees' }],
        },
      ]),
      setModules: jest.fn().mockResolvedValue([]),
    };
    const emailService = { sendInvite: jest.fn(), sendWelcome: jest.fn() };
    const eventPublisher = { publish: jest.fn() };
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'TOUCHORBIT_API_URL') return 'http://touchorbit.test/api';
        if (key === 'INTERNAL_API_TOKEN') return 'internal-token';
        return undefined;
      }),
    };

    return {
      service: new OnboardingService(
        prisma as any,
        modulesService as any,
        emailService as any,
        eventPublisher as any,
        configService as any,
      ),
      prisma,
      modulesService,
      emailService,
    };
  }

  it('creates a platform organization, provisions the product, and sends invite email', async () => {
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        tenantId: 'tenant-1',
        userId: 'user-1',
        inviteToken: 'invite-token',
        setPasswordUrl: 'https://touchorbit.test/set-password?token=invite-token',
      },
    });
    const { service, prisma, modulesService, emailService } = makeService();

    await service.create({
      organizationName: 'Acme Ltd',
      product: 'touchorbit',
      superAdmin: {
        email: 'owner@acme.test',
        firstName: 'Owner',
        lastName: 'User',
      },
      modules: [{ moduleKey: 'employees', enabled: true }],
    });

    expect(prisma.organization.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Acme Ltd' }),
      }),
    );
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://touchorbit.test/api/internal/provision-tenant',
      expect.objectContaining({
        platformOrgId: 'platform-org-1',
        superAdminEmail: 'owner@acme.test',
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-internal-token': 'internal-token' }),
      }),
    );
    expect(modulesService.setModules).toHaveBeenCalledWith('platform-org-1', [
      { product: 'touchorbit', moduleKey: 'employees', enabled: true },
    ]);
    expect(emailService.sendInvite).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@acme.test',
        setPasswordUrl: expect.stringContaining('invite-token'),
      }),
    );
  });
});
