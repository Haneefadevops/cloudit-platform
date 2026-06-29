import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateRoomTypeDto } from "./dto/create-room-type.dto";
import { UpdateRoomTypeDto } from "./dto/update-room-type.dto";

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
      include: { property: true, rooms: true },
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
}
