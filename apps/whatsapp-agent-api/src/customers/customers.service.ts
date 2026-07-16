import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async findOrCreate(input: {
    clientId: string;
    phoneNumber: string;
    name?: string;
  }) {
    const { clientId, phoneNumber, name } = input;

    const existing = await this.prisma.customer.findUnique({
      where: {
        clientId_phoneNumber: {
          clientId,
          phoneNumber,
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
      },
    });
  }
}
