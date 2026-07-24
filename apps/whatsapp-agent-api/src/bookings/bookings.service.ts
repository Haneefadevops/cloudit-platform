import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppSenderService } from '../whatsapp-sender/whatsapp-sender.service';
import { formatInTimezone } from './availability.service';

export const BOOKING_STATUSES = [
  'pending',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
];

export interface ServiceInput {
  name?: string;
  description?: string;
  durationMinutes?: number;
  price?: number;
  requiresConfirmation?: boolean;
  intakeQuestions?: string[];
  active?: boolean;
}

export interface StaffInput {
  name?: string;
  weeklyHours?: Record<string, { start: string; end: string }>;
  daysOff?: string[];
  active?: boolean;
}

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly senderService: WhatsAppSenderService,
  ) {}

  // ---- Bookings (dashboard management) ----

  findBookings(
    clientId: string,
    filters: { status?: string; from?: string; to?: string } = {},
  ) {
    const startAt: { gte?: Date; lte?: Date } = {};
    if (filters.from && !isNaN(Date.parse(filters.from))) {
      startAt.gte = new Date(filters.from);
    }
    if (filters.to && !isNaN(Date.parse(filters.to))) {
      startAt.lte = new Date(filters.to);
    }
    return this.prisma.booking.findMany({
      where: {
        clientId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(startAt.gte || startAt.lte ? { startAt } : {}),
      },
      include: { service: true, staff: true, customer: true },
      orderBy: { startAt: 'desc' },
      take: 200,
    });
  }

  async updateBookingStatus(clientId: string, id: string, status: string) {
    if (!BOOKING_STATUSES.includes(status)) {
      throw new BadRequestException(
        `Invalid status "${status}". Allowed: ${BOOKING_STATUSES.join(', ')}`,
      );
    }
    const booking = await this.prisma.booking.update({
      where: { id, clientId },
      data: { status },
      include: { service: true, staff: true, customer: true, client: true },
    });
    await this.notifyCustomerOnStatusChange(booking);
    return booking;
  }

  /**
   * Optional per-status customer notification: messages the customer on
   * WhatsApp when staff confirms or cancels a booking from the dashboard.
   * Other statuses stay silent. Best-effort — failures are logged, not thrown.
   */
  private async notifyCustomerOnStatusChange(booking: {
    status: string;
    startAt: Date;
    service: { name: string };
    staff: { name: string } | null;
    customer: { name: string | null; phoneNumber: string };
    client: {
      name: string;
      timezone: string | null;
      metaAccessToken: string;
      whatsappPhoneNumberId: string;
      bookingConfirmationTemplate: string | null;
    };
  }) {
    if (!['confirmed', 'cancelled'].includes(booking.status)) return;

    const { client } = booking;
    const when = formatInTimezone(
      booking.startAt.toISOString(),
      client.timezone,
    );
    const withStaff = booking.staff ? ` with ${booking.staff.name}` : '';

    let message: string;
    if (booking.status === 'confirmed') {
      if (client.bookingConfirmationTemplate) {
        message = client.bookingConfirmationTemplate
          .replaceAll('{{customer_name}}', booking.customer.name || '')
          .replaceAll('{{business_name}}', client.name)
          .replaceAll('{{service_name}}', booking.service.name)
          .replaceAll('{{when}}', when);
      } else {
        message =
          `Good news${booking.customer.name ? `, ${booking.customer.name}` : ''} — ` +
          `your ${booking.service.name}${withStaff} on ${when} is confirmed. ` +
          `See you then! — ${client.name}`;
      }
    } else {
      message =
        `Your ${booking.service.name}${withStaff} booking on ${when} has been cancelled. ` +
        `Message us anytime to rebook. — ${client.name}`;
    }

    try {
      await this.senderService.sendMessage({
        client,
        to: booking.customer.phoneNumber,
        message,
      });
    } catch (error) {
      this.logger.error(
        `Failed to notify customer for booking status change: ${(error as Error).message}`,
      );
    }
  }

  // ---- Services ----

  findServices(clientId: string) {
    return this.prisma.service.findMany({
      where: { clientId },
      orderBy: { name: 'asc' },
    });
  }

  createService(clientId: string, data: ServiceInput) {
    return this.prisma.service.create({
      data: {
        clientId,
        name: data.name || '',
        description: data.description,
        durationMinutes: data.durationMinutes ?? 60,
        price: data.price,
        requiresConfirmation: data.requiresConfirmation ?? false,
        intakeQuestions: data.intakeQuestions ?? [],
        active: data.active ?? true,
      },
    });
  }

  updateService(clientId: string, id: string, data: ServiceInput) {
    return this.prisma.service.update({
      where: { id, clientId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.durationMinutes !== undefined
          ? { durationMinutes: data.durationMinutes }
          : {}),
        ...(data.price !== undefined ? { price: data.price } : {}),
        ...(data.requiresConfirmation !== undefined
          ? { requiresConfirmation: data.requiresConfirmation }
          : {}),
        ...(data.intakeQuestions !== undefined
          ? { intakeQuestions: data.intakeQuestions }
          : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });
  }

  removeService(clientId: string, id: string) {
    return this.prisma.service.delete({ where: { id, clientId } });
  }

  // ---- Staff ----

  findStaff(clientId: string) {
    return this.prisma.staff.findMany({
      where: { clientId },
      orderBy: { name: 'asc' },
    });
  }

  createStaff(clientId: string, data: StaffInput) {
    return this.prisma.staff.create({
      data: {
        clientId,
        name: data.name || '',
        weeklyHours: data.weeklyHours ?? {},
        daysOff: data.daysOff ?? [],
        active: data.active ?? true,
      },
    });
  }

  updateStaff(clientId: string, id: string, data: StaffInput) {
    return this.prisma.staff.update({
      where: { id, clientId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.weeklyHours !== undefined
          ? { weeklyHours: data.weeklyHours }
          : {}),
        ...(data.daysOff !== undefined ? { daysOff: data.daysOff } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });
  }

  removeStaff(clientId: string, id: string) {
    return this.prisma.staff.delete({ where: { id, clientId } });
  }
}
