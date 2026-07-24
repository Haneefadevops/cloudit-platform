import { AvailabilityService } from './availability.service';

const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

// Fixed future dates so the "drop past slots" filter never interferes.
// 2099-07-24 is a Friday, 2099-07-25 a Saturday, 2099-07-26 a Sunday.
const FRI = '2099-07-24';
const SAT = '2099-07-25';

function weekdayName(date: string): string {
  return DAY_NAMES[new Date(`${date}T12:00:00Z`).getUTCDay()];
}

function mockPrisma(overrides: {
  client?: Record<string, unknown>;
  service?: Record<string, unknown> | null;
  staff?: Array<Record<string, unknown>>;
  bookings?: Array<{ startAt: Date; endAt: Date }>;
}) {
  return {
    client: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'client-1',
        timezone: 'UTC',
        operatingHoursStart: '09:00',
        operatingHoursEnd: '17:00',
        closedDays: 'Saturday,Sunday',
        ...overrides.client,
      }),
    },
    service: {
      findFirst: jest.fn().mockResolvedValue(
        overrides.service === null
          ? null
          : {
              id: 'service-1',
              clientId: 'client-1',
              active: true,
              durationMinutes: 60,
              ...overrides.service,
            },
      ),
    },
    staff: {
      findMany: jest.fn().mockResolvedValue(overrides.staff ?? []),
    },
    booking: {
      findMany: jest.fn().mockResolvedValue(overrides.bookings ?? []),
    },
  };
}

describe('AvailabilityService', () => {
  describe('localToUtc', () => {
    it('converts wall-clock time in a timezone to UTC', () => {
      const service = new AvailabilityService(mockPrisma({}) as never);
      // Asia/Colombo is UTC+5:30 (no DST).
      expect(service.localToUtc('2026-07-24T19:30:00', 'Asia/Colombo')).toEqual(
        new Date('2026-07-24T14:00:00Z'),
      );
      expect(service.localToUtc('2026-07-24T09:00:00', 'UTC')).toEqual(
        new Date('2026-07-24T09:00:00Z'),
      );
    });
  });

  describe('getAvailableSlots', () => {
    it('slices business operating hours into duration-sized slots', async () => {
      const service = new AvailabilityService(mockPrisma({}) as never);
      const slots = await service.getAvailableSlots('client-1', 'service-1', FRI);
      // 09:00-17:00 with 60min duration => 8 slots.
      expect(slots).toHaveLength(8);
      expect(slots[0].startAt).toBe(`${FRI}T09:00:00.000Z`);
      expect(slots[0].endAt).toBe(`${FRI}T10:00:00.000Z`);
      expect(slots[7].startAt).toBe(`${FRI}T16:00:00.000Z`);
      expect(slots[0].staffId).toBeNull();
    });

    it('returns no slots on closed days', async () => {
      const service = new AvailabilityService(mockPrisma({}) as never);
      const slots = await service.getAvailableSlots('client-1', 'service-1', SAT);
      expect(slots).toHaveLength(0);
    });

    it('slices by longer service durations', async () => {
      const service = new AvailabilityService(
        mockPrisma({
          client: { operatingHoursStart: '09:00', operatingHoursEnd: '12:00' },
          service: { durationMinutes: 90 },
        }) as never,
      );
      const slots = await service.getAvailableSlots('client-1', 'service-1', FRI);
      // 09:00-12:00 with 90min => 09:00, 10:30.
      expect(slots.map((s) => s.startAt)).toEqual([
        `${FRI}T09:00:00.000Z`,
        `${FRI}T10:30:00.000Z`,
      ]);
    });

    it('excludes slots overlapping existing bookings', async () => {
      const service = new AvailabilityService(
        mockPrisma({
          bookings: [
            {
              startAt: new Date(`${FRI}T10:30:00Z`),
              endAt: new Date(`${FRI}T11:30:00Z`),
            },
          ],
        }) as never,
      );
      const slots = await service.getAvailableSlots('client-1', 'service-1', FRI);
      const starts = slots.map((s) => s.startAt);
      // 10:00-11:00 and 11:00-12:00 both overlap the 10:30-11:30 booking.
      expect(starts).not.toContain(`${FRI}T10:00:00.000Z`);
      expect(starts).not.toContain(`${FRI}T11:00:00.000Z`);
      expect(starts).toContain(`${FRI}T09:00:00.000Z`);
      expect(starts).toContain(`${FRI}T12:00:00.000Z`);
      expect(slots).toHaveLength(6);
    });

    it('supports overnight operating hours (22:00-02:00)', async () => {
      const service = new AvailabilityService(
        mockPrisma({
          client: {
            operatingHoursStart: '22:00',
            operatingHoursEnd: '02:00',
            closedDays: '',
          },
        }) as never,
      );
      // Every day has the overnight window, so each date gets the previous
      // day's spillover (00:00-02:00) plus its own pre-midnight part.
      const friSlots = await service.getAvailableSlots('client-1', 'service-1', FRI);
      expect(friSlots.map((s) => s.startAt)).toEqual([
        `${FRI}T00:00:00.000Z`,
        `${FRI}T01:00:00.000Z`,
        `${FRI}T22:00:00.000Z`,
        `${FRI}T23:00:00.000Z`,
      ]);
      const satSlots = await service.getAvailableSlots('client-1', 'service-1', SAT);
      expect(satSlots.map((s) => s.startAt)).toEqual([
        `${SAT}T00:00:00.000Z`,
        `${SAT}T01:00:00.000Z`,
        `${SAT}T22:00:00.000Z`,
        `${SAT}T23:00:00.000Z`,
      ]);
    });

    it('uses staff weekly hours when staff rows exist', async () => {
      const service = new AvailabilityService(
        mockPrisma({
          staff: [
            {
              id: 'staff-1',
              name: 'Dr. Perera',
              active: true,
              weeklyHours: { [weekdayName(FRI)]: { start: '13:00', end: '15:00' } },
              daysOff: [],
            },
          ],
        }) as never,
      );
      const slots = await service.getAvailableSlots('client-1', 'service-1', FRI);
      expect(slots).toHaveLength(2);
      expect(slots[0].staffId).toBe('staff-1');
      expect(slots[0].staffName).toBe('Dr. Perera');
      expect(slots[0].startAt).toBe(`${FRI}T13:00:00.000Z`);
    });

    it('respects staff days off', async () => {
      const service = new AvailabilityService(
        mockPrisma({
          staff: [
            {
              id: 'staff-1',
              name: 'Dr. Perera',
              active: true,
              weeklyHours: { [weekdayName(FRI)]: { start: '13:00', end: '15:00' } },
              daysOff: [FRI],
            },
          ],
        }) as never,
      );
      const slots = await service.getAvailableSlots('client-1', 'service-1', FRI);
      expect(slots).toHaveLength(0);
    });

    it('converts slots to the client timezone', async () => {
      const service = new AvailabilityService(
        mockPrisma({
          client: {
            timezone: 'Asia/Colombo',
            operatingHoursStart: '09:00',
            operatingHoursEnd: '11:00',
          },
        }) as never,
      );
      const slots = await service.getAvailableSlots('client-1', 'service-1', FRI);
      // 09:00 Colombo = 03:30 UTC.
      expect(slots.map((s) => s.startAt)).toEqual([
        `${FRI}T03:30:00.000Z`,
        `${FRI}T04:30:00.000Z`,
      ]);
    });

    it('returns empty when the service does not exist for the client', async () => {
      const service = new AvailabilityService(
        mockPrisma({ service: null }) as never,
      );
      const slots = await service.getAvailableSlots('client-1', 'service-1', FRI);
      expect(slots).toHaveLength(0);
    });
  });
});
