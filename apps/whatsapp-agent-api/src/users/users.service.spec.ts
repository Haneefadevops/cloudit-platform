import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AdminGuard } from '../common/guards/admin.guard';

const STAFF_ADMIN = {
  id: 'admin-1',
  name: 'Root Admin',
  email: 'admin@thereplyte.com',
  password: 'hashed',
  role: 'admin',
  status: 'active',
  clientId: null,
  createdAt: new Date('2026-01-01'),
};

function setup(overrides: {
  target?: Record<string, unknown> | null;
  otherActiveAdmins?: number;
  existingByEmail?: Record<string, unknown> | null;
} = {}) {
  const prisma = {
    user: {
      findMany: jest.fn().mockResolvedValue([STAFF_ADMIN]),
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id?: string; email?: string } }) => {
        if (where.email) {
          return Promise.resolve(overrides.existingByEmail ?? null);
        }
        return Promise.resolve(
          overrides.target === undefined ? STAFF_ADMIN : overrides.target,
        );
      }),
      create: jest.fn().mockImplementation(({ data }: { data: unknown }) => data),
      update: jest.fn().mockImplementation(({ data }: { data: unknown }) => data),
      count: jest.fn().mockResolvedValue(overrides.otherActiveAdmins ?? 0),
    },
  };
  const service = new UsersService(prisma as never);
  const controller = new UsersController(service);
  return { prisma, service, controller };
}

describe('UsersService.listStaff', () => {
  it('scopes the query to staff users (clientId IS NULL) and never selects the password hash', async () => {
    const { prisma, service } = setup();

    await service.listStaff();

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId: null } }),
    );
    const select = prisma.user.findMany.mock.calls[0][0].select as Record<
      string,
      unknown
    >;
    expect(select.password).toBeUndefined();
  });
});

describe('UsersService.createStaff', () => {
  const input = {
    name: 'New Admin',
    email: 'new@thereplyte.com',
    password: 'temp-password-1',
    role: 'admin',
  };

  it('creates a staff user with a bcrypt hash and clientId null', async () => {
    const { prisma, service } = setup();

    await service.createStaff(input);

    const data = prisma.user.create.mock.calls[0][0].data as {
      password: string;
      clientId: string | null;
      role: string;
      email: string;
    };
    expect(data.clientId).toBeNull();
    expect(data.role).toBe('admin');
    expect(data.email).toBe('new@thereplyte.com');
    expect(data.password).not.toBe(input.password);
    await expect(bcrypt.compare(input.password, data.password)).resolves.toBe(
      true,
    );
  });

  it('rejects a duplicate email with 409', async () => {
    const { service } = setup({ existingByEmail: STAFF_ADMIN });

    await expect(service.createStaff(input)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects a non-admin/supervisor role with 400', async () => {
    const { service } = setup();

    await expect(
      service.createStaff({ ...input, role: 'agent' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createStaff({ ...input, role: 'client_admin' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('UsersService.updateStaff', () => {
  it('blocks an admin from disabling their own account', async () => {
    const { service } = setup({ otherActiveAdmins: 3 });

    await expect(
      service.updateStaff('admin-1', 'admin-1', { status: 'disabled' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks disabling the last remaining active admin', async () => {
    const { prisma, service } = setup({ otherActiveAdmins: 0 });

    await expect(
      service.updateStaff('someone-else', 'admin-1', { status: 'disabled' }),
    ).rejects.toThrow(/last active admin/i);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('blocks demoting the last remaining active admin', async () => {
    const { service } = setup({ otherActiveAdmins: 0 });

    await expect(
      service.updateStaff('someone-else', 'admin-1', { role: 'supervisor' }),
    ).rejects.toThrow(/last active admin/i);
  });

  it('allows disabling an admin when another active admin remains', async () => {
    const { prisma, service } = setup({ otherActiveAdmins: 1 });

    await service.updateStaff('someone-else', 'admin-1', {
      status: 'disabled',
    });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'admin-1' },
        data: { status: 'disabled' },
      }),
    );
  });

  it('refuses to touch portal users (clientId set)', async () => {
    const { service } = setup({
      target: { ...STAFF_ADMIN, id: 'portal-1', clientId: 'client-1' },
    });

    await expect(
      service.updateStaff('admin-1', 'portal-1', { status: 'disabled' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects an invalid status with 400', async () => {
    const { service } = setup();

    await expect(
      service.updateStaff('admin-1', 'admin-1', { status: 'away' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('UsersController portal isolation', () => {
  const portalUser = {
    userId: 'portal-1',
    role: 'client_admin',
    clientId: 'client-1',
  };

  it('forbids portal users from listing staff', () => {
    const { controller } = setup();
    expect(() => controller.listStaff(portalUser)).toThrow(ForbiddenException);
  });

  it('forbids portal users from creating staff', () => {
    const { controller } = setup();
    expect(() =>
      controller.createStaff(portalUser, {
        name: 'X',
        email: 'x@y.z',
        password: 'password-1',
        role: 'admin',
      }),
    ).toThrow(ForbiddenException);
  });

  it('forbids portal users from updating staff', () => {
    const { controller } = setup();
    expect(() =>
      controller.updateStaff(portalUser, 'admin-1', { status: 'disabled' }),
    ).toThrow(ForbiddenException);
  });
});

describe('AdminGuard', () => {
  const guard = new AdminGuard();
  const ctxFor = (user: unknown) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as never;

  it('allows staff admins and supervisors', () => {
    expect(guard.canActivate(ctxFor({ role: 'admin' }))).toBe(true);
    expect(guard.canActivate(ctxFor({ role: 'supervisor' }))).toBe(true);
  });

  it('blocks agents and portal roles', () => {
    expect(guard.canActivate(ctxFor({ role: 'agent' }))).toBe(false);
    expect(guard.canActivate(ctxFor({ role: 'client_admin' }))).toBe(false);
    expect(guard.canActivate(ctxFor({ role: 'client_staff' }))).toBe(false);
  });
});
