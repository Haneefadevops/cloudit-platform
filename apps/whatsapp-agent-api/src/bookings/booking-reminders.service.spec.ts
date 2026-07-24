import { BookingRemindersService } from './booking-reminders.service';

const NOW = new Date('2026-07-24T12:00:00Z');

function setup(overrides: {
  clients?: Array<{ id: string; bookingReminderHours: number | null }>;
  bookings?: Array<Record<string, unknown>>;
  sendFails?: boolean;
}) {
  const prisma = {
    client: {
      findMany: jest.fn().mockResolvedValue(
        overrides.clients ?? [
          { id: 'client-1', bookingReminderHours: 24 },
        ],
      ),
    },
    booking: {
      findMany: jest.fn().mockResolvedValue(
        overrides.bookings ?? [
          {
            id: 'bk-1',
            startAt: new Date('2026-07-25T14:00:00Z'),
            service: { name: 'Consultation' },
            staff: { name: 'Dr. Perera' },
            customer: { name: 'Nimal', phoneNumber: '+94771234567' },
            client: {
              id: 'client-1',
              name: 'Test Clinic',
              timezone: 'UTC',
              metaAccessToken: 'token',
              whatsappPhoneNumberId: 'pn-1',
            },
          },
        ],
      ),
      update: jest.fn().mockResolvedValue({}),
    },
  };
  const sender = {
    sendMessage: overrides.sendFails
      ? jest.fn().mockRejectedValue(new Error('Meta API down'))
      : jest.fn().mockResolvedValue(undefined),
  };
  const service = new BookingRemindersService(
    prisma as never,
    sender as never,
  );
  return { prisma, sender, service };
}

describe('BookingRemindersService', () => {
  it('selects only confirmed, unreminded bookings within the client window', async () => {
    const { service, prisma } = setup({});
    const due = await service.findDueReminders(NOW);

    expect(prisma.client.findMany).toHaveBeenCalledWith({
      where: {
        status: 'active',
        bookingsEnabled: true,
        bookingReminderHours: { gt: 0 },
      },
      select: { id: true, bookingReminderHours: true },
    });
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          clientId: 'client-1',
          status: 'confirmed',
          reminderSentAt: null,
          startAt: {
            gt: NOW,
            lte: new Date(NOW.getTime() + 24 * 60 * 60 * 1000),
          },
        }),
      }),
    );
    expect(due).toHaveLength(1);
  });

  it('sends the reminder and stamps reminderSentAt', async () => {
    const { service, prisma, sender } = setup({});
    const sent = await service.sendDueReminders(NOW);

    expect(sender.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '+94771234567',
        message: expect.stringContaining('Consultation'),
      }),
    );
    const message = sender.sendMessage.mock.calls[0][0].message as string;
    expect(message).toContain('Dr. Perera');
    expect(message).toContain('Test Clinic');
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'bk-1' },
      data: { reminderSentAt: NOW },
    });
    expect(sent).toBe(1);
  });

  it('does not stamp reminderSentAt when sending fails, and continues', async () => {
    const { service, prisma } = setup({ sendFails: true });
    const sent = await service.sendDueReminders(NOW);

    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(sent).toBe(0);
  });

  it('returns nothing when no clients have reminders enabled', async () => {
    const { service, prisma } = setup({ clients: [] });
    const due = await service.findDueReminders(NOW);

    expect(prisma.booking.findMany).not.toHaveBeenCalled();
    expect(due).toHaveLength(0);
  });

  it('tick never overlaps with itself', async () => {
    const { service, prisma } = setup({});
    // Simulate a slow first tick.
    let resolveFind: (v: unknown) => void = () => {};
    prisma.booking.findMany.mockReturnValueOnce(
      new Promise((r) => {
        resolveFind = r;
      }),
    );
    const first = service.tick(NOW);
    await service.tick(NOW); // should no-op while the first is running
    resolveFind([]);
    await first;
    expect(prisma.booking.findMany).toHaveBeenCalledTimes(1);
  });
});
