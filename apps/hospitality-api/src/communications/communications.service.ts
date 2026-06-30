import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OnEvent } from "@nestjs/event-emitter";
import axios, { AxiosError } from "axios";
import * as crypto from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { EventTypes } from "../events/event-types";

type CommunicationChannel = "email" | "sms" | "whatsapp";

interface WrappedEvent<T> {
  event: string;
  timestamp: string;
  data: T;
}

interface DeliveryPayload {
  channel: CommunicationChannel;
  template: string;
  to: string;
  subject?: string;
  body: string;
  data: Record<string, unknown>;
}

@Injectable()
export class CommunicationsService {
  private readonly logger = new Logger(CommunicationsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent(EventTypes.BOOKING_CREATED)
  async handleBookingCreated(event: WrappedEvent<{ reservationId: string }>) {
    const reservation = await this.getReservation(event.data.reservationId);
    if (!reservation) return;

    const guestName = `${reservation.guest.firstName} ${reservation.guest.lastName}`;
    const stayDates = `${this.formatDate(reservation.checkInDate)} to ${this.formatDate(
      reservation.checkOutDate,
    )}`;

    if (reservation.guest.email) {
      await this.deliver("booking_confirmation_email", {
        channel: "email",
        template: "booking_confirmation",
        to: reservation.guest.email,
        subject: `Booking confirmation ${reservation.reservationNumber}`,
        body: `Dear ${guestName}, your booking at ${reservation.property.name} is confirmed for ${stayDates}.`,
        data: this.reservationData(reservation),
      });
    }

    const phone = reservation.guest.localPhone || reservation.guest.phone;
    if (phone) {
      await this.deliver("booking_confirmation_sms", {
        channel: "sms",
        template: "booking_confirmation",
        to: phone,
        body: `Booking ${reservation.reservationNumber} confirmed at ${reservation.property.name} for ${stayDates}.`,
        data: this.reservationData(reservation),
      });
    }
  }

  @OnEvent(EventTypes.INVOICE_GENERATED)
  async handleInvoiceGenerated(event: WrappedEvent<{ invoiceId: string }>) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: event.data.invoiceId },
      include: {
        guest: true,
        property: true,
        reservation: true,
      },
    });
    if (!invoice?.guest.email) return;

    await this.deliver("invoice_email", {
      channel: "email",
      template: "invoice",
      to: invoice.guest.email,
      subject: `Invoice ${invoice.invoiceNumber}`,
      body: `Your invoice ${invoice.invoiceNumber} from ${invoice.property.name} is ready. Total: Rs. ${Number(
        invoice.totalAmount,
      ).toLocaleString("en-LK", { minimumFractionDigits: 2 })}.`,
      data: {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        reservationId: invoice.reservationId,
        guestId: invoice.guestId,
        propertyId: invoice.propertyId,
        totalAmount: Number(invoice.totalAmount),
      },
    });
  }

  @OnEvent(EventTypes.BOOKING_CHECKED_OUT)
  async handleBookingCheckedOut(event: WrappedEvent<{ reservationId: string }>) {
    const reservation = await this.getReservation(event.data.reservationId);
    if (!reservation) return;

    const phone = reservation.guest.localPhone || reservation.guest.phone;
    if (!phone) return;

    await this.deliver("checkout_whatsapp", {
      channel: "whatsapp",
      template: "checkout_summary",
      to: phone,
      body: `Thank you for staying at ${reservation.property.name}. Checkout complete for booking ${reservation.reservationNumber}.`,
      data: this.reservationData(reservation),
    });
  }

  async sendDailySummaryEmail(organizationId: string) {
    const ownerEmail = this.configService.get<string>("COMMUNICATION_OWNER_EMAIL");
    const today = new Date();
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    const [checkIns, checkOuts, invoices] = await Promise.all([
      this.prisma.reservation.count({
        where: {
          property: { organizationId },
          checkInDate: { gte: start, lt: end },
        },
      }),
      this.prisma.reservation.count({
        where: {
          property: { organizationId },
          checkOutDate: { gte: start, lt: end },
        },
      }),
      this.prisma.invoice.aggregate({
        where: {
          property: { organizationId },
          issueDate: { gte: start, lt: end },
          status: { not: "cancelled" },
        },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
    ]);

    const summary = {
      date: start.toISOString().split("T")[0],
      checkIns,
      checkOuts,
      invoiceCount: invoices._count.id,
      revenue: Number(invoices._sum.totalAmount ?? 0),
      organizationId,
    };

    if (!ownerEmail) {
      this.logger.warn("COMMUNICATION_OWNER_EMAIL is not configured");
      return { delivered: false, reason: "owner_email_not_configured", summary };
    }

    await this.deliver("daily_summary_email", {
      channel: "email",
      template: "daily_summary",
      to: ownerEmail,
      subject: `Hospitality daily summary - ${summary.date}`,
      body: `Today: ${checkIns} check-ins, ${checkOuts} check-outs, ${summary.invoiceCount} invoices, Rs. ${summary.revenue.toLocaleString(
        "en-LK",
        { minimumFractionDigits: 2 },
      )} revenue.`,
      data: summary,
    });

    return { delivered: true, summary };
  }

  private async getReservation(id: string) {
    return this.prisma.reservation.findFirst({
      where: { id },
      include: {
        guest: true,
        property: true,
        room: { include: { roomType: true } },
      },
    });
  }

  private reservationData(reservation: Awaited<ReturnType<typeof this.getReservation>>) {
    if (!reservation) return {};
    return {
      reservationId: reservation.id,
      reservationNumber: reservation.reservationNumber,
      propertyId: reservation.propertyId,
      propertyName: reservation.property.name,
      roomId: reservation.roomId,
      roomNumber: reservation.room.roomNumber,
      roomType: reservation.room.roomType.name,
      guestId: reservation.guestId,
      guestName: `${reservation.guest.firstName} ${reservation.guest.lastName}`,
      checkInDate: reservation.checkInDate.toISOString(),
      checkOutDate: reservation.checkOutDate.toISOString(),
      totalAmount: Number(reservation.totalAmount),
    };
  }

  private async deliver(eventName: string, payload: DeliveryPayload) {
    const url = this.getChannelUrl(payload.channel);
    const eventType = `communication.${payload.channel}.${eventName}`;

    const eventLog = await this.prisma.eventLog.create({
      data: {
        eventType,
        payload: payload as any,
        status: "pending",
        webhookUrl: url,
      },
    });

    if (!url) {
      await this.prisma.eventLog.update({
        where: { id: eventLog.id },
        data: {
          status: "success",
          errorMessage: `${payload.channel} webhook not configured`,
        },
      });
      this.logger.log(`Skipped ${eventType}; webhook not configured`);
      return;
    }

    try {
      const body = {
        event: eventType,
        timestamp: new Date().toISOString(),
        ...payload,
      };
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-CloudIT-Communication": payload.channel,
      };
      const secret = this.configService.get<string>("COMMUNICATION_WEBHOOK_SECRET");
      if (secret) {
        headers["X-CloudIT-Signature"] = this.signPayload(body, secret);
      }

      const response = await axios.post(url, body, { headers, timeout: 10000 });
      await this.prisma.eventLog.update({
        where: { id: eventLog.id },
        data: { status: "success", responseStatus: response.status },
      });
    } catch (error) {
      const axiosError = error as AxiosError;
      await this.prisma.eventLog.update({
        where: { id: eventLog.id },
        data: {
          status: "failed",
          responseStatus: axiosError.response?.status,
          errorMessage: axiosError.message,
        },
      });
      this.logger.error(`Failed to deliver ${eventType}: ${axiosError.message}`);
    }
  }

  private getChannelUrl(channel: CommunicationChannel): string | undefined {
    const keyByChannel: Record<CommunicationChannel, string> = {
      email: "COMMUNICATION_EMAIL_WEBHOOK_URL",
      sms: "COMMUNICATION_SMS_WEBHOOK_URL",
      whatsapp: "COMMUNICATION_WHATSAPP_WEBHOOK_URL",
    };
    return this.configService.get<string>(keyByChannel[channel]);
  }

  private signPayload(payload: unknown, secret: string): string {
    return crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(payload))
      .digest("hex");
  }

  private formatDate(date: Date) {
    return new Intl.DateTimeFormat("en-LK", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(date);
  }
}
