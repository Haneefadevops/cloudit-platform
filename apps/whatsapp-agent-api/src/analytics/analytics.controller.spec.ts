import { ForbiddenException } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';

const STAFF = { userId: 'u1', role: 'admin', email: 'staff@x.lk' };
const PORTAL = {
  userId: 'u2',
  role: 'client_admin',
  email: 'owner@clinic.lk',
  clientId: 'client-portal',
};

function setup() {
  const prisma = {
    conversation: {
      count: jest.fn().mockResolvedValue(10),
      groupBy: jest.fn().mockResolvedValue([
        { channel: 'whatsapp', _count: { channel: 6 } },
        { channel: 'messenger', _count: { channel: 3 } },
        { channel: 'instagram', _count: { channel: 1 } },
      ]),
    },
    message: { count: jest.fn().mockResolvedValue(50) },
    booking: { count: jest.fn().mockResolvedValue(4) },
    order: {
      count: jest.fn().mockResolvedValue(7),
      groupBy: jest
        .fn()
        .mockResolvedValue([
          { status: 'completed', _count: { status: 5 } },
          { status: 'cancelled', _count: { status: 2 } },
        ]),
      aggregate: jest.fn().mockResolvedValue({ _sum: { total: 9750 } }),
    },
    $queryRaw: jest.fn().mockImplementation((query: any) => {
      const sql = typeof query === 'string' ? query : query?.strings?.join('') || '';
      if (sql.includes('c.channel')) {
        return Promise.resolve([
          { channel: 'whatsapp', count: BigInt(40) },
          { channel: 'messenger', count: BigInt(8) },
          { channel: 'instagram', count: BigInt(2) },
        ]);
      }
      return Promise.resolve([
        { count: 3, total: 8, without_handoff: 6, avg: 4.5, reason: 'test', date: '2026-07-24', prompt: 100, completion: 50 },
      ]);
    }),
  };
  const config = { get: (_k: string, def?: unknown) => def };
  const controller = new AnalyticsController(prisma as never, config as never);
  return { prisma, controller };
}

describe('AnalyticsController audience split', () => {
  it('portal users never receive token counts or USD cost', async () => {
    const { controller } = setup();
    const result = (await controller.overview(PORTAL, 'someone-else')) as Record<
      string,
      unknown
    >;

    expect(result.tokens).toBeUndefined();
    expect(result.estimatedCostUsd).toBeUndefined();
    // ...but they do get the operational metrics
    expect(result.totalConversations).toBe(10);
    expect(result.bookings).toBeDefined();
    expect(result.orders).toBeDefined();
    expect(result.csat).toBeDefined();
  });

  it('portal users are scoped to their own client, ignoring the query param', async () => {
    const { prisma, controller } = setup();
    await controller.overview(PORTAL, 'someone-else');

    expect(prisma.conversation.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ clientId: 'client-portal' }),
      }),
    );
  });

  it('staff users receive token counts and USD cost', async () => {
    const { controller } = setup();
    const result = (await controller.overview(STAFF, 'client-1')) as Record<
      string,
      unknown
    >;

    expect(result.tokens).toBeDefined();
    expect(result.estimatedCostUsd).toBeDefined();
  });

  it('non-staff users without a clientId are rejected', async () => {
    const { controller } = setup();
    await expect(
      controller.overview({ role: 'agent' }, 'client-1'),
    ).rejects.toThrow(ForbiddenException);
  });
});

describe('AnalyticsController date range + new metrics', () => {
  it('applies a 7d range to conversation metrics', async () => {
    const { prisma, controller } = setup();
    const result = (await controller.overview(STAFF, undefined, '7d')) as Record<
      string,
      any
    >;

    expect(result.period.since).not.toBeNull();
    const convCall = prisma.conversation.count.mock.calls[0][0] as any;
    expect(convCall.where.createdAt.gte).toBeInstanceOf(Date);
    expect(convCall.where.createdAt.lte).toBeInstanceOf(Date);
    // 7d preset ≈ 6 days back from today
    const spanMs = Date.now() - convCall.where.createdAt.gte.getTime();
    expect(spanMs).toBeGreaterThan(5 * 24 * 60 * 60 * 1000);
    expect(spanMs).toBeLessThan(8 * 24 * 60 * 60 * 1000);
  });

  it('applies a custom from/to range', async () => {
    const { controller } = setup();
    const result = (await controller.overview(
      STAFF,
      undefined,
      undefined,
      '2026-07-01',
      '2026-07-15',
    )) as Record<string, any>;

    // startOfDay is server-local — compare calendar parts, not the ISO string.
    expect(result.period.since.getFullYear()).toBe(2026);
    expect(result.period.since.getMonth()).toBe(6); // July
    expect(result.period.since.getDate()).toBe(1);
    expect(result.period.until.getMonth()).toBe(6);
    expect(result.period.until.getDate()).toBe(15);
  });

  it('defaults to all-time when no range is given', async () => {
    const { prisma, controller } = setup();
    await controller.overview(STAFF);

    const convCall = prisma.conversation.count.mock.calls[0][0] as any;
    expect(convCall.where.createdAt).toBeUndefined();
  });

  it('computes orders revenue from completed orders only', async () => {
    const { prisma, controller } = setup();
    const result = (await controller.overview(STAFF, 'client-1', '30d')) as Record<
      string,
      any
    >;

    expect(prisma.order.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'completed' }),
        _sum: { total: true },
      }),
    );
    expect(result.orders.revenue).toBe(9750);
    expect(result.orders.byStatus).toEqual({ completed: 5, cancelled: 2 });
    expect(result.orders.total).toBe(7);
  });

  it('returns bookings metrics including no-show rate and upcoming this week', async () => {
    const { prisma, controller } = setup();
    const result = (await controller.overview(STAFF, 'client-1')) as Record<
      string,
      any
    >;

    expect(result.bookings.total).toBe(4);
    expect(result.bookings.confirmed).toBe(4);
    // no_show 4 / (no_show 4 + completed 4) = 0.5
    expect(result.bookings.noShowRate).toBe(0.5);
    expect(result.bookings.upcomingThisWeek).toBe(4);
    const upcomingCall = prisma.booking.count.mock.calls[4][0] as any;
    expect(upcomingCall.where.startAt.gte).toBeInstanceOf(Date);
  });

  it('exposes AI resolution and handoff rates', async () => {
    const { controller } = setup();
    const result = (await controller.overview(STAFF, 'client-1')) as Record<
      string,
      any
    >;

    // $queryRaw mock: without_handoff 6 / total 8
    expect(result.aiResolutionRate).toBe(0.75);
    // handoff count 3 / conversations 10
    expect(result.handoffRate).toBeCloseTo(0.3);
  });

  it('returns a channel breakdown for conversations and messages', async () => {
    const { controller } = setup();
    const result = (await controller.overview(STAFF, 'client-1')) as Record<
      string,
      any
    >;

    expect(result.byChannel).toBeDefined();
    expect(result.byChannel.conversations).toEqual([
      { channel: 'whatsapp', count: 6 },
      { channel: 'messenger', count: 3 },
      { channel: 'instagram', count: 1 },
    ]);
    expect(result.byChannel.messages).toBeDefined();
    expect(Array.isArray(result.byChannel.messages)).toBe(true);
    result.byChannel.messages.forEach((m: any) => {
      expect(m).toHaveProperty('channel');
      expect(m).toHaveProperty('count');
      expect(typeof m.count).toBe('number');
    });
  });
});
