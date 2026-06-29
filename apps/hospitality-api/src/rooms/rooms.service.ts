import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRoomDto } from "./dto/create-room.dto";
import { UpdateRoomDto } from "./dto/update-room.dto";
import { RoomStatus, ReservationStatus } from "@prisma/client-hospitality";

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    organizationId: string,
    page: number,
    limit: number,
    filters?: {
      propertyId?: string;
      roomTypeId?: string;
      status?: string;
    },
  ) {
    const skip = (page - 1) * limit;
    const where: any = {
      property: { organizationId },
    };

    if (filters?.propertyId) {
      where.propertyId = filters.propertyId;
    }
    if (filters?.roomTypeId) {
      where.roomTypeId = filters.roomTypeId;
    }
    if (filters?.status) {
      where.status = filters.status as RoomStatus;
    }

    const [data, total] = await Promise.all([
      this.prisma.room.findMany({
        where,
        skip,
        take: limit,
        orderBy: { roomNumber: "asc" },
        include: { roomType: true, property: true },
      }),
      this.prisma.room.count({ where }),
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
    const room = await this.prisma.room.findFirst({
      where: { id, property: { organizationId } },
      include: { roomType: true, property: true },
    });

    if (!room) {
      throw new NotFoundException("Room not found");
    }

    return room;
  }

  async findAvailable(
    organizationId: string,
    propertyId: string,
    checkIn: Date,
    checkOut: Date,
  ) {
    const property = await this.prisma.property.findFirst({
      where: { id: propertyId, organizationId },
    });

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    const overlappingReservations = await this.prisma.reservation.findMany({
      where: {
        propertyId,
        status: { not: ReservationStatus.cancelled },
        OR: [
          {
            checkInDate: { lt: checkOut },
            checkOutDate: { gt: checkIn },
          },
        ],
      },
      select: { roomId: true },
    });

    const occupiedRoomIds = overlappingReservations.map((r) => r.roomId);

    return this.prisma.room.findMany({
      where: {
        propertyId,
        status: RoomStatus.available,
        id: { notIn: occupiedRoomIds },
      },
      include: { roomType: true },
      orderBy: { roomNumber: "asc" },
    });
  }

  async create(organizationId: string, dto: CreateRoomDto) {
    await this.validateRelations(
      organizationId,
      dto.propertyId,
      dto.roomTypeId,
    );

    const { propertyId, roomTypeId, ...data } = dto;
    return this.prisma.room.create({
      data: {
        ...data,
        property: { connect: { id: propertyId } },
        roomType: { connect: { id: roomTypeId } },
      },
    });
  }

  async update(id: string, organizationId: string, dto: UpdateRoomDto) {
    await this.findOne(id, organizationId);

    if (dto.propertyId || dto.roomTypeId) {
      await this.validateRelations(
        organizationId,
        dto.propertyId,
        dto.roomTypeId,
        id,
      );
    }

    const { propertyId, roomTypeId, ...data } = dto;
    return this.prisma.room.update({
      where: { id },
      data: {
        ...data,
        ...(propertyId && { property: { connect: { id: propertyId } } }),
        ...(roomTypeId && { roomType: { connect: { id: roomTypeId } } }),
      },
    });
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId);

    return this.prisma.room.delete({
      where: { id },
    });
  }

  private async validateRelations(
    organizationId: string,
    propertyId?: string,
    roomTypeId?: string,
    roomId?: string,
  ) {
    if (propertyId) {
      const property = await this.prisma.property.findFirst({
        where: { id: propertyId, organizationId },
      });
      if (!property) {
        throw new BadRequestException("Property not found or access denied");
      }
    }

    if (roomTypeId) {
      const roomType = await this.prisma.roomType.findFirst({
        where: {
          id: roomTypeId,
          property: { organizationId },
          ...(propertyId ? { propertyId } : {}),
          ...(roomId ? { rooms: { none: { id: roomId } } } : {}),
        },
      });
      if (!roomType) {
        throw new BadRequestException("Room type not found or access denied");
      }
    }
  }
}
