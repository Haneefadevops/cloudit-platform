import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

const STAFF_ROLES = ['admin', 'supervisor', 'agent'] as const;
const CREATABLE_ROLES = ['admin', 'supervisor'] as const;
const STATUSES = ['active', 'disabled'] as const;

const SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
} as const;

/**
 * Staff account management. "Staff" = users with clientId NULL (the
 * TheReplyte team); client portal users (clientId set, Phase 6) are never
 * listed or editable here.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  listStaff() {
    return this.prisma.user.findMany({
      where: { clientId: null },
      orderBy: { createdAt: 'desc' },
      select: SAFE_SELECT,
    });
  }

  async createStaff(data: {
    name?: string;
    email?: string;
    password?: string;
    role?: string;
  }) {
    const name = data.name?.trim();
    const email = data.email?.trim().toLowerCase();
    if (!name || !email || !data.password) {
      throw new BadRequestException('Name, email and password are required');
    }
    if (data.password.length < 8) {
      throw new BadRequestException(
        'Password must be at least 8 characters long',
      );
    }
    if (!CREATABLE_ROLES.includes(data.role as never)) {
      throw new BadRequestException(
        `Role must be one of: ${CREATABLE_ROLES.join(', ')}`,
      );
    }

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('A user with this email already exists');
    }

    return this.prisma.user.create({
      data: {
        name,
        email,
        password: await bcrypt.hash(data.password, 10),
        role: data.role as string,
        status: 'active',
        clientId: null,
      },
      select: SAFE_SELECT,
    });
  }

  async updateStaff(
    currentUserId: string,
    id: string,
    data: { role?: string; status?: string },
  ) {
    if (data.role !== undefined && !STAFF_ROLES.includes(data.role as never)) {
      throw new BadRequestException(
        `Role must be one of: ${STAFF_ROLES.join(', ')}`,
      );
    }
    if (
      data.status !== undefined &&
      !STATUSES.includes(data.status as never)
    ) {
      throw new BadRequestException(
        `Status must be one of: ${STATUSES.join(', ')}`,
      );
    }

    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target || target.clientId !== null) {
      throw new NotFoundException('Staff user not found');
    }

    if (data.status === 'disabled' && id === currentUserId) {
      throw new BadRequestException('You cannot disable your own account');
    }

    // Never remove the last active admin — that would lock everyone out of
    // staff management.
    const demotingAdmin =
      target.role === 'admin' &&
      target.status === 'active' &&
      (data.status === 'disabled' ||
        (data.role !== undefined && data.role !== 'admin'));
    if (demotingAdmin) {
      const otherActiveAdmins = await this.prisma.user.count({
        where: {
          id: { not: id },
          clientId: null,
          role: 'admin',
          status: 'active',
        },
      });
      if (otherActiveAdmins === 0) {
        throw new BadRequestException(
          'Cannot disable or demote the last active admin account',
        );
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        ...(data.role !== undefined ? { role: data.role } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
      },
      select: SAFE_SELECT,
    });
  }
}
