import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface Slot {
  startAt: string; // ISO (UTC)
  endAt: string; // ISO (UTC)
  staffId: string | null;
  staffName: string | null;
}

interface DayHours {
  start: string; // "HH:mm"
  end: string; // "HH:mm" — may be earlier than start for overnight ranges
}

const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/** Formats an ISO time in the client's timezone, e.g. "Fri, Jul 24, 7:30 PM". */
export function formatInTimezone(iso: string, timezone?: string | null): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      timeZone: timezone || 'UTC',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns bookable slots for a client's service on a given date
   * (YYYY-MM-DD in the client's timezone).
   *
   * Availability = staff weekly hours (or the client's operating hours when
   * the client has no staff rows) minus existing bookings, sliced into slots
   * by the service duration. Overnight ranges (e.g. 22:00-02:00) are
   * supported, mirroring whatsapp.service.ts isWithinOperatingHours.
   */
  async getAvailableSlots(
    clientId: string,
    serviceId: string,
    date: string,
    staffId?: string,
    excludeBookingId?: string,
  ): Promise<Slot[]> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) return [];

    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, clientId, active: true },
    });
    if (!service) return [];

    const timezone = client.timezone || 'UTC';
    const duration = service.durationMinutes || 60;

    const staffRows = await this.prisma.staff.findMany({
      where: { clientId, active: true, ...(staffId ? { id: staffId } : {}) },
    });

    // Each resource (a staff member, or the business itself when no staff
    // rows exist) produces its own slot list.
    const resources: Array<{
      staffId: string | null;
      staffName: string | null;
      windows: Record<string, DayHours>; // per weekday name
      daysOff: string[];
    }> =
      staffRows.length > 0
        ? staffRows.map((s) => ({
            staffId: s.id,
            staffName: s.name,
            windows:
              (s.weeklyHours as unknown as Record<string, DayHours>) || {},
            daysOff: Array.isArray(s.daysOff) ? (s.daysOff as string[]) : [],
          }))
        : [
            {
              staffId: null,
              staffName: null,
              windows: this.businessWindows(client),
              daysOff: [],
            },
          ];

    const slots: Slot[] = [];
    for (const resource of resources) {
      // Existing bookings for this resource around the requested date.
      const rangeStart = this.localToUtc(`${date}T00:00:00`, timezone);
      const rangeEnd = new Date(rangeStart.getTime() + 48 * 60 * 60 * 1000);
      const bookings = await this.prisma.booking.findMany({
        where: {
          clientId,
          staffId: resource.staffId,
          status: { in: ['pending', 'confirmed'] },
          ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
          startAt: { lt: rangeEnd },
          endAt: { gt: new Date(rangeStart.getTime() - 24 * 60 * 60 * 1000) },
        },
        select: { startAt: true, endAt: true },
      });

      slots.push(
        ...this.slotsForResource(
          resource,
          date,
          duration,
          timezone,
          bookings,
        ),
      );
    }

    // Drop past slots and sort chronologically.
    const now = new Date();
    return slots
      .filter((s) => new Date(s.startAt) > now)
      .sort((a, b) => a.startAt.localeCompare(b.startAt));
  }

  /** Business-level windows from the client's operating hours fields. */
  private businessWindows(client: {
    operatingHoursStart: string | null;
    operatingHoursEnd: string | null;
    closedDays: string | null;
  }): Record<string, DayHours> {
    const start = client.operatingHoursStart;
    const end = client.operatingHoursEnd;
    if (!start || !end) return {};
    const closed = (client.closedDays || '')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    const windows: Record<string, DayHours> = {};
    for (const day of DAY_NAMES) {
      if (!closed.includes(day)) windows[day] = { start, end };
    }
    return windows;
  }

  /**
   * Generates slots for one resource on `date`. Handles overnight windows:
   * a window starting on `date` may run past midnight, and a window starting
   * the previous day may spill into `date`.
   */
  private slotsForResource(
    resource: {
      staffId: string | null;
      staffName: string | null;
      windows: Record<string, DayHours>;
      daysOff: string[];
    },
    date: string,
    durationMinutes: number,
    timezone: string,
    bookings: Array<{ startAt: Date; endAt: Date }>,
  ): Slot[] {
    const intervals: Array<{ startMin: number; endMin: number }> = [];

    const collectFor = (dayDate: string, spillOnly: boolean) => {
      if (resource.daysOff.includes(dayDate)) return;
      const weekday = DAY_NAMES[this.weekdayOf(dayDate)];
      const hours = resource.windows[weekday];
      if (!hours) return;
      const startMin = this.toMinutes(hours.start);
      const endMin = this.toMinutes(hours.end);
      if (startMin === null || endMin === null) return;

      const offset = spillOnly ? -1440 : 0; // minutes relative to `date` 00:00
      if (startMin <= endMin) {
        if (!spillOnly) {
          intervals.push({ startMin: startMin + offset, endMin: endMin + offset });
        }
      } else {
        // Overnight: only the part that falls on `date` is relevant —
        // [start, 24:00) for the day's own window, [00:00, end) when the
        // previous day's window spills into `date`.
        if (spillOnly) {
          intervals.push({ startMin: 0, endMin });
        } else {
          intervals.push({ startMin, endMin: 1440 });
        }
      }
    };

    collectFor(date, false);
    collectFor(this.shiftDate(date, -1), true);

    const dayStartUtc = this.localToUtc(`${date}T00:00:00`, timezone);
    const slots: Slot[] = [];
    for (const interval of intervals) {
      for (
        let min = interval.startMin;
        min + durationMinutes <= interval.endMin;
        min += durationMinutes
      ) {
        const startAt = new Date(dayStartUtc.getTime() + min * 60 * 1000);
        const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
        const overlaps = bookings.some(
          (b) => startAt < b.endAt && endAt > b.startAt,
        );
        if (!overlaps) {
          slots.push({
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            staffId: resource.staffId,
            staffName: resource.staffName,
          });
        }
      }
    }
    return slots;
  }

  private weekdayOf(date: string): number {
    // Noon UTC avoids any DST edge around midnight.
    return new Date(`${date}T12:00:00Z`).getUTCDay();
  }

  private shiftDate(date: string, days: number): string {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  private toMinutes(hhmm: string): number | null {
    const [h, m] = (hhmm || '').split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  }

  /**
   * Converts a wall-clock time in `timezone` to a UTC Date.
   * Uses the Intl API only (no date library in this project).
   */
  localToUtc(localIso: string, timezone: string): Date {
    const wallAsUtc = new Date(`${localIso}Z`).getTime();
    let utc = wallAsUtc;
    // Refine twice: the offset can differ between the first guess and the
    // final time around DST transitions.
    for (let i = 0; i < 2; i++) {
      utc = wallAsUtc - this.timezoneOffsetMs(new Date(utc), timezone);
    }
    return new Date(utc);
  }

  /** Milliseconds the timezone is ahead of UTC at `date` (e.g. +5.5h for Colombo). */
  private timezoneOffsetMs(date: Date, timezone: string): number {
    // Both strings are parsed in the server-local timezone, so the server
    // offset cancels out and only the zone-vs-UTC difference remains.
    const zoneWall = new Date(
      date.toLocaleString('en-US', { timeZone: timezone }),
    ).getTime();
    const utcWall = new Date(
      date.toLocaleString('en-US', { timeZone: 'UTC' }),
    ).getTime();
    return zoneWall - utcWall;
  }
}
