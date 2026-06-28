import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import {
  ReservationStatus,
  RoomStatus,
  PaymentStatus,
} from '@prisma/client';

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoicesService: InvoicesService,
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
        orderBy: { createdAt: 'desc' },
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
      throw new NotFoundException('Reservation not found');
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
      throw new BadRequestException('Check-out date must be after check-in date');
    }

    await this.validateRelations(organizationId, dto.propertyId, dto.roomId, dto.guestId);

    // Check room availability
    const isAvailable = await this.isRoomAvailable(
      dto.roomId,
      checkIn,
      checkOut,
    );
    if (!isAvailable) {
      throw new BadRequestException('Room is not available for the selected dates');
    }

    const reservationNumber = await this.generateReservationNumber();

    return this.prisma.reservation.create({
      data: {
        reservationNumber,
        propertyId: dto.propertyId,
        roomId: dto.roomId,
        guestId: dto.guestId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        adults: dto.adults ?? 1,
        children: dto.children ?? 0,
        status: dto.status ?? ReservationStatus.pending,
        totalAmount: dto.totalAmount ?? 0,
        paidAmount: dto.paidAmount ?? 0,
        paymentStatus: dto.paidAmount
          ? dto.paidAmount >= (dto.totalAmount ?? 0)
            ? PaymentStatus.paid
            : PaymentStatus.partial
          : PaymentStatus.pending,
        source: dto.source ?? 'direct',
        notes: dto.notes,
        createdBy: userId,
      },
      include: {
        guest: true,
        room: { include: { roomType: true } },
        property: true,
      },
    });
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateReservationDto,
  ) {
    const existing = await this.findOne(id, organizationId);

    const checkIn = dto.checkInDate
      ? new Date(dto.checkInDate)
      : existing.checkInDate;
    const checkOut = dto.checkOutDate
      ? new Date(dto.checkOutDate)
      : existing.checkOutDate;

    if (checkIn >= checkOut) {
      throw new BadRequestException('Check-out date must be after check-in date');
    }

    const newRoomId = dto.roomId || existing.roomId;

    if (
      dto.roomId ||
      dto.checkInDate ||
      dto.checkOutDate
    ) {
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
        throw new BadRequestException('Room is not available for the selected dates');
      }
    }

    return this.prisma.reservation.update({
      where: { id },
      data: {
        ...dto,
        checkInDate: checkIn,
        checkOutDate: checkOut,
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
      throw new BadRequestException('Reservation must be confirmed before check-in');
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.reservation.update({
        where: { id },
        data: {
          status: ReservationStatus.checked_in,
          notes: notes ? `${reservation.notes ?? ''}\nCheck-in: ${notes}`.trim() : reservation.notes,
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

    return updated;
  }

  async checkOut(id: string, organizationId: string, finalAmount?: number) {
    const reservation = await this.findOne(id, organizationId);

    if (reservation.status !== ReservationStatus.checked_in) {
      throw new BadRequestException('Reservation must be checked in before check-out');
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
    ]);

    // Auto-generate invoice on checkout
    try {
      await this.invoicesService.generateFromCheckout(id, organizationId);
    } catch {
      // Don't fail checkout if invoice generation fails
    }

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
      throw new NotFoundException('Property not found');
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
      orderBy: { checkInDate: 'asc' },
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
      const key = date.toISOString().split('T')[0];
      days[key] = {
        date: key,
        checkIns: 0,
        checkOuts: 0,
        reservations: [],
      };
    }

    for (const reservation of reservations) {
      const checkInKey = reservation.checkInDate.toISOString().split('T')[0];
      const checkOutKey = reservation.checkOutDate.toISOString().split('T')[0];

      if (days[checkInKey]) {
        days[checkInKey].checkIns++;
        days[checkInKey].reservations.push({
          id: reservation.id,
          reservationNumber: reservation.reservationNumber,
          guestName: `${reservation.guest.firstName} ${reservation.guest.lastName}`,
          roomNumber: reservation.room.roomNumber,
          status: reservation.status,
          type: 'check-in',
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
          type: 'check-out',
        });
      }
    }

    return Object.values(days);
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

    if (!property) throw new BadRequestException('Property not found or access denied');
    if (!room) throw new BadRequestException('Room not found or access denied');
    if (room.propertyId !== propertyId) {
      throw new BadRequestException('Room does not belong to the selected property');
    }
    if (!guest) throw new BadRequestException('Guest not found or access denied');
  }

  private async generateReservationNumber(): Promise<string> {
    const today = new Date();
    const datePart = today.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.prisma.reservation.count({
      where: {
        reservationNumber: { startsWith: `RES-${datePart}` },
      },
    });
    const sequence = (count + 1).toString().padStart(4, '0');
    return `RES-${datePart}-${sequence}`;
  }
}
