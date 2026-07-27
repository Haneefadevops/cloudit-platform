import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppSenderService } from '../whatsapp-sender/whatsapp-sender.service';

export const DEFAULT_ALERT_TIMEZONE = 'Asia/Colombo';

export interface AlertContact {
  id: string;
  name: string;
  phone: string;
  active: boolean;
  mode: string; // always | scheduled
  daysOfWeek: unknown; // Json: ["mon","tue",...]
  startTime: string | null;
  endTime: string | null;
}

const DAY_CODES = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

/** "HH:MM" → minutes since midnight, or null when malformed. */
export function parseTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Current weekday code and minutes-since-midnight in the given timezone. */
export function localParts(
  now: Date,
  timeZone: string,
): { day: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '';
  const day = get('weekday').slice(0, 3).toLowerCase();
  // hour12:false can render midnight as "24" in some runtimes
  const hours = Number(get('hour')) % 24;
  return { day, minutes: hours * 60 + Number(get('minute')) };
}

function previousDay(day: string): string {
  const index = DAY_CODES.indexOf(day as never);
  return DAY_CODES[(index + 6) % 7];
}

/**
 * Is a scheduled contact on duty right now? Days are lowercase codes
 * ("mon".."sun"); the window supports overnight ranges (18:00–08:00), where
 * the early-morning leg belongs to the previous day's schedule. Equal
 * start/end means the whole day.
 */
export function isOnDuty(
  contact: Pick<AlertContact, 'daysOfWeek' | 'startTime' | 'endTime'>,
  now: Date,
  timeZone: string,
): boolean {
  const days = Array.isArray(contact.daysOfWeek)
    ? (contact.daysOfWeek as string[])
    : [];
  const start = parseTime(contact.startTime);
  const end = parseTime(contact.endTime);
  if (!days.length || start === null || end === null) return false;

  const { day, minutes } = localParts(now, timeZone);

  if (start === end) return days.includes(day);
  if (start < end) {
    return days.includes(day) && minutes >= start && minutes < end;
  }
  // Overnight window: evening leg is today's schedule, early-morning leg
  // belongs to yesterday's.
  return (
    (days.includes(day) && minutes >= start) ||
    (days.includes(previousDay(day)) && minutes < end)
  );
}

/**
 * Round-robin pick over the on-duty contacts (sorted by id for a stable
 * order). Advances past `lastContactId`; wraps at the end of the list.
 */
export function pickRotated<T extends { id: string }>(
  onDuty: T[],
  lastContactId: string | null | undefined,
): T | null {
  if (!onDuty.length) return null;
  const sorted = [...onDuty].sort((a, b) => a.id.localeCompare(b.id));
  const lastIndex = sorted.findIndex((c) => c.id === lastContactId);
  return sorted[(lastIndex + 1) % sorted.length];
}

/**
 * Routes staff WhatsApp alerts (top-up request created, slip uploaded, …)
 * to the dashboard-managed StaffAlertContact list:
 *   - every active 'always' contact receives every alert;
 *   - when scheduled contacts are on duty, exactly ONE receives the alert,
 *     chosen round-robin (rotation persisted in StaffAlertRotation);
 *   - when nobody is on duty, only the 'always' contacts are alerted
 *     (the director is the safety net);
 *   - when the table has no contacts at all, falls back to the legacy
 *     STAFF_ALERT_WHATSAPP env number.
 * Message format is unchanged — routing only decides the recipients.
 */
@Injectable()
export class StaffAlertsService {
  private readonly logger = new Logger(StaffAlertsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly senderService: WhatsAppSenderService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Recipients for one alert: all active 'always' contacts plus, when any
   * scheduled contact is on duty, a single round-robin pick (the rotation
   * is advanced and persisted here).
   */
  async resolveRecipients(now: Date = new Date()): Promise<AlertContact[]> {
    const contacts = await this.prisma.staffAlertContact.findMany({
      where: { active: true },
    });
    const always = contacts.filter((c) => c.mode === 'always');
    const timeZone = this.configService.get<string>(
      'ALERT_TIMEZONE',
      DEFAULT_ALERT_TIMEZONE,
    );
    const onDuty = contacts.filter(
      (c) => c.mode === 'scheduled' && isOnDuty(c, now, timeZone),
    );

    if (!onDuty.length) return always;

    const rotation = await this.prisma.staffAlertRotation.findUnique({
      where: { id: 'singleton' },
    });
    const picked = pickRotated(onDuty, rotation?.lastContactId);
    if (!picked) return always;

    await this.prisma.staffAlertRotation.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', lastContactId: picked.id },
      update: { lastContactId: picked.id },
    });
    return [...always, picked];
  }

  async sendAlert(
    client: { metaAccessToken: string; whatsappPhoneNumberId: string },
    message: string,
  ): Promise<void> {
    const totalContacts = await this.prisma.staffAlertContact.count();

    let phones: string[];
    if (totalContacts === 0) {
      // Backwards-compatible fallback until contacts are configured
      const envNumber = this.configService.get<string>('STAFF_ALERT_WHATSAPP');
      if (!envNumber) return;
      phones = [envNumber];
    } else {
      const recipients = await this.resolveRecipients();
      phones = recipients.map((r) => r.phone);
      if (!phones.length) {
        this.logger.warn('Staff alert contacts exist but none are reachable right now');
        return;
      }
    }

    for (const to of phones) {
      try {
        await this.senderService.sendWithTemplateFallback({
          client,
          to,
          message,
          template: {
            kind: 'general_followup',
            parameters: ['team', 'TheReplyte', message],
          },
        });
      } catch (error) {
        this.logger.error(
          `Failed to send staff alert to ${to}: ${(error as Error).message}`,
        );
      }
    }
  }
}
