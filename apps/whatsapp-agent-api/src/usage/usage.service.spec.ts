import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsageService } from './usage.service';

function setup(overrides: {
  client?: Record<string, unknown> | null;
  used?: number;
} = {}) {
  const prisma = {
    client: {
      findUnique: jest.fn().mockResolvedValue(
        overrides.client === undefined
          ? {
              id: 'client-1',
              planAllowance: 500,
              topUpCredits: 0,
              usageResetAt: new Date(), // current period
            }
          : overrides.client,
      ),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'client-1',
          planAllowance: 500,
          topUpCredits: 0,
          ...data,
        }),
      ),
    },
    conversation: {
      count: jest.fn().mockResolvedValue(overrides.used ?? 0),
    },
    topUpPurchase: {
      create: jest
        .fn()
        .mockImplementation(({ data }) => Promise.resolve({ id: 'tu-1', ...data })),
      findMany: jest.fn().mockResolvedValue([]),
    },
    $transaction: jest
      .fn()
      .mockImplementation((promises: Promise<unknown>[]) =>
        Promise.all(promises),
      ),
  };
  const service = new UsageService(prisma as never);
  return { prisma, service };
}

describe('UsageService balance math', () => {
  it('balance = planAllowance + topUpCredits − used', async () => {
    const { service } = setup({ used: 3 });
    const usage = await service.getUsage('client-1');

    expect(usage?.balance).toBe(497);
    expect(usage?.used).toBe(3);
    expect(usage?.allowanceRemaining).toBe(497);
    expect(usage?.topUpRemaining).toBe(0);
    expect(usage?.remainingPct).toBeCloseTo(497 / 500);
  });

  it('top-up credits are spent after the allowance', async () => {
    const { service } = setup({
      client: {
        id: 'client-1',
        planAllowance: 500,
        topUpCredits: 100,
        usageResetAt: new Date(),
      },
      used: 550,
    });
    const usage = await service.getUsage('client-1');

    expect(usage?.allowanceRemaining).toBe(0);
    expect(usage?.topUpRemaining).toBe(50);
    expect(usage?.balance).toBe(50);
  });

  it('balance clamps at 0 when usage exceeds the total (enforcement point)', async () => {
    const { service } = setup({ used: 500 });
    const usage = await service.getUsage('client-1');

    expect(usage?.balance).toBe(0);
    expect(usage?.remainingPct).toBe(0);
  });

  it('returns null for an unknown client', async () => {
    const { service } = setup({ client: null });
    expect(await service.getUsage('missing')).toBeNull();
  });
});

describe('UsageService monthly reset', () => {
  it('advances usageResetAt by whole months when the period elapsed', async () => {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const { prisma, service } = setup({
      client: {
        id: 'client-1',
        planAllowance: 500,
        topUpCredits: 42,
        usageResetAt: twoMonthsAgo,
      },
    });

    await service.getUsage('client-1');

    const data = (prisma.client.update.mock.calls[0][0] as any).data;
    // Reset advanced ~2 months forward, into the current period.
    expect(data.usageResetAt.getTime()).toBeGreaterThan(twoMonthsAgo.getTime());
    expect(data.usageResetAt.getTime()).toBeLessThanOrEqual(Date.now());
    // Top-up credits are NEVER touched by the reset.
    expect(data.topUpCredits).toBeUndefined();
  });

  it('does not update the client when the period is still current', async () => {
    const { prisma, service } = setup({ used: 10 });
    await service.getUsage('client-1');
    expect(prisma.client.update).not.toHaveBeenCalled();
  });
});

describe('UsageService top-up (resume after 0)', () => {
  it('records the purchase and increments topUpCredits atomically', async () => {
    const { prisma, service } = setup({});
    await service.topUp('client-1', {
      credits: 500,
      priceLkr: 3000,
      note: 'Bank transfer ref 123',
    });

    expect(prisma.topUpPurchase.create).toHaveBeenCalledWith({
      data: {
        clientId: 'client-1',
        credits: 500,
        priceLkr: 3000,
        note: 'Bank transfer ref 123',
      },
    });
    expect(prisma.client.update).toHaveBeenCalledWith({
      where: { id: 'client-1' },
      data: { topUpCredits: { increment: 500 } },
    });
  });

  it('balance goes from 0 to positive after a top-up (resume is automatic)', async () => {
    // Client exhausted: used 500 of 500.
    const { prisma, service } = setup({ used: 500 });
    expect((await service.getUsage('client-1'))?.balance).toBe(0);

    // Top-up applied: client now carries 500 topUpCredits.
    prisma.client.findUnique.mockResolvedValue({
      id: 'client-1',
      planAllowance: 500,
      topUpCredits: 500,
      usageResetAt: new Date(),
    });

    const usage = await service.getUsage('client-1');
    expect(usage?.balance).toBe(500); // AI resumes with the next message
  });

  it('validates credits and price', async () => {
    const { service } = setup({});
    await expect(
      service.topUp('client-1', { credits: 0, priceLkr: 3000 }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.topUp('client-1', { credits: 500, priceLkr: -1 }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects top-ups for unknown clients', async () => {
    const { service } = setup({ client: null });
    await expect(
      service.topUp('missing', { credits: 500, priceLkr: 3000 }),
    ).rejects.toThrow(NotFoundException);
  });
});
