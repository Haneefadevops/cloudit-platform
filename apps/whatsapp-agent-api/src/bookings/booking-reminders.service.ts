import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppSenderService } from '../whatsapp-sender/whatsapp-sender.service';
import { formatInTimezone } from './availability.service';

const TICK_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Sends WhatsApp reminders for confirmed bookings starting within each
 * client's `bookingReminderHours` window, then stamps `reminderSentAt` so
 * each booking is reminded exactly once.
 *
 * Uses a plain setInterval instead of @nestjs/schedule: that package could
 * not be installed (npm arborist failure in this monorepo), and an
 * in-process timer keeps the change dependency-free. Swap for
 * @nestjs/schedule later if the install issue is resolved.
 */
@Injectable()
export class BookingRemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingRemindersService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly senderService: WhatsAppSenderService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.tick();
    }, TICK_INTERVAL_MS);
    // Do not keep the process alive just for reminders.
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now: Date = new Date()): Promise<void> {
    if (this.running) return; // overlap guard
    this.running = true;
    try {
      await this.sendDueReminders(now);
    } catch (error) {
      this.logger.error(`Reminder tick failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  /**
   * Confirmed, not-yet-reminded bookings starting within each client's
   * reminder window. Selection logic is separate from sending so it can be
   * unit-tested without WhatsApp.
   */
  async findDueReminders(now: Date) {
    const clients = await this.prisma.client.findMany({
      where: {
        status: 'active',
        bookingsEnabled: true,
        bookingReminderHours: { gt: 0 },
      },
      select: { id: true, bookingReminderHours: true },
    });

    const due: Array<
      Awaited<ReturnType<typeof this.findForClient>>[number]
    > = [];
    for (const client of clients) {
      due.push(...(await this.findForClient(client, now)));
    }
    return due;
  }

  private async findForClient(
    client: { id: string; bookingReminderHours: number | null },
    now: Date,
  ) {
    const until = new Date(
      now.getTime() + (client.bookingReminderHours || 0) * 60 * 60 * 1000,
    );
    return this.prisma.booking.findMany({
      where: {
        clientId: client.id,
        status: 'confirmed',
        reminderSentAt: null,
        startAt: { gt: now, lte: until },
      },
      include: {
        service: true,
        staff: true,
        customer: true,
        client: true,
      },
    });
  }

  async sendDueReminders(now: Date): Promise<number> {
    const due = await this.findDueReminders(now);
    let sent = 0;

    for (const booking of due) {
      const when = formatInTimezone(
        booking.startAt.toISOString(),
        booking.client.timezone,
      );
      const message =
        `Reminder from ${booking.client.name}: your ${booking.service.name}` +
        `${booking.staff ? ` with ${booking.staff.name}` : ''} is on ${when}. ` +
        `Reply R to reschedule or C to cancel.`;

      try {
        await this.senderService.sendMessage({
          client: booking.client,
          to: booking.customer.phoneNumber,
          message,
        });
        await this.prisma.booking.update({
          where: { id: booking.id },
          data: { reminderSentAt: now },
        });
        sent++;
      } catch (error) {
        this.logger.error(
          `Failed to send reminder for booking ${booking.id}: ${(error as Error).message}`,
        );
      }
    }

    if (sent > 0) this.logger.log(`Sent ${sent} booking reminder(s)`);
    return sent;
  }
}
