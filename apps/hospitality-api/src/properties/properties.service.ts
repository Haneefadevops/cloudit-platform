import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreatePropertyDto } from "./dto/create-property.dto";
import { UpdatePropertyDto } from "./dto/update-property.dto";

const SRI_LANKA_DEFAULT_SETTINGS = {
  currency: "LKR",
  currencySymbol: "Rs.",
  locale: "en-LK",
  dateFormat: "yyyy-MM-dd",
};

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    organizationId: string,
    page: number,
    limit: number,
    search?: string,
  ) {
    const skip = (page - 1) * limit;
    const where: any = { organizationId };

    if (search) {
      where.name = { contains: search, mode: "insensitive" };
    }

    const [data, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { rooms: true, roomTypes: true },
          },
        },
      }),
      this.prisma.property.count({ where }),
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
    const property = await this.prisma.property.findFirst({
      where: { id, organizationId },
      include: {
        roomTypes: true,
        rooms: { include: { roomType: true } },
      },
    });

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    return property;
  }

  async create(organizationId: string, dto: CreatePropertyDto) {
    const { settings, ...data } = dto;

    return this.prisma.property.create({
      data: {
        ...data,
        settings: {
          ...SRI_LANKA_DEFAULT_SETTINGS,
          ...(settings ?? {}),
        },
        organizationId,
      },
    });
  }

  async update(id: string, organizationId: string, dto: UpdatePropertyDto) {
    await this.findOne(id, organizationId);

    return this.prisma.property.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId);

    // Cascade deletes rooms, roomTypes, reservations, invoices via Prisma relations
    return this.prisma.property.delete({
      where: { id },
    });
  }
}
