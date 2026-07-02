import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  HousekeepingTaskStatus,
  RoomStatus,
} from "@prisma/client-hospitality";
import { PrismaService } from "../prisma/prisma.service";
import { CreateHousekeepingTaskDto } from "./dto/create-housekeeping-task.dto";
import { UpdateHousekeepingTaskDto } from "./dto/update-housekeeping-task.dto";

@Injectable()
export class HousekeepingService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    organizationId: string,
    page: number,
    limit: number,
    filters?: { propertyId?: string; roomId?: string; status?: string },
  ) {
    const skip = (page - 1) * limit;
    const where: any = {
      organizationId,
      ...(filters?.propertyId ? { propertyId: filters.propertyId } : {}),
      ...(filters?.roomId ? { roomId: filters.roomId } : {}),
      ...(filters?.status ? { status: filters.status } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.housekeepingTask.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
        include: {
          property: true,
          room: { include: { roomType: true } },
        },
      }),
      this.prisma.housekeepingTask.count({ where }),
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
    const task = await this.prisma.housekeepingTask.findFirst({
      where: { id, organizationId },
      include: {
        property: true,
        room: { include: { roomType: true } },
      },
    });
    if (!task) {
      throw new NotFoundException("Housekeeping task not found");
    }
    return task;
  }

  async create(organizationId: string, dto: CreateHousekeepingTaskDto) {
    const room = await this.prisma.room.findFirst({
      where: { id: dto.roomId, property: { organizationId } },
    });
    if (!room) {
      throw new BadRequestException("Room not found or access denied");
    }

    return this.prisma.housekeepingTask.create({
      data: {
        organizationId,
        room: { connect: { id: room.id } },
        property: { connect: { id: room.propertyId } },
        type: dto.type,
        status: dto.status,
        priority: dto.priority,
        assignedTo: dto.assignedTo,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        notes: dto.notes,
      },
      include: {
        property: true,
        room: { include: { roomType: true } },
      },
    });
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateHousekeepingTaskDto,
  ) {
    const task = await this.findOne(id, organizationId);
    const status = dto.status;
    const now = new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.housekeepingTask.update({
        where: { id },
        data: {
          type: dto.type,
          status,
          priority: dto.priority,
          assignedTo: dto.assignedTo,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          notes: dto.notes,
          ...(status === HousekeepingTaskStatus.in_progress && !task.startedAt
            ? { startedAt: now }
            : {}),
          ...(status === HousekeepingTaskStatus.completed
            ? { completedAt: now }
            : {}),
        },
        include: {
          property: true,
          room: { include: { roomType: true } },
        },
      });

      if (status === HousekeepingTaskStatus.completed) {
        await tx.room.update({
          where: { id: task.roomId },
          data: { status: RoomStatus.available },
        });
      }

      if (
        status === HousekeepingTaskStatus.in_progress &&
        task.room.status !== RoomStatus.cleaning
      ) {
        await tx.room.update({
          where: { id: task.roomId },
          data: { status: RoomStatus.cleaning },
        });
      }

      return saved;
    });

    return updated;
  }
}
