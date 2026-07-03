import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const members = await this.prisma.organizationMember.findMany({
      where: { userId },
      include: { organization: true },
    });
    return members.map((m) => ({
      ...m.organization,
      role: m.role,
      description:
        (m.organization.settings as Record<string, any>)?.description || '',
    }));
  }

  async findOne(id: string, userId: string) {
    await this.checkMembership(id, userId);
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return {
      ...org,
      description: (org.settings as Record<string, any>)?.description || '',
    };
  }

  async create(userId: string, dto: any) {
    const slug = `${dto.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')}-${Date.now().toString(36)}`;
    const org = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug,
        logo: dto.logo,
        members: {
          create: { userId, role: 'ADMIN' },
        },
      },
    });
    return org;
  }

  async update(id: string, userId: string, dto: any) {
    await this.checkAdmin(id, userId);
    const existing = await this.prisma.organization.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Organization not found');

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.logo !== undefined) data.logo = dto.logo;
    if (dto.plan) data.plan = dto.plan;

    const settings = (existing.settings as Record<string, any>) || {};
    if (dto.description !== undefined) {
      settings.description = dto.description;
      data.settings = settings;
    } else if (dto.settings) {
      data.settings = dto.settings;
    }

    const updated = await this.prisma.organization.update({
      where: { id },
      data,
    });

    return {
      ...updated,
      description: (updated.settings as Record<string, any>)?.description || '',
    };
  }

  async remove(id: string, userId: string) {
    await this.checkAdmin(id, userId);
    await this.prisma.organization.delete({ where: { id } });
    return { message: 'Organization deleted' };
  }

  async inviteMember(id: string, userId: string, dto: any) {
    await this.checkAdmin(id, userId);
    const targetUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!targetUser) {
      throw new BadRequestException('User not found with this email');
    }
    const existing = await this.prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId: targetUser.id, orgId: id } },
    });
    if (existing) {
      throw new BadRequestException('User is already a member');
    }
    return this.prisma.organizationMember.create({
      data: { userId: targetUser.id, orgId: id, role: dto.role || 'MEMBER' },
    });
  }

  async updateMember(id: string, memberId: string, userId: string, dto: any) {
    await this.checkAdmin(id, userId);
    return this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { role: dto.role },
    });
  }

  async removeMember(id: string, memberId: string, userId: string) {
    await this.checkAdmin(id, userId);
    await this.prisma.organizationMember.delete({ where: { id: memberId } });
    return { message: 'Member removed' };
  }

  private async checkMembership(orgId: string, userId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId, orgId } },
    });
    if (!member)
      throw new ForbiddenException('Not a member of this organization');
  }

  private async checkAdmin(orgId: string, userId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { userId_orgId: { userId, orgId } },
    });
    if (!member || member.role !== 'ADMIN') {
      throw new ForbiddenException('Admin access required');
    }
  }
}
