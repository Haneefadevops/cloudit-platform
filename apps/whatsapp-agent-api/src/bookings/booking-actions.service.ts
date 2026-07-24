import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from './availability.service';

export interface BookingAction {
  type: string;
  [key: string]: any;
}

export interface BookingActionContext {
  client: {
    id: string;
    name: string;
    timezone?: string | null;
    bookingApprovalMode?: string;
  };
  customer: {
    id: string;
    name?: string | null;
    phoneNumber: string;
  };
  action: BookingAction;
}

export interface BookingActionResult {
  /** Authoritative text describing what the backend did — fed back to the AI. */
  summary: string;
  bookingId?: string;
  /** Set when a booking was created/updated and staff should be notified. */
  staffNotification?: string;
  /** True when the booking needs staff confirmation (pending approval). */
  requiresApproval?: boolean;
}

const MAX_SLOTS_IN_SUMMARY = 8;

/**
 * Executes booking actions emitted by the AI. The AI decides WHEN to act;
 * this service owns the truth: availability is re-validated against the
 * database before anything is persisted, and all facts in the result come
 * from code/database, never from the AI.
 */
@Injectable()
export class BookingActionsService {
  private readonly logger = new Logger(BookingActionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
  ) {}

  async execute(ctx: BookingActionContext): Promise<BookingActionResult> {
    const { action } = ctx;
    try {
      switch (action.type) {
        case 'check_availability':
          return await this.checkAvailability(ctx);
        case 'create_booking':
          return await this.createBooking(ctx);
        case 'cancel_booking':
          return await this.cancelBooking(ctx);
        case 'reschedule_booking':
          return await this.rescheduleBooking(ctx);
        default:
          return { summary: `Unknown booking action "${action.type}". Do not retry it; answer the customer without an action.` };
      }
    } catch (error) {
      this.logger.error(
        `Booking action ${action.type} failed: ${(error as Error).message}`,
      );
      return {
        summary: `The booking action "${action.type}" failed with a technical error. Apologize to the customer and offer to try again or connect them with the team.`,
      };
    }
  }

  /**
   * Loads the client's services, staff names, and the customer's upcoming
   * bookings so the AI can act on real data (bookings module only).
   * Shared by the WhatsApp flow and the playground.
   */
  async buildPromptContext(
    client: { id: string; timezone?: string | null },
    customerId: string,
  ) {
    const [services, staffRows, upcoming] = await Promise.all([
      this.prisma.service.findMany({
        where: { clientId: client.id, active: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.staff.findMany({
        where: { clientId: client.id, active: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.booking.findMany({
        where: {
          clientId: client.id,
          customerId,
          status: { in: ['pending', 'confirmed'] },
          startAt: { gt: new Date() },
        },
        include: { service: true, staff: true },
        orderBy: { startAt: 'asc' },
        take: 5,
      }),
    ]);

    const upcomingBookings = upcoming
      .map((b) => `- ${b.service.name}${b.staff ? ` with ${b.staff.name}` : ''} on ${this.formatLocal(b.startAt.toISOString(), client)} (${b.status})`)
      .join('\n');

    return {
      services: services.map((s) => ({
        name: s.name,
        description: s.description,
        durationMinutes: s.durationMinutes,
        price: s.price,
        requiresConfirmation: s.requiresConfirmation,
        intakeQuestions: s.intakeQuestions,
      })),
      staff: staffRows.map((s) => s.name),
      upcomingBookings: upcomingBookings || undefined,
    };
  }

  // ---- check_availability ----

  private async checkAvailability(
    ctx: BookingActionContext,
  ): Promise<BookingActionResult> {
    const { client, action } = ctx;
    const service = await this.resolveService(client.id, action.service);
    if (!service) {
      return {
        summary: `No active service matching "${action.service ?? ''}" exists. Tell the customer which services are actually available instead of inventing one.`,
      };
    }
    const staff = action.staff
      ? await this.resolveStaff(client.id, action.staff)
      : null;
    const date = this.normalizeDate(action.date) || this.todayIn(client);
    const slots = await this.availability.getAvailableSlots(
      client.id,
      service.id,
      date,
      staff?.id,
    );

    if (slots.length === 0) {
      return {
        summary: `No available slots for "${service.name}" on ${date}${staff ? ` with ${staff.name}` : ''}. Suggest the customer a different date or staff member, but call check_availability again before naming new times.`,
      };
    }

    const listed = slots
      .slice(0, MAX_SLOTS_IN_SUMMARY)
      .map(
        (s) =>
          `${this.formatLocal(s.startAt, client)}${s.staffName ? ` with ${s.staffName}` : ''}`,
      )
      .join('; ');
    const more =
      slots.length > MAX_SLOTS_IN_SUMMARY
        ? ` (and ${slots.length - MAX_SLOTS_IN_SUMMARY} more later that day)`
        : '';
    return {
      summary: `Available slots for "${service.name}" (${service.durationMinutes} min) on ${date}: ${listed}${more}. Offer these exact times to the customer; do not invent others.`,
    };
  }

  // ---- create_booking ----

  private async createBooking(
    ctx: BookingActionContext,
  ): Promise<BookingActionResult> {
    const { client, customer, action } = ctx;
    const service = await this.resolveService(client.id, action.service);
    if (!service) {
      return {
        summary: `No active service matching "${action.service ?? ''}" exists. The booking was NOT created.`,
      };
    }
    const date = this.normalizeDate(action.date);
    const time = this.normalizeTime(action.time);
    if (!date || !time) {
      return {
        summary: `The booking was NOT created: a date (YYYY-MM-DD) and time (HH:mm) are required. Ask the customer for the missing information.`,
      };
    }

    // Backend owns the truth: re-validate that the requested start time is a
    // real available slot before persisting anything.
    const requestedStart = this.availability.localToUtc(
      `${date}T${time}:00`,
      client.timezone || 'UTC',
    );
    const requestedStaff = action.staff
      ? await this.resolveStaff(client.id, action.staff)
      : null;
    const slots = await this.availability.getAvailableSlots(
      client.id,
      service.id,
      date,
      requestedStaff?.id,
    );
    const slot = slots.find(
      (s) =>
        new Date(s.startAt).getTime() === requestedStart.getTime() &&
        (!requestedStaff || s.staffId === requestedStaff.id),
    );
    if (!slot) {
      const alternatives = slots
        .slice(0, MAX_SLOTS_IN_SUMMARY)
        .map(
          (s) =>
            `${this.formatLocal(s.startAt, client)}${s.staffName ? ` with ${s.staffName}` : ''}`,
        )
        .join('; ');
      return {
        summary: `The requested time ${this.formatLocal(requestedStart.toISOString(), client)} is NOT available for "${service.name}". The booking was NOT created.${alternatives ? ` Actually available: ${alternatives}.` : ' No slots remain that day.'} Offer these alternatives.`,
      };
    }

    const requiresApproval =
      (client.bookingApprovalMode || 'approval') !== 'auto' ||
      service.requiresConfirmation;
    const status = requiresApproval ? 'pending' : 'confirmed';

    const booking = await this.prisma.booking.create({
      data: {
        clientId: client.id,
        customerId: customer.id,
        serviceId: service.id,
        staffId: slot.staffId,
        startAt: new Date(slot.startAt),
        endAt: new Date(slot.endAt),
        status,
        intakeAnswers:
          action.intakeAnswers && typeof action.intakeAnswers === 'object'
            ? action.intakeAnswers
            : {},
        notes: action.notes ? String(action.notes) : null,
      },
    });

    const when = this.formatLocal(booking.startAt.toISOString(), client);
    const withStaff = slot.staffName ? ` with ${slot.staffName}` : '';
    const intake = this.formatIntakeAnswers(booking.intakeAnswers);
    const staffNotification = [
      `New booking (${status}):`,
      `- Service: ${service.name} (${service.durationMinutes} min)`,
      `- When: ${when}${withStaff}`,
      `- Customer: ${customer.name || 'Unknown'} (${customer.phoneNumber})`,
      intake ? `- Intake answers: ${intake}` : null,
      booking.notes ? `- Notes: ${booking.notes}` : null,
      requiresApproval
        ? '- Action needed: confirm or decline this booking (pending approval).'
        : null,
      `- Booking ID: ${booking.id}`,
    ]
      .filter(Boolean)
      .join('\n');

    return {
      summary: requiresApproval
        ? `Booking created as PENDING staff confirmation: "${service.name}"${withStaff} on ${when}. Tell the customer the request is received and a team member will confirm shortly — do NOT say it is confirmed.`
        : `Booking CONFIRMED: "${service.name}"${withStaff} on ${when}. Confirm the details to the customer.`,
      bookingId: booking.id,
      requiresApproval,
      staffNotification,
    };
  }

  // ---- cancel_booking ----

  private async cancelBooking(
    ctx: BookingActionContext,
  ): Promise<BookingActionResult> {
    const target = await this.findTargetBooking(ctx);
    if (!target) {
      return {
        summary: `No upcoming booking was found for this customer${ctx.action.service ? ` matching "${ctx.action.service}"` : ''}. Nothing was cancelled.`,
      };
    }

    const booking = await this.prisma.booking.update({
      where: { id: target.id },
      data: { status: 'cancelled' },
      include: { service: true, staff: true },
    });

    const when = this.formatLocal(booking.startAt.toISOString(), ctx.client);
    return {
      summary: `Booking CANCELLED: "${booking.service.name}"${booking.staff ? ` with ${booking.staff.name}` : ''} on ${when}. Confirm the cancellation to the customer.`,
      bookingId: booking.id,
      staffNotification: `Booking cancelled by customer: ${booking.service.name} on ${when} (${ctx.customer.name || 'Unknown'}, ${ctx.customer.phoneNumber}). Booking ID: ${booking.id}`,
    };
  }

  // ---- reschedule_booking ----

  private async rescheduleBooking(
    ctx: BookingActionContext,
  ): Promise<BookingActionResult> {
    const { client, action } = ctx;
    const target = await this.findTargetBooking(ctx);
    if (!target) {
      return {
        summary: `No upcoming booking was found for this customer${action.service ? ` matching "${action.service}"` : ''}. Nothing was changed.`,
      };
    }
    const date = this.normalizeDate(action.date);
    const time = this.normalizeTime(action.time);
    if (!date || !time) {
      return {
        summary: `The booking was NOT rescheduled: a new date (YYYY-MM-DD) and time (HH:mm) are required. Ask the customer for the missing information.`,
      };
    }

    const requestedStart = this.availability.localToUtc(
      `${date}T${time}:00`,
      client.timezone || 'UTC',
    );
    const slots = await this.availability.getAvailableSlots(
      client.id,
      target.serviceId,
      date,
      target.staffId || undefined,
      target.id, // the booking being moved must not block its own new slot
    );
    const slot = slots.find(
      (s) => new Date(s.startAt).getTime() === requestedStart.getTime(),
    );
    if (!slot) {
      const alternatives = slots
        .slice(0, MAX_SLOTS_IN_SUMMARY)
        .map((s) => this.formatLocal(s.startAt, client))
        .join('; ');
      return {
        summary: `The requested new time ${this.formatLocal(requestedStart.toISOString(), client)} is NOT available. The booking was NOT changed.${alternatives ? ` Actually available: ${alternatives}.` : ''} Offer these alternatives.`,
      };
    }

    const booking = await this.prisma.booking.update({
      where: { id: target.id },
      data: { startAt: new Date(slot.startAt), endAt: new Date(slot.endAt) },
      include: { service: true, staff: true },
    });

    const when = this.formatLocal(booking.startAt.toISOString(), client);
    return {
      summary: `Booking RESCHEDULED: "${booking.service.name}"${booking.staff ? ` with ${booking.staff.name}` : ''} is now on ${when} (status: ${booking.status}). Confirm the new time to the customer.`,
      bookingId: booking.id,
      staffNotification: `Booking rescheduled by customer: ${booking.service.name} moved to ${when} (${ctx.customer.name || 'Unknown'}, ${ctx.customer.phoneNumber}). Booking ID: ${booking.id}`,
    };
  }

  // ---- helpers ----

  /** The customer's upcoming booking to cancel/reschedule. */
  private async findTargetBooking(ctx: BookingActionContext) {
    const { client, customer, action } = ctx;
    if (action.bookingId) {
      return this.prisma.booking.findFirst({
        where: {
          id: String(action.bookingId),
          clientId: client.id,
          customerId: customer.id,
          status: { in: ['pending', 'confirmed'] },
        },
      });
    }
    let serviceId: string | undefined;
    if (action.service) {
      const service = await this.resolveService(client.id, action.service);
      serviceId = service?.id;
    }
    return this.prisma.booking.findFirst({
      where: {
        clientId: client.id,
        customerId: customer.id,
        status: { in: ['pending', 'confirmed'] },
        startAt: { gt: new Date() },
        ...(serviceId ? { serviceId } : {}),
      },
      orderBy: { startAt: 'asc' },
    });
  }

  private async resolveService(clientId: string, ref: unknown) {
    if (!ref || typeof ref !== 'string') return null;
    return this.prisma.service.findFirst({
      where: {
        clientId,
        active: true,
        OR: [{ id: ref }, { name: { equals: ref, mode: 'insensitive' } }],
      },
    });
  }

  private async resolveStaff(clientId: string, ref: unknown) {
    if (!ref || typeof ref !== 'string') return null;
    return this.prisma.staff.findFirst({
      where: {
        clientId,
        active: true,
        OR: [{ id: ref }, { name: { equals: ref, mode: 'insensitive' } }],
      },
    });
  }

  /** Accepts YYYY-MM-DD; returns null for anything else. */
  private normalizeDate(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const [, y, m, d] = match;
    const date = new Date(`${y}-${m}-${d}T12:00:00Z`);
    return isNaN(date.getTime()) ? null : `${y}-${m}-${d}`;
  }

  /** Accepts "19:30", "7:30pm", "19:30:00"; returns HH:mm (24h) or null. */
  private normalizeTime(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const match = value
      .trim()
      .toLowerCase()
      .match(/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?\s*(am|pm)?$/);
    if (!match) return null;
    let hours = Number(match[1]);
    const minutes = Number(match[2] ?? '0');
    const meridiem = match[3];
    if (meridiem === 'pm' && hours < 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    if (hours > 23 || minutes > 59) return null;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  private todayIn(client: { timezone?: string | null }): string {
    try {
      return new Date().toLocaleDateString('en-CA', {
        timeZone: client.timezone || 'UTC',
      });
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }

  private formatLocal(
    iso: string,
    client: { timezone?: string | null },
  ): string {
    try {
      return new Date(iso).toLocaleString('en-US', {
        timeZone: client.timezone || 'UTC',
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

  private formatIntakeAnswers(answers: unknown): string | null {
    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return null;
    }
    const parts = Object.entries(answers as Record<string, unknown>).map(
      ([q, a]) => `${q} → ${String(a)}`,
    );
    return parts.length ? parts.join('; ') : null;
  }
}
