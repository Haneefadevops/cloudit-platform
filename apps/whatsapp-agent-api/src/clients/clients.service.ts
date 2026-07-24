import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  clientId: true,
  createdAt: true,
} as const;

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

  // ---- Client portal users ----

  /**
   * Creates a portal login linked to a client (role client_admin). Staff
   * hands the credentials to the client; password resets are staff-managed
   * (no SMTP dependency in v1).
   */
  async createPortalUser(
    clientId: string,
    data: { email: string; password: string; name?: string },
  ) {
    if (!data.email || !data.password) {
      throw new BadRequestException('email and password are required');
    }
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) throw new NotFoundException('Client not found');

    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    return this.prisma.user.create({
      data: {
        clientId,
        email: data.email,
        name: data.name || `${client.name} Admin`,
        password: await bcrypt.hash(data.password, 10),
        role: 'client_admin',
      },
      select: SAFE_USER_SELECT,
    });
  }

  /** Staff regenerates a portal user's password. */
  async resetPortalUserPassword(
    clientId: string,
    userId: string,
    password: string,
  ) {
    if (!password) throw new BadRequestException('password is required');
    const user = await this.prisma.user.findFirst({
      where: { id: userId, clientId },
    });
    if (!user) {
      throw new NotFoundException('Portal user not found for this client');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { password: await bcrypt.hash(password, 10) },
      select: SAFE_USER_SELECT,
    });
  }

  listPortalUsers(clientId: string) {
    return this.prisma.user.findMany({
      where: { clientId, role: { startsWith: 'client_' } },
      select: SAFE_USER_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }
}
