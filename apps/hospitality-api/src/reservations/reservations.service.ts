import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { InvoicesService } from "../invoices/invoices.service";
import { EventPublisherService } from "../events/event-publisher.service";
import { EventTypes } from "../events/event-types";
import { CreateReservationDto } from "./dto/create-reservation.dto";
import { UpdateReservationDto } from "./dto/update-reservation.dto";
import {
  HousekeepingTaskType,
  HousekeepingTaskStatus,
  ReservationStatus,
  RoomStatus,
  PaymentStatus,
} from "@prisma/client-hospitality";

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
    private readonly eventPublisher: EventPublisherService,
  ) {}

  async findAll(
    organizationId: string,
    page: number,
    limit: number,
    filters?: {
      propertyId?: string;
      status?: string;
      guestId?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const skip = (page - 1) * limit;
    const where: any = {
      property: { organizationId },
    };

    if (filters?.propertyId) {
      where.propertyId = filters.propertyId;
    }
    if (filters?.status) {
      where.status = filters.status as ReservationStatus;
    }
    if (filters?.guestId) {
      where.guestId = filters.guestId;
    }
    if (filters?.startDate || filters?.endDate) {
      where.checkInDate = {};
      if (filters.startDate) {
        where.checkInDate.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.checkInDate.lte = new Date(filters.endDate);
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.reservation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          guest: true,
          room: { include: { roomType: true } },
          property: true,
        },
      }),
      this.prisma.reservation.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, organizationId: string) {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id, property: { organizationId } },
      include: {
        guest: true,
        room: { include: { roomType: true } },
        property: true,
        invoices: true,
      },
    });

    if (!reservation) {
      throw new NotFoundException("Reservation not found");
    }

    return reservation;
  }

  async create(
    organizationId: string,
    userId: string,
    dto: CreateReservationDto,
  ) {
    const checkIn = new Date(dto.checkInDate);
    const checkOut = new Date(dto.checkOutDate);

    if (checkIn >= checkOut) {
      throw new BadRequestException(
        "Check-out date must be after check-in date",
      );
    }

    await this.validateRelations(
      organizationId,
      dto.propertyId,
      dto.roomId,
      dto.guestId,
    );

    // Check room availability
    const isAvailable = await this.isRoomAvailable(
      dto.roomId,
      checkIn,
      checkOut,
    );
    if (!isAvailable) {
      throw new BadRequestException(
        "Room is not available for the selected dates",
      );
    }

    const reservationNumber = await this.generateReservationNumber();
    const totalAmount =
      dto.totalAmount && dto.totalAmount > 0
        ? dto.totalAmount
        : (await this.quote(organizationId, dto.roomId, checkIn, checkOut))
            .totalAmount;

    const reservation = await this.prisma.reservation.create({
      data: {
        reservationNumber,
        property: { connect: { id: dto.propertyId } },
        room: { connect: { id: dto.roomId } },
        guest: { connect: { id: dto.guestId } },
        checkInDate: checkIn,
        checkOutDate: checkOut,
        adults: dto.adults ?? 1,
        children: dto.children ?? 0,
        status: dto.status ?? ReservationStatus.pending,
        totalAmount,
        paidAmount: dto.paidAmount ?? 0,
        paymentStatus: dto.paidAmount
          ? dto.paidAmount >= totalAmount
            ? PaymentStatus.paid
            : PaymentStatus.partial
          : PaymentStatus.pending,
        source: dto.source ?? "direct",
        notes: dto.notes,
        createdBy: userId,
      },
      include: {
        guest: true,
        room: { include: { roomType: true } },
        property: true,
      },
    });

    void this.eventPublisher.publish(EventTypes.BOOKING_CREATED, {
      reservationId: reservation.id,
      reservationNumber: reservation.reservationNumber,
      propertyId: reservation.propertyId,
      roomId: reservation.roomId,
      guestId: reservation.guestId,
      checkInDate: reservation.checkInDate.toISOString(),
      checkOutDate: reservation.checkOutDate.toISOString(),
      totalAmount: Number(reservation.totalAmount),
      source: reservation.source,
      organizationId,
    });

    return reservation;
  }

  async update(id: string, organizationId: string, dto: UpdateReservationDto) {
    const existing = await this.findOne(id, organizationId);

    const checkIn = dto.checkInDate
      ? new Date(dto.checkInDate)
      : existing.checkInDate;
    const checkOut = dto.checkOutDate
      ? new Date(dto.checkOutDate)
      : existing.checkOutDate;

    if (checkIn >= checkOut) {
      throw new BadRequestException(
        "Check-out date must be after check-in date",
      );
    }

    const newRoomId = dto.roomId || existing.roomId;

    if (dto.roomId || dto.checkInDate || dto.checkOutDate) {
      await this.validateRelations(
        organizationId,
        dto.propertyId || existing.propertyId,
        newRoomId,
        dto.guestId || existing.guestId,
      );

      const isAvailable = await this.isRoomAvailable(
        newRoomId,
        checkIn,
        checkOut,
        id,
      );
      if (!isAvailable) {
        throw new BadRequestException(
          "Room is not available for the selected dates",
        );
      }
    }

    const { propertyId, roomId, guestId, ...rest } = dto;
    return this.prisma.reservation.update({
      where: { id },
      data: {
        ...rest,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        ...(propertyId && { property: { connect: { id: propertyId } } }),
        ...(roomId && { room: { connect: { id: roomId } } }),
        ...(guestId && { guest: { connect: { id: guestId } } }),
      },
      include: {
        guest: true,
        room: { include: { roomType: true } },
        property: true,
      },
    });
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId);

    return this.prisma.reservation.delete({
      where: { id },
    });
  }

  async checkIn(id: string, organizationId: string, notes?: string) {
    const reservation = await this.findOne(id, organizationId);

    if (reservation.status !== ReservationStatus.confirmed) {
      throw new BadRequestException(
        "Reservation must be confirmed before check-in",
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.reservation.update({
        where: { id },
        data: {
          status: ReservationStatus.checked_in,
          notes: notes
            ? `${reservation.notes ?? ""}\nCheck-in: ${notes}`.trim()
            : reservation.notes,
        },
        include: {
          guest: true,
          room: { include: { roomType: true } },
          property: true,
        },
      }),
      this.prisma.room.update({
        where: { id: reservation.roomId },
        data: { status: RoomStatus.occupied },
      }),
    ]);

    void this.eventPublisher.publish(EventTypes.BOOKING_CHECKED_IN, {
      reservationId: updated.id,
      reservationNumber: updated.reservationNumber,
      roomId: updated.roomId,
      guestId: updated.guestId,
      checkedInAt: new Date().toISOString(),
      organizationId,
    });

    return updated;
  }

  async checkOut(id: string, organizationId: string, finalAmount?: number) {
    const reservation = await this.findOne(id, organizationId);

    if (reservation.status !== ReservationStatus.checked_in) {
      throw new BadRequestException(
        "Reservation must be checked in before check-out",
      );
    }

    const totalAmount = finalAmount ?? reservation.totalAmount;

    const [updated] = await this.prisma.$transaction([
      this.prisma.reservation.update({
        where: { id },
        data: {
          status: ReservationStatus.checked_out,
          totalAmount,
          paymentStatus:
            reservation.paidAmount >= totalAmount
              ? PaymentStatus.paid
              : PaymentStatus.pending,
        },
        include: {
          guest: true,
          room: { include: { roomType: true } },
          property: true,
        },
      }),
      this.prisma.room.update({
        where: { id: reservation.roomId },
        data: { status: RoomStatus.cleaning },
      }),
      this.prisma.housekeepingTask.create({
        data: {
          organizationId,
          property: { connect: { id: reservation.propertyId } },
          room: { connect: { id: reservation.roomId } },
          type: HousekeepingTaskType.checkout_clean,
          status: HousekeepingTaskStatus.pending,
          priority: 2,
          dueDate: new Date(),
          notes: `Checkout clean for ${reservation.reservationNumber}`,
        },
      }),
    ]);

    // Auto-generate invoice on checkout
    try {
      await this.invoicesService.generateFromCheckout(id, organizationId);
    } catch {
      // Don't fail checkout if invoice generation fails
    }

    void this.eventPublisher.publish(EventTypes.BOOKING_CHECKED_OUT, {
      reservationId: updated.id,
      reservationNumber: updated.reservationNumber,
      roomId: updated.roomId,
      guestId: updated.guestId,
      checkedOutAt: new Date().toISOString(),
      finalAmount: finalAmount !== undefined ? Number(finalAmount) : undefined,
      organizationId,
    });

    return updated;
  }

  async getCalendar(
    organizationId: string,
    propertyId: string,
    month: number,
    year: number,
  ) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId },
    });

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const reservations = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        status: { not: ReservationStatus.cancelled },
        OR: [
          { checkInDate: { gte: start, lte: end } },
          { checkOutDate: { gte: start, lte: end } },
          {
            checkInDate: { lte: start },
            checkOutDate: { gte: end },
          },
        ],
      },
      include: {
        guest: true,
        room: true,
      },
      orderBy: { checkInDate: "asc" },
    });

    const days: Record<
      string,
      {
        date: string;
        checkIns: number;
        checkOuts: number;
        reservations: any[];
      }
    > = {};

    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const key = date.toISOString().split("T")[0];
      days[key] = {
        date: key,
        checkIns: 0,
        checkOuts: 0,
        reservations: [],
      };
    }

    for (const reservation of reservations) {
      const checkInKey = reservation.checkInDate.toISOString().split("T")[0];
      const checkOutKey = reservation.checkOutDate.toISOString().split("T")[0];

      if (days[checkInKey]) {
        days[checkInKey].checkIns++;
        days[checkInKey].reservations.push({
          id: reservation.id,
          reservationNumber: reservation.reservationNumber,
          guestName: `${reservation.guest.firstName} ${reservation.guest.lastName}`,
          roomNumber: reservation.room.roomNumber,
          status: reservation.status,
          type: "check-in",
        });
      }

      if (days[checkOutKey] && checkOutKey !== checkInKey) {
        days[checkOutKey].checkOuts++;
        days[checkOutKey].reservations.push({
          id: reservation.id,
          reservationNumber: reservation.reservationNumber,
          guestName: `${reservation.guest.firstName} ${reservation.guest.lastName}`,
          roomNumber: reservation.room.roomNumber,
          status: reservation.status,
          type: "check-out",
        });
      }
    }

    return Object.values(days);
  }

  async quote(
    organizationId: string,
    roomId: string,
    checkIn: Date,
    checkOut: Date,
  ) {
    if (checkIn >= checkOut) {
      throw new BadRequestException(
        "Check-out date must be after check-in date",
      );
    }

    const room = await this.prisma.room.findFirst({
      where: { id: roomId, property: { organizationId } },
      include: {
        roomType: {
          include: {
            seasonalRates: {
              where: {
                organizationId,
                isActive: true,
                startDate: { lt: checkOut },
                endDate: { gte: checkIn },
              },
              orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
            },
          },
        },
      },
    });
    if (!room) {
      throw new BadRequestException("Room not found or access denied");
    }

    const nights = this.getNights(checkIn, checkOut);
    const basePrice = Number(room.roomType.basePrice);
    const lines: {
      date: string;
      roomTypeId: string;
      rateName: string;
      amount: number;
    }[] = [];

    for (let offset = 0; offset < nights; offset++) {
      const date = new Date(checkIn);
      date.setDate(checkIn.getDate() + offset);
      const seasonalRate = room.roomType.seasonalRates.find((rate) => {
        const start = new Date(rate.startDate);
        const end = new Date(rate.endDate);
        end.setHours(23, 59, 59, 999);
        return date >= start && date <= end && nights >= rate.minimumStay;
      });
      lines.push({
        date: date.toISOString().slice(0, 10),
        roomTypeId: room.roomTypeId,
        rateName: seasonalRate?.name ?? "Base Rate",
        amount: Number(seasonalRate?.price ?? basePrice),
      });
    }

    return {
      roomId: room.id,
      roomTypeId: room.roomTypeId,
      nights,
      currency: "LKR",
      totalAmount: Number(
        lines.reduce((sum, line) => sum + line.amount, 0).toFixed(2),
      ),
      averageNightlyRate: Number(
        (
          lines.reduce((sum, line) => sum + line.amount, 0) / nights
        ).toFixed(2),
      ),
      lines,
    };
  }

  private async isRoomAvailable(
    roomId: string,
    checkIn: Date,
    checkOut: Date,
    excludeReservationId?: string,
  ) {
    const where: any = {
      roomId,
      status: { not: ReservationStatus.cancelled },
      OR: [
        {
          checkInDate: { lt: checkOut },
          checkOutDate: { gt: checkIn },
        },
      ],
    };

    if (excludeReservationId) {
      where.id = { not: excludeReservationId };
    }

    const overlapping = await this.prisma.reservation.count({ where });
    return overlapping === 0;
  }

  private getNights(checkIn: Date, checkOut: Date) {
    return Math.max(
      1,
      Math.ceil(
        (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );
  }

  private async validateRelations(
    organizationId: string,
    propertyId: string,
    roomId: string,
    guestId: string,
  ) {
    const [property, room, guest] = await Promise.all([
      this.prisma.property.findFirst({
        where: { id: propertyId, organizationId },
      }),
      this.prisma.room.findFirst({
        where: { id: roomId, property: { organizationId } },
      }),
      this.prisma.guest.findFirst({
        where: { id: guestId, organizationId },
      }),
    ]);

    if (!property)
      throw new BadRequestException("Property not found or access denied");
    if (!room) throw new BadRequestException("Room not found or access denied");
    if (room.propertyId !== propertyId) {
      throw new BadRequestException(
        "Room does not belong to the selected property",
      );
    }
    if (!guest)
      throw new BadRequestException("Guest not found or access denied");
  }

  private async generateReservationNumber(): Promise<string> {
    const today = new Date();
    const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");
    const count = await this.prisma.reservation.count({
      where: {
        reservationNumber: { startsWith: `RES-${datePart}` },
      },
    });
    const sequence = (count + 1).toString().padStart(4, "0");
    return `RES-${datePart}-${sequence}`;
  }
}
