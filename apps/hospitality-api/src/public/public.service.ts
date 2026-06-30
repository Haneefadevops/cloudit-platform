import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "crypto";
import {
  PaymentStatus,
  ReservationSource,
  ReservationStatus,
  RoomStatus,
} from "@prisma/client-hospitality";
import { EventPublisherService } from "../events/event-publisher.service";
import { EventTypes } from "../events/event-types";
import { PrismaService } from "../prisma/prisma.service";
import { PublicAvailabilityDto } from "./dto/availability.dto";
import { CreatePublicBookingDto } from "./dto/create-public-booking.dto";

@Injectable()
export class PublicService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async availability(dto: PublicAvailabilityDto) {
    const property = await this.prisma.property.findFirst({
      where: { publicSlug: dto.propertySlug },
      include: {
        roomTypes: {
          include: {
            rooms: {
              select: { id: true, status: true },
            },
            seasonalRates: {
              where: { isActive: true },
              orderBy: { startDate: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    const hasDates = !!dto.checkInDate && !!dto.checkOutDate;
    const checkIn = dto.checkInDate ? new Date(dto.checkInDate) : undefined;
    const checkOut = dto.checkOutDate ? new Date(dto.checkOutDate) : undefined;

    if ((dto.checkInDate || dto.checkOutDate) && (!checkIn || !checkOut)) {
      throw new BadRequestException("Check-in and check-out dates are required");
    }
    if (checkIn && checkOut && checkIn >= checkOut) {
      throw new BadRequestException("Check-out date must be after check-in");
    }

    const occupiedRoomIds = hasDates
      ? await this.findOccupiedRoomIds(property.id, checkIn!, checkOut!)
      : new Set<string>();

    return {
      property: {
        id: property.id,
        name: property.name,
        publicSlug: property.publicSlug,
        address: property.address,
        phone: property.phone,
        email: property.email,
        settings: property.settings,
      },
      search: {
        checkInDate: dto.checkInDate,
        checkOutDate: dto.checkOutDate,
      },
      roomTypes: property.roomTypes.map((roomType) => {
        const availableRooms = roomType.rooms.filter(
          (room) =>
            room.status === RoomStatus.available && !occupiedRoomIds.has(room.id),
        ).length;

        return {
          id: roomType.id,
          name: roomType.name,
          description: roomType.description,
          basePrice: Number(roomType.basePrice),
          maxOccupancy: roomType.maxOccupancy,
          amenities: roomType.amenities,
          availableRooms: hasDates ? availableRooms : undefined,
          totalRooms: roomType.rooms.length,
          seasonalRates: roomType.seasonalRates.map((rate) => ({
            name: rate.name,
            startDate: rate.startDate,
            endDate: rate.endDate,
            price: Number(rate.price),
            minimumStay: rate.minimumStay,
          })),
        };
      }),
    };
  }

  async createBooking(dto: CreatePublicBookingDto) {
    const checkIn = new Date(dto.checkInDate);
    const checkOut = new Date(dto.checkOutDate);
    if (checkIn >= checkOut) {
      throw new BadRequestException("Check-out date must be after check-in");
    }

    const property = await this.prisma.property.findFirst({
      where: { publicSlug: dto.propertySlug },
    });
    if (!property) {
      throw new NotFoundException("Property not found");
    }

    const roomType = await this.prisma.roomType.findFirst({
      where: { id: dto.roomTypeId, propertyId: property.id },
      include: {
        seasonalRates: {
          where: {
            organizationId: property.organizationId,
            isActive: true,
            startDate: { lt: checkOut },
            endDate: { gte: checkIn },
          },
          orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
        },
      },
    });
    if (!roomType) {
      throw new BadRequestException("Room type not found");
    }

    const occupiedRoomIds = await this.findOccupiedRoomIds(
      property.id,
      checkIn,
      checkOut,
    );
    const room = await this.prisma.room.findFirst({
      where: {
        propertyId: property.id,
        roomTypeId: roomType.id,
        status: RoomStatus.available,
        id: { notIn: [...occupiedRoomIds] },
      },
      orderBy: { roomNumber: "asc" },
    });
    if (!room) {
      throw new BadRequestException("No rooms available for selected dates");
    }

    const totalAmount = this.calculateStayTotal(
      checkIn,
      checkOut,
      Number(roomType.basePrice),
      roomType.seasonalRates,
    );
    const reservationNumber = await this.generateReservationNumber();
    const token = this.generateToken();
    const expiresAt = new Date(checkOut);
    expiresAt.setDate(expiresAt.getDate() + 1);

    const result = await this.prisma.$transaction(async (tx) => {
      const guest = await tx.guest.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          localPhone: dto.phone,
          nicNumber: dto.nicNumber,
          passportNumber: dto.passportNumber,
          organizationId: property.organizationId,
        },
      });

      const reservation = await tx.reservation.create({
        data: {
          reservationNumber,
          property: { connect: { id: property.id } },
          room: { connect: { id: room.id } },
          guest: { connect: { id: guest.id } },
          checkInDate: checkIn,
          checkOutDate: checkOut,
          adults: dto.adults ?? 1,
          children: dto.children ?? 0,
          status: ReservationStatus.confirmed,
          totalAmount,
          paidAmount: 0,
          paymentStatus: PaymentStatus.pending,
          source: ReservationSource.direct,
          notes: `Public booking. Preferred payment: ${dto.paymentMethod}`,
          createdBy: "public",
        },
      });

      const session = await tx.guestCheckInSession.create({
        data: {
          token,
          expiresAt,
          organizationId: property.organizationId,
          reservation: { connect: { id: reservation.id } },
        },
      });

      return { guest, reservation, session };
    });

    const guestPortalUrl = `/guest/${result.session.token}`;
    void this.eventPublisher.publish(EventTypes.BOOKING_CREATED, {
      reservationId: result.reservation.id,
      reservationNumber: result.reservation.reservationNumber,
      propertyId: property.id,
      roomId: room.id,
      guestId: result.guest.id,
      checkInDate: result.reservation.checkInDate.toISOString(),
      checkOutDate: result.reservation.checkOutDate.toISOString(),
      totalAmount: Number(result.reservation.totalAmount),
      source: result.reservation.source,
      guestPortalUrl,
      guestEmail: result.guest.email ?? undefined,
      guestPhone: result.guest.phone ?? undefined,
      paymentMethod: dto.paymentMethod,
      organizationId: property.organizationId,
    });

    return {
      reservation: {
        id: result.reservation.id,
        reservationNumber: result.reservation.reservationNumber,
        checkInDate: result.reservation.checkInDate,
        checkOutDate: result.reservation.checkOutDate,
        totalAmount: Number(result.reservation.totalAmount),
        status: result.reservation.status,
      },
      guest: {
        firstName: result.guest.firstName,
        lastName: result.guest.lastName,
        email: result.guest.email,
        phone: result.guest.phone,
      },
      property: {
        name: property.name,
        publicSlug: property.publicSlug,
        email: property.email,
        phone: property.phone,
      },
      guestPortalUrl,
      selfCheckInUrl: `/guest/check-in/${result.session.token}`,
      paymentMethod: dto.paymentMethod,
    };
  }

  async getBooking(token: string) {
    const session = await this.prisma.guestCheckInSession.findUnique({
      where: { token },
      include: {
        reservation: {
          include: {
            guest: true,
            property: true,
            room: { include: { roomType: true } },
            invoices: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: { payments: true },
            },
            payments: true,
          },
        },
      },
    });

    if (!session || session.expiresAt <= new Date()) {
      throw new NotFoundException("Booking link not found or expired");
    }

    const reservation = session.reservation;
    const latestInvoice = reservation.invoices[0];
    const paidAmount =
      latestInvoice?.payments
        ?.filter((payment) => payment.providerStatus === "succeeded")
        .reduce((sum, payment) => sum + Number(payment.amount), 0) ??
      Number(reservation.paidAmount);
    const totalAmount = latestInvoice
      ? Number(latestInvoice.totalAmount)
      : Number(reservation.totalAmount);

    return {
      token: session.token,
      expiresAt: session.expiresAt,
      submittedAt: session.submittedAt,
      links: {
        selfCheckIn: `/guest/check-in/${session.token}`,
        selfCheckOut: `/guest/${session.token}/checkout`,
      },
      reservation: {
        id: reservation.id,
        reservationNumber: reservation.reservationNumber,
        checkInDate: reservation.checkInDate,
        checkOutDate: reservation.checkOutDate,
        status: reservation.status,
        adults: reservation.adults,
        children: reservation.children,
        totalAmount,
        paidAmount,
        balance: Math.max(totalAmount - paidAmount, 0),
      },
      property: {
        name: reservation.property.name,
        address: reservation.property.address,
        phone: reservation.property.phone,
        email: reservation.property.email,
        publicSlug: reservation.property.publicSlug,
      },
      room: {
        roomNumber: reservation.room.roomNumber,
        roomType: reservation.room.roomType.name,
        maxOccupancy: reservation.room.roomType.maxOccupancy,
      },
      guest: {
        firstName: reservation.guest.firstName,
        lastName: reservation.guest.lastName,
        email: reservation.guest.email,
        phone: reservation.guest.phone,
        localPhone: reservation.guest.localPhone,
      },
      invoice: latestInvoice
        ? {
            id: latestInvoice.id,
            invoiceNumber: latestInvoice.invoiceNumber,
            totalAmount: Number(latestInvoice.totalAmount),
            paidAmount: Number(latestInvoice.paidAmount),
            status: latestInvoice.status,
          }
        : null,
    };
  }

  private async findOccupiedRoomIds(propertyId: string, checkIn: Date, checkOut: Date) {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        status: { not: ReservationStatus.cancelled },
        checkInDate: { lt: checkOut },
        checkOutDate: { gt: checkIn },
      },
      select: { roomId: true },
    });

    return new Set(reservations.map((reservation) => reservation.roomId));
  }

  private calculateStayTotal(
    checkIn: Date,
    checkOut: Date,
    basePrice: number,
    seasonalRates: { name: string; startDate: Date; endDate: Date; price: any; minimumStay: number }[],
  ) {
    const nights = Math.max(
      1,
      Math.ceil(
        (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );
    let total = 0;

    for (let offset = 0; offset < nights; offset++) {
      const date = new Date(checkIn);
      date.setDate(checkIn.getDate() + offset);
      const seasonalRate = seasonalRates.find((rate) => {
        const start = new Date(rate.startDate);
        const end = new Date(rate.endDate);
        end.setHours(23, 59, 59, 999);
        return date >= start && date <= end && nights >= rate.minimumStay;
      });
      total += Number(seasonalRate?.price ?? basePrice);
    }

    return Number(total.toFixed(2));
  }

  private async generateReservationNumber() {
    const today = new Date();
    const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");
    const count = await this.prisma.reservation.count({
      where: {
        reservationNumber: { startsWith: `RES-${datePart}` },
      },
    });
    return `RES-${datePart}-${(count + 1).toString().padStart(4, "0")}`;
  }

  private generateToken() {
    return randomBytes(24).toString("hex");
  }
}
