import { Controller, Get, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AnalyticsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('overview')
  async overview() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [
      totalConversations,
      activeConversations,
      resolvedConversations,
      humanHandoffs,
      totalMessages,
      handoffsToday,
      conversationsToday,
      topHandoffReasons,
      dailyVolume,
    ] = await Promise.all([
      this.prisma.conversation.count(),
      this.prisma.conversation.count({
        where: { status: { in: ['bot', 'human'] } },
      }),
      this.prisma.conversation.count({ where: { status: 'resolved' } }),
      this.prisma.conversation.count({ where: { status: 'human' } }),
      this.prisma.message.count(),
      this.prisma.conversation.count({
        where: { status: 'human', updatedAt: { gte: startOfDay } },
      }),
      this.prisma.conversation.count({
        where: { createdAt: { gte: startOfDay } },
      }),
      this.prisma.handoffLog.groupBy({
        by: ['reason'],
        _count: { reason: true },
        orderBy: { _count: { reason: 'desc' } },
        take: 5,
      }),
      this.getDailyVolume(sevenDaysAgo),
    ]);

    return {
      totalConversations,
      activeConversations,
      resolvedConversations,
      humanHandoffs,
      totalMessages,
      handoffsToday,
      conversationsToday,
      topHandoffReasons: topHandoffReasons.map((r) => ({
        reason: r.reason,
        count: r._count.reason,
      })),
      dailyVolume,
    };
  }

  private async getDailyVolume(since: Date) {
    const rows = await this.prisma.$queryRaw<
      { date: string; count: bigint }[]
    >`
      SELECT DATE("createdAt") as date, COUNT(*) as count
      FROM conversations
      WHERE "createdAt" >= ${since}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;
    return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
  }
}
