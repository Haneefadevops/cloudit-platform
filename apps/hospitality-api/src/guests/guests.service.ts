import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateGuestDto } from "./dto/create-guest.dto";
import { UpdateGuestDto } from "./dto/update-guest.dto";

@Injectable()
export class GuestsService {
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
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.guest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { reservations: true },
          },
        },
      }),
      this.prisma.guest.count({ where }),
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
    const guest = await this.prisma.guest.findFirst({
      where: { id, organizationId },
      include: { reservations: { include: { room: true, property: true } } },
    });

    if (!guest) {
      throw new NotFoundException("Guest not found");
    }

    return guest;
  }

  async create(organizationId: string, dto: CreateGuestDto) {
    return this.prisma.guest.create({
      data: {
        ...dto,
        organizationId,
      },
    });
  }

  async update(id: string, organizationId: string, dto: UpdateGuestDto) {
    await this.findOne(id, organizationId);

    return this.prisma.guest.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, organizationId: string) {
    await this.findOne(id, organizationId);

    return this.prisma.guest.delete({
      where: { id },
    });
  }
}
