import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ReservationStatus, RoomStatus } from "@prisma/client-hospitality";
import { PrismaService } from "../prisma/prisma.service";
import { PublicAvailabilityDto } from "./dto/availability.dto";

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

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
}
