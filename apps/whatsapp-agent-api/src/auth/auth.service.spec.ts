import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { AgentsService } from '../agents/agents.service';

function setup(user: Record<string, unknown> | null) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: unknown }) => data),
    },
  };
  const agentsService = new AgentsService(prisma as never);
  const jwtService = { sign: jest.fn().mockReturnValue('jwt-token') };
  const service = new AuthService(jwtService as never, agentsService);
  return { prisma, jwtService, service };
}

describe('AuthService.changePassword', () => {
  it('rejects a wrong current password with 400', async () => {
    const { service } = setup({
      id: 'u1',
      password: await bcrypt.hash('correct-horse', 10),
      status: 'active',
    });

    await expect(
      service.changePassword('u1', 'wrong-password', 'new-password-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('updates the hash on success (new password verifies, old does not)', async () => {
    const { prisma, service } = setup({
      id: 'u1',
      password: await bcrypt.hash('correct-horse', 10),
      status: 'active',
    });

    await service.changePassword('u1', 'correct-horse', 'new-password-1');

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    const updated = prisma.user.update.mock.calls[0][0] as {
      data: { password: string };
    };
    expect(updated.data.password).not.toBe('new-password-1');
    await expect(
      bcrypt.compare('new-password-1', updated.data.password),
    ).resolves.toBe(true);
    await expect(
      bcrypt.compare('correct-horse', updated.data.password),
    ).resolves.toBe(false);
  });

  it('rejects a short new password with 400', async () => {
    const { service, prisma } = setup({
      id: 'u1',
      password: await bcrypt.hash('correct-horse', 10),
      status: 'active',
    });

    await expect(
      service.changePassword('u1', 'correct-horse', 'short'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('AuthService.validateUser', () => {
  it('rejects a disabled account even with the correct password', async () => {
    const { service } = setup({
      id: 'u1',
      email: 'admin@thereplyte.com',
      password: await bcrypt.hash('correct-horse', 10),
      status: 'disabled',
    });

    await expect(
      service.validateUser('admin@thereplyte.com', 'correct-horse'),
    ).rejects.toThrow(/disabled/i);
  });

  it('rejects a disabled account with UnauthorizedException (401)', async () => {
    const { service } = setup({
      id: 'u1',
      email: 'admin@thereplyte.com',
      password: await bcrypt.hash('correct-horse', 10),
      status: 'disabled',
    });

    await expect(
      service.validateUser('admin@thereplyte.com', 'correct-horse'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('still accepts an active user with the correct password', async () => {
    const { service } = setup({
      id: 'u1',
      email: 'admin@thereplyte.com',
      password: await bcrypt.hash('correct-horse', 10),
      status: 'active',
    });

    const user = await service.validateUser(
      'admin@thereplyte.com',
      'correct-horse',
    );
    expect(user).toMatchObject({ id: 'u1' });
  });
});
