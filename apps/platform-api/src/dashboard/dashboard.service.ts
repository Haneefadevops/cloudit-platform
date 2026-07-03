import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const [usersCount, orgsCount, activeUsers, pendingInvites] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.organization.count(),
        this.prisma.user.count({ where: { isActive: true } }),
        this.prisma.user.count({
          where: { isActive: true, emailVerified: false },
        }),
      ]);

    return {
      usersCount,
      orgsCount,
      activeUsers,
      pendingInvites,
    };
  }
}
