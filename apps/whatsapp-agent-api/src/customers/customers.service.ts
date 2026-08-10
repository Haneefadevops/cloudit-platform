import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreate(input: {
    clientId: string;
    phoneNumber?: string;
    name?: string;
    leadSource?: string;
    channel?: string;
    channelSourceId?: string;
  }) {
    const { clientId, phoneNumber, name, leadSource, channel, channelSourceId } = input;
    const resolvedChannel = channel || 'whatsapp';

    if (resolvedChannel !== 'whatsapp') {
      const existing = await this.prisma.customer.findFirst({
        where: {
          clientId,
          channel: resolvedChannel,
          channelSourceId: channelSourceId ?? null,
        },
      });

      if (existing) {
        if (name && !existing.name) {
          return this.prisma.customer.update({
            where: { id: existing.id },
            data: { name },
          });
        }
        return existing;
      }

      return this.prisma.customer.create({
        data: {
          clientId,
          phoneNumber: null,
          name,
          leadSource,
          channel: resolvedChannel,
          channelSourceId,
        },
      });
    }

    const existing = await this.prisma.customer.findUnique({
      where: {
        clientId_phoneNumber: {
          clientId,
          phoneNumber: phoneNumber as string,
        },
      },
    });

    if (existing) {
      if (name && !existing.name) {
        return this.prisma.customer.update({
          where: { id: existing.id },
          data: { name },
        });
      }
      return existing;
    }

    return this.prisma.customer.create({
      data: {
        clientId,
        phoneNumber,
        name,
        leadSource,
        channel,
        channelSourceId,
      },
    });
  }

  findAll(clientId: string, categoryId?: string) {
    return this.prisma.customer.findMany({
      where: { clientId, ...(categoryId ? { categoryId } : {}) },
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async setCategory(
    clientId: string,
    customerId: string,
    categoryId: string | null,
  ) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, clientId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    if (categoryId) {
      const category = await this.prisma.customerCategory.findFirst({
        where: { id: categoryId, clientId },
      });
      if (!category) throw new NotFoundException('Customer category not found');
    }

    return this.prisma.customer.update({
      where: { id: customer.id },
      data: { categoryId },
      include: { category: true },
    });
  }
}
