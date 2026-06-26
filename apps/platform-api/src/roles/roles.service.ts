import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(orgId: string) {
    return this.prisma.role.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async create(userId: string, dto: any) {
    return this.prisma.role.create({
      data: {
        name: dto.name,
        permissions: dto.permissions || [],
        orgId: dto.orgId,
        createdById: userId,
      },
    });
  }

  async update(id: string, dto: any) {
    const data: any = {};
    if (dto.name) data.name = dto.name;
    if (dto.permissions) data.permissions = dto.permissions;
    return this.prisma.role.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.prisma.role.delete({ where: { id } });
    return { message: 'Role deleted' };
  }
}
