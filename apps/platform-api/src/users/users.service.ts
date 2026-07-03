import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        members: {
          include: { organization: { select: { id: true, name: true } } },
        },
      },
    });
    return users.map((user) => this.toFrontendUser(user));
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { members: { include: { organization: true } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.toFrontendUser(user);
  }

  async update(id: string, dto: any, adminOrgId?: string) {
    const data: any = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.avatar !== undefined) data.avatar = dto.avatar;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 12);

    let user = await this.prisma.user.update({
      where: { id },
      data,
      include: { members: { include: { organization: true } } },
    });

    if (dto.role && adminOrgId) {
      const member = user.members.find((m) => m.orgId === adminOrgId);
      if (member) {
        const role = dto.role === 'admin' ? 'ADMIN' : 'MEMBER';
        await this.prisma.organizationMember.update({
          where: { id: member.id },
          data: { role },
        });
        user = (await this.prisma.user.findUnique({
          where: { id },
          include: { members: { include: { organization: true } } },
        })) as any;
        if (!user) throw new NotFoundException('User not found');
      }
    }

    return this.toFrontendUser(user);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Password changed successfully' };
  }

  async remove(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'User deactivated' };
  }

  private toFrontendUser(user: any) {
    const member = user.members?.[0];
    let status: string;
    if (!user.isActive) {
      status = 'inactive';
    } else if (!user.emailVerified) {
      status = 'pending';
    } else {
      status = 'active';
    }

    const { passwordHash, ...rest } = user;
    return {
      ...rest,
      role: member?.role === 'ADMIN' ? 'admin' : 'user',
      status,
      organizationId: member?.orgId,
    };
  }
}
