import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRoomTypeDto } from "./dto/create-room-type.dto";
import { UpdateRoomTypeDto } from "./dto/update-room-type.dto";
import { CreateSeasonalRateDto } from "./dto/create-seasonal-rate.dto";
import { UpdateSeasonalRateDto } from "./dto/update-seasonal-rate.dto";

@Injectable()
export class RoomTypesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    organizationId: string,
    page: number,
    limit: number,
    propertyId?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = {
      property: { organizationId },
    };

    if (propertyId) {
      where.propertyId = propertyId;
    }

    const [data, total] = await Promise.all([
      this.prisma.roomType.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          seasonalRates: {
            where: { isActive: true },
            orderBy: { startDate: "asc" },
          },
          _count: {
            select: { rooms: true },
          },
        },
      }),
      this.prisma.roomType.count({ where }),
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
    const roomType = await this.prisma.roomType.findFirst({
      where: { id, property: { organizationId } },
      include: {
        property: true,
        rooms: true,
        seasonalRates: { orderBy: { startDate: "asc" } },
      },
    });

    if (!roomType) {
      throw new NotFoundException("Room type not found");
    }

    return roomType;
  }

  async create(organizationId: string, dto: CreateRoomTypeDto) {
    // Verify property belongs to organization
    const property = await this.prisma.property.findFirst({
      where: { id: dto.propertyId, organizationId },
    });

    if (!property) {
      throw new BadRequestException("Property not found or access denied");
    }

    const { propertyId, ...data } = dto;
    return this.prisma.roomType.create({
      data: {
        ...data,
        property: { connect: { id: propertyId } },
      },
    });
  }

  async update(id: string, organizationId: string, dto: UpdateRoomTypeDto) {
    await this.findOne(id, organizationId);

    if (dto.propertyId) {
      const property = await this.prisma.property.findFirst({
        where: { id: dto.propertyId, organizationId },
      });
      if (!property) {
        throw new BadRequestException("Property not found or access denied");
      }
    }

    const { propertyId, ...data } = dto;
    return this.prisma.roomType.update({
      where: { id },
      data: {
        ...data,
        ...(propertyId && { property: { connect: { id: propertyId } } }),
      },
    });
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId);

    return this.prisma.roomType.delete({
      where: { id },
    });
  }

  async listSeasonalRates(roomTypeId: string, organizationId: string) {
    await this.findOne(roomTypeId, organizationId);
    return this.prisma.seasonalRate.findMany({
      where: { roomTypeId, organizationId },
      orderBy: { startDate: "asc" },
    });
  }

  async createSeasonalRate(
    roomTypeId: string,
    organizationId: string,
    dto: CreateSeasonalRateDto,
  ) {
    await this.findOne(roomTypeId, organizationId);
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (startDate > endDate) {
      throw new BadRequestException("End date must be on or after start date");
    }

    return this.prisma.seasonalRate.create({
      data: {
        roomType: { connect: { id: roomTypeId } },
        organizationId,
        name: dto.name,
        startDate,
        endDate,
        price: dto.price,
        minimumStay: dto.minimumStay ?? 1,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateSeasonalRate(
    roomTypeId: string,
    rateId: string,
    organizationId: string,
    dto: UpdateSeasonalRateDto,
  ) {
    await this.findOne(roomTypeId, organizationId);
    const existing = await this.prisma.seasonalRate.findFirst({
      where: { id: rateId, roomTypeId, organizationId },
    });
    if (!existing) {
      throw new NotFoundException("Seasonal rate not found");
    }

    const startDate = dto.startDate ? new Date(dto.startDate) : existing.startDate;
    const endDate = dto.endDate ? new Date(dto.endDate) : existing.endDate;
    if (startDate > endDate) {
      throw new BadRequestException("End date must be on or after start date");
    }

    return this.prisma.seasonalRate.update({
      where: { id: rateId },
      data: {
        name: dto.name,
        startDate,
        endDate,
        price: dto.price,
        minimumStay: dto.minimumStay,
        isActive: dto.isActive,
      },
    });
  }

  async removeSeasonalRate(
    roomTypeId: string,
    rateId: string,
    organizationId: string,
  ) {
    await this.findOne(roomTypeId, organizationId);
    const existing = await this.prisma.seasonalRate.findFirst({
      where: { id: rateId, roomTypeId, organizationId },
    });
    if (!existing) {
      throw new NotFoundException("Seasonal rate not found");
    }

    return this.prisma.seasonalRate.delete({ where: { id: rateId } });
  }
}
