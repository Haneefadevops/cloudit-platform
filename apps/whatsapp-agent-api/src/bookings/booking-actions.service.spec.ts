import { BookingActionsService } from './booking-actions.service';
import { AvailabilityService } from './availability.service';

const CLIENT = {
  id: 'client-1',
  name: 'Test Clinic',
  timezone: 'UTC',
  bookingApprovalMode: 'approval',
};
const CUSTOMER = { id: 'cust-1', name: 'Nimal', phoneNumber: '+94771234567' };

const SERVICE = {
  id: 'svc-1',
  name: 'Consultation',
  durationMinutes: 30,
  requiresConfirmation: false,
  active: true,
};
const STAFF = { id: 'staff-1', name: 'Dr. Perera', active: true };

const SLOT = {
  startAt: '2099-07-24T19:30:00.000Z',
  endAt: '2099-07-24T20:00:00.000Z',
  staffId: 'staff-1',
  staffName: 'Dr. Perera',
};

function setup(overrides: {
  bookingApprovalMode?: string;
  slots?: typeof SLOT[];
  service?: typeof SERVICE | null;
  targetBooking?: Record<string, unknown> | null;
}) {
  const prisma = {
    service: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          overrides.service === undefined ? SERVICE : overrides.service,
        ),
    },
    staff: { findFirst: jest.fn().mockResolvedValue(STAFF) },
    booking: {
      create: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'bk-new',
          notes: null,
          intakeAnswers: data.intakeAnswers,
          ...data,
        }),
      ),
      update: jest.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          id: 'bk-1',
          startAt: new Date('2099-07-25T10:00:00Z'),
          service: SERVICE,
          staff: STAFF,
          status: 'confirmed',
          ...data,
        }),
      ),
      findFirst: jest
        .fn()
        .mockResolvedValue(
          overrides.targetBooking === undefined
            ? {
                id: 'bk-1',
                serviceId: SERVICE.id,
                staffId: STAFF.id,
                startAt: new Date('2099-07-24T19:30:00Z'),
              }
            : overrides.targetBooking,
        ),
    },
  };
  const availability = new AvailabilityService({} as never);
  availability.getAvailableSlots = jest
    .fn()
    .mockResolvedValue(overrides.slots ?? [SLOT]);
  const service = new BookingActionsService(prisma as never, availability);
  const client = {
    ...CLIENT,
    ...(overrides.bookingApprovalMode
      ? { bookingApprovalMode: overrides.bookingApprovalMode }
      : {}),
  };
  return { prisma, availability, service, client };
}

describe('BookingActionsService', () => {
  it('check_availability lists real slots', async () => {
    const { service, client } = setup({});
    const result = await service.execute({
      client,
      customer: CUSTOMER,
      action: {
        type: 'check_availability',
        service: 'Consultation',
        date: '2099-07-24',
      },
    });
    expect(result.summary).toContain('Consultation');
    expect(result.summary).toContain('Dr. Perera');
    expect(result.summary).not.toContain('NOT');
  });

  it('check_availability reports when no slots exist', async () => {
    const { service, client } = setup({ slots: [] });
    const result = await service.execute({
      client,
      customer: CUSTOMER,
      action: {
        type: 'check_availability',
        service: 'Consultation',
        date: '2099-07-24',
      },
    });
    expect(result.summary).toContain('No available slots');
  });

  it('create_booking in approval mode creates a pending booking', async () => {
    const { service, client, prisma } = setup({});
    const result = await service.execute({
      client,
      customer: CUSTOMER,
      action: {
        type: 'create_booking',
        service: 'Consultation',
        date: '2099-07-24',
        time: '7:30pm',
        staff: 'Dr. Perera',
        intakeAnswers: { 'Party size?': '2' },
      },
    });
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'pending',
          staffId: 'staff-1',
          serviceId: 'svc-1',
          customerId: 'cust-1',
        }),
      }),
    );
    expect(result.requiresApproval).toBe(true);
    expect(result.staffNotification).toContain('Consultation');
    expect(result.summary).toContain('PENDING');
  });

  it('create_booking in auto mode confirms immediately', async () => {
    const { service, client, prisma } = setup({ bookingApprovalMode: 'auto' });
    const result = await service.execute({
      client,
      customer: CUSTOMER,
      action: {
        type: 'create_booking',
        service: 'Consultation',
        date: '2099-07-24',
        time: '19:30',
      },
    });
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'confirmed' }),
      }),
    );
    expect(result.requiresApproval).toBe(false);
    expect(result.summary).toContain('CONFIRMED');
  });

  it('create_booking stays pending in auto mode when the service requires confirmation', async () => {
    const { service, client, prisma } = setup({
      bookingApprovalMode: 'auto',
      service: { ...SERVICE, requiresConfirmation: true },
    });
    const result = await service.execute({
      client,
      customer: CUSTOMER,
      action: {
        type: 'create_booking',
        service: 'Consultation',
        date: '2099-07-24',
        time: '19:30',
      },
    });
    expect(prisma.booking.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'pending' }),
      }),
    );
    expect(result.requiresApproval).toBe(true);
  });

  it('create_booking rejects a time that is not a real available slot', async () => {
    const { service, client, prisma } = setup({ slots: [] });
    const result = await service.execute({
      client,
      customer: CUSTOMER,
      action: {
        type: 'create_booking',
        service: 'Consultation',
        date: '2099-07-24',
        time: '19:30',
      },
    });
    expect(prisma.booking.create).not.toHaveBeenCalled();
    expect(result.summary).toContain('NOT available');
    expect(result.summary).toContain('NOT created');
  });

  it('create_booking rejects an unknown service', async () => {
    const { service, client, prisma } = setup({ service: null });
    const result = await service.execute({
      client,
      customer: CUSTOMER,
      action: {
        type: 'create_booking',
        service: 'Spaceship rental',
        date: '2099-07-24',
        time: '19:30',
      },
    });
    expect(prisma.booking.create).not.toHaveBeenCalled();
    expect(result.summary).toContain('NOT created');
  });

  it('cancel_booking cancels the customer upcoming booking', async () => {
    const { service, client, prisma } = setup({});
    const result = await service.execute({
      client,
      customer: CUSTOMER,
      action: { type: 'cancel_booking', service: 'Consultation' },
    });
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'bk-1' },
        data: { status: 'cancelled' },
      }),
    );
    expect(result.summary).toContain('CANCELLED');
    expect(result.staffNotification).toContain('cancelled');
  });

  it('cancel_booking does nothing when no booking exists', async () => {
    const { service, client, prisma } = setup({ targetBooking: null });
    const result = await service.execute({
      client,
      customer: CUSTOMER,
      action: { type: 'cancel_booking' },
    });
    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(result.summary).toContain('Nothing was cancelled');
  });

  it('reschedule_booking validates the new slot excluding the booking itself', async () => {
    const { service, client, prisma, availability } = setup({
      slots: [
        {
          startAt: '2099-07-25T10:00:00.000Z',
          endAt: '2099-07-25T10:30:00.000Z',
          staffId: 'staff-1',
          staffName: 'Dr. Perera',
        },
      ],
    });
    const result = await service.execute({
      client,
      customer: CUSTOMER,
      action: {
        type: 'reschedule_booking',
        date: '2099-07-25',
        time: '10:00',
      },
    });
    // 5th argument is excludeBookingId so the booking does not block itself.
    expect(availability.getAvailableSlots).toHaveBeenCalledWith(
      'client-1',
      'svc-1',
      '2099-07-25',
      'staff-1',
      'bk-1',
    );
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'bk-1' },
        data: {
          startAt: new Date('2099-07-25T10:00:00.000Z'),
          endAt: new Date('2099-07-25T10:30:00.000Z'),
        },
      }),
    );
    expect(result.summary).toContain('RESCHEDULED');
  });

  it('returns a guidance summary for unknown action types', async () => {
    const { service, client } = setup({});
    const result = await service.execute({
      client,
      customer: CUSTOMER,
      action: { type: 'book_a_spaceship' },
    });
    expect(result.summary).toContain('Unknown booking action');
  });
});
