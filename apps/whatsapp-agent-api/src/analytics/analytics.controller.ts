import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AnalyticsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Get('overview')
  async overview(@Query('clientId') clientId?: string) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const clientFilter = clientId ? { clientId } : {};
    const messageFilter = clientId
      ? { conversation: { clientId } }
      : {};

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
      avgResolutionTimeMinutes,
      avgHandoffResponseSeconds,
      csat,
      tokenUsage,
    ] = await Promise.all([
      this.prisma.conversation.count({ where: clientFilter }),
      this.prisma.conversation.count({
        where: { ...clientFilter, status: { in: ['bot', 'human'] } },
      }),
      this.prisma.conversation.count({
        where: { ...clientFilter, status: 'resolved' },
      }),
      this.prisma.conversation.count({
        where: { ...clientFilter, status: 'human' },
      }),
      this.prisma.message.count({ where: messageFilter }),
      this.prisma.conversation.count({
        where: { ...clientFilter, status: 'human', updatedAt: { gte: startOfDay } },
      }),
      this.prisma.conversation.count({
        where: { ...clientFilter, createdAt: { gte: startOfDay } },
      }),
      this.getTopHandoffReasons(clientId),
      this.getDailyVolume(sevenDaysAgo, clientId),
      this.getAvgResolutionTimeMinutes(clientId),
      this.getAvgHandoffResponseSeconds(clientId),
      this.getCsatStats(clientId),
      this.getTokenUsage(clientId),
    ]);

    return {
      totalConversations,
      activeConversations,
      resolvedConversations,
      humanHandoffs,
      totalMessages,
      handoffsToday,
      conversationsToday,
      topHandoffReasons,
      dailyVolume,
      avgResolutionTimeMinutes,
      avgHandoffResponseSeconds,
      csat,
      tokens: tokenUsage.tokens,
      estimatedCostUsd: tokenUsage.estimatedCostUsd,
    };
  }

  private async getTopHandoffReasons(clientId?: string) {
    const rows = await this.prisma.$queryRaw<
      { reason: string | null; count: bigint }[]
    >`
      SELECT h."reason", COUNT(*) as count
      FROM handoff_logs h
      JOIN conversations c ON c.id = h."conversationId"
      WHERE h."reason" IS NOT NULL
      ${clientId ? Prisma.sql`AND c."clientId" = ${clientId}` : Prisma.empty}
      GROUP BY h."reason"
      ORDER BY count DESC
      LIMIT 5
    `;
    return rows.map((r) => ({ reason: r.reason, count: Number(r.count) }));
  }

  private async getDailyVolume(since: Date, clientId?: string) {
    const rows = await this.prisma.$queryRaw<
      { date: string; count: bigint }[]
    >`
      SELECT DATE("createdAt") as date, COUNT(*) as count
      FROM conversations
      WHERE "createdAt" >= ${since}
      ${clientId ? Prisma.sql`AND "clientId" = ${clientId}` : Prisma.empty}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;
    return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
  }

  private async getAvgResolutionTimeMinutes(clientId?: string) {
    const rows = await this.prisma.$queryRaw<{ avg: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 60) as avg
      FROM conversations
      WHERE status = 'resolved' AND "resolvedAt" IS NOT NULL
      ${clientId ? Prisma.sql`AND "clientId" = ${clientId}` : Prisma.empty}
    `;
    const avg = rows[0]?.avg;
    return avg == null ? null : Math.round(avg * 10) / 10;
  }

  private async getAvgHandoffResponseSeconds(clientId?: string) {
    const rows = await this.prisma.$queryRaw<{ avg: number | null }[]>`
      SELECT AVG(h."responseTimeSeconds") as avg
      FROM handoff_logs h
      JOIN conversations c ON c.id = h."conversationId"
      WHERE h."responseTimeSeconds" IS NOT NULL
      ${clientId ? Prisma.sql`AND c."clientId" = ${clientId}` : Prisma.empty}
    `;
    const avg = rows[0]?.avg;
    return avg == null ? null : Math.round(avg);
  }

  private async getCsatStats(clientId?: string) {
    const rows = await this.prisma.$queryRaw<
      { avg: number | null; count: bigint }[]
    >`
      SELECT AVG("csatRating") as avg, COUNT("csatRating") as count
      FROM conversations
      WHERE "csatRating" IS NOT NULL
      ${clientId ? Prisma.sql`AND "clientId" = ${clientId}` : Prisma.empty}
    `;
    const row = rows[0];
    return {
      average: row?.avg == null ? null : Math.round(row.avg * 100) / 100,
      responses: Number(row?.count ?? 0),
    };
  }

  private async getTokenUsage(clientId?: string) {
    const rows = await this.prisma.$queryRaw<
      { prompt: number; completion: number; total: number }[]
    >`
      SELECT
        COALESCE(SUM(CASE
          WHEN jsonb_typeof(m."kimiMetadata"->'usage') = 'object'
            AND (m."kimiMetadata"->'usage'->>'prompt_tokens') ~ '^[0-9]+$'
          THEN (m."kimiMetadata"->'usage'->>'prompt_tokens')::bigint ELSE 0 END), 0) AS prompt,
        COALESCE(SUM(CASE
          WHEN jsonb_typeof(m."kimiMetadata"->'usage') = 'object'
            AND (m."kimiMetadata"->'usage'->>'completion_tokens') ~ '^[0-9]+$'
          THEN (m."kimiMetadata"->'usage'->>'completion_tokens')::bigint ELSE 0 END), 0) AS completion,
        COALESCE(SUM(CASE
          WHEN jsonb_typeof(m."kimiMetadata"->'usage') = 'object'
            AND (m."kimiMetadata"->'usage'->>'total_tokens') ~ '^[0-9]+$'
          THEN (m."kimiMetadata"->'usage'->>'total_tokens')::bigint ELSE 0 END), 0) AS total
      FROM messages m
      JOIN conversations c ON c.id = m."conversationId"
      WHERE m."senderType" = 'bot'
      ${clientId ? Prisma.sql`AND c."clientId" = ${clientId}` : Prisma.empty}
    `;

    const tokens = {
      prompt: Number(rows[0]?.prompt ?? 0),
      completion: Number(rows[0]?.completion ?? 0),
      total: Number(rows[0]?.total ?? 0),
    };

    const inputPrice = parseFloat(
      this.configService.get<string>('AI_INPUT_PRICE_PER_1M_TOKENS') || '0',
    ) || 0;
    const outputPrice = parseFloat(
      this.configService.get<string>('AI_OUTPUT_PRICE_PER_1M_TOKENS') || '0',
    ) || 0;
    const estimatedCostUsd =
      Math.round(
        ((tokens.prompt / 1_000_000) * inputPrice +
          (tokens.completion / 1_000_000) * outputPrice) *
          1_000_000,
      ) / 1_000_000;

    return { tokens, estimatedCostUsd };
  }
}
