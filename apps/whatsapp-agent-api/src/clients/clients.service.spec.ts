import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ClientsService } from './clients.service';

function setup(overrides: {
  client?: Record<string, unknown> | null;
  existingUser?: Record<string, unknown> | null;
  portalUser?: Record<string, unknown> | null;
} = {}) {
  const prisma = {
    client: {
      findUnique: jest.fn().mockResolvedValue(
        overrides.client === undefined
          ? { id: 'client-1', name: 'Test Clinic' }
          : overrides.client,
      ),
    },
    user: {
      findUnique: jest
        .fn()
        .mockResolvedValue(overrides.existingUser ?? null),
      findFirst: jest.fn().mockResolvedValue(
        overrides.portalUser === undefined
          ? { id: 'user-1', clientId: 'client-1' }
          : overrides.portalUser,
      ),
      create: jest.fn().mockImplementation(({ data, select }) =>
        Promise.resolve({
          id: 'user-new',
          name: data.name,
          email: data.email,
          role: data.role,
          clientId: data.clientId,
          createdAt: new Date(),
        }),
      ),
      update: jest.fn().mockImplementation(({ where, data }) =>
        Promise.resolve({
          id: where.id,
          name: 'Clinic Admin',
          email: 'owner@clinic.lk',
          role: 'client_admin',
          clientId: 'client-1',
          createdAt: new Date(),
        }),
      ),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const service = new ClientsService(prisma as never);
  return { prisma, service };
}

describe('ClientsService portal users', () => {
  it('creates a client_admin user linked to the client with a hashed password', async () => {
    const { prisma, service } = setup();
    const user = await service.createPortalUser('client-1', {
      email: 'owner@clinic.lk',
      password: 'temp-pass-123',
      name: 'Clinic Owner',
    });

    const data = (prisma.user.create.mock.calls[0][0] as any).data;
    expect(data.role).toBe('client_admin');
    expect(data.clientId).toBe('client-1');
    expect(data.password).not.toBe('temp-pass-123');
    expect(data.password).toMatch(/^\$2[aby]\$/); // bcrypt hash
    expect(user.email).toBe('owner@clinic.lk');
    expect((user as any).password).toBeUndefined(); // never returned
  });

  it('defaults the name from the client name', async () => {
    const { prisma, service } = setup();
    await service.createPortalUser('client-1', {
      email: 'owner@clinic.lk',
      password: 'temp-pass-123',
    });
    const data = (prisma.user.create.mock.calls[0][0] as any).data;
    expect(data.name).toBe('Test Clinic Admin');
  });

  it('rejects duplicate emails', async () => {
    const { service } = setup({ existingUser: { id: 'other-user' } });
    await expect(
      service.createPortalUser('client-1', {
        email: 'taken@clinic.lk',
        password: 'x',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects when the client does not exist', async () => {
    const { service } = setup({ client: null });
    await expect(
      service.createPortalUser('missing', {
        email: 'a@b.lk',
        password: 'x',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('requires email and password', async () => {
    const { service } = setup();
    await expect(
      service.createPortalUser('client-1', { email: '', password: '' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('resets a portal user password only within the same client', async () => {
    const { prisma, service } = setup();
    await service.resetPortalUserPassword('client-1', 'user-1', 'new-pass-1');
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'user-1', clientId: 'client-1' },
    });
    const data = (prisma.user.update.mock.calls[0][0] as any).data;
    expect(data.password).toMatch(/^\$2[aby]\$/);
  });

  it('refuses to reset a user belonging to another client', async () => {
    const { service } = setup({ portalUser: null });
    await expect(
      service.resetPortalUserPassword('client-1', 'user-1', 'new-pass-1'),
    ).rejects.toThrow(NotFoundException);
  });
});
