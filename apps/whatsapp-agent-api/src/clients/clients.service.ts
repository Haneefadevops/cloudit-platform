import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByPhoneNumberId(phoneNumberId: string) {
    return this.prisma.client.findUnique({
      where: { whatsappPhoneNumberId: phoneNumberId },
    });
  }

  async findAll() {
    return this.prisma.client.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.client.findUnique({ where: { id } });
  }

  async create(data: Prisma.ClientCreateInput) {
    return this.prisma.client.create({ data });
  }

  async update(id: string, data: Prisma.ClientUpdateInput) {
    return this.prisma.client.update({ where: { id }, data });
  }

  async remove(id: string) {
    return this.prisma.client.delete({ where: { id } });
  }
}
