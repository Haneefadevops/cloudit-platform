import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { STAFF_ROLES } from '../common/decorators/scoped-client-id.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Get('overview')
  async overview(
    @CurrentUser() user: { role?: string; clientId?: string },
    @Query('clientId') clientId?: string,
    @Query('range') range?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    // Staff may query any client (or all); portal users are always scoped
    // to their own client regardless of the query param.
    const isStaff = !!user && STAFF_ROLES.includes(user.role || '');
    const scopedClientId = isStaff ? clientId : user?.clientId;
    if (!isStaff && !scopedClientId) {
      throw new ForbiddenException('No client associated with this account');
    }
    clientId = scopedClientId;

    const { since, until } = this.resolvePeriod(range, from, to);
    const clientFilter = clientId ? { clientId } : {};
    const periodCreatedAt = since
      ? { createdAt: { gte: since, lte: until } }
      : {};
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalConversations,
      activeConversations,
      resolvedConversations,
      handoffsInPeriod,
      totalMessages,
      topHandoffReasons,
      dailyVolume,
      avgResolutionTimeMinutes,
      avgHandoffResponseSeconds,
      csat,
      tokenUsage,
      aiResolution,
      bookingTotal,
      bookingConfirmed,
      bookingNoShow,
      bookingCompleted,
      bookingUpcomingWeek,
      orderTotal,
      orderByStatus,
      orderRevenue,
    ] = await Promise.all([
      this.prisma.conversation.count({
        where: { ...clientFilter, ...periodCreatedAt },
      }),
      // Snapshot of current state — intentionally not period-filtered.
      this.prisma.conversation.count({
        where: { ...clientFilter, status: { in: ['bot', 'human'] } },
      }),
      this.prisma.conversation.count({
        where: {
          ...clientFilter,
          status: 'resolved',
          ...(since ? { resolvedAt: { gte: since, lte: until } } : {}),
        },
      }),
      this.getHandoffCount(clientId, since, until),
      this.prisma.message.count({
        where: {
          ...periodCreatedAt,
          conversation: { ...clientFilter },
        },
      }),
      this.getTopHandoffReasons(clientId, since, until),
      this.getDailyVolume(clientId, since, until),
      this.getAvgResolutionTimeMinutes(clientId, since, until),
      this.getAvgHandoffResponseSeconds(clientId, since, until),
      this.getCsatStats(clientId, since, until),
      this.getTokenUsage(clientId, since, until),
      this.getAiResolution(clientId, since, until),
      this.prisma.booking.count({
        where: { ...clientFilter, ...periodCreatedAt },
      }),
      this.prisma.booking.count({
        where: { ...clientFilter, ...periodCreatedAt, status: 'confirmed' },
      }),
      this.prisma.booking.count({
        where: { ...clientFilter, ...periodCreatedAt, status: 'no_show' },
      }),
      this.prisma.booking.count({
        where: { ...clientFilter, ...periodCreatedAt, status: 'completed' },
      }),
      this.prisma.booking.count({
        where: {
          ...clientFilter,
          status: { in: ['pending', 'confirmed'] },
          startAt: { gte: now, lte: weekFromNow },
        },
      }),
      this.prisma.order.count({
        where: { ...clientFilter, ...periodCreatedAt, status: { not: 'draft' } },
      }),
      this.prisma.order.groupBy({
        by: ['status'],
        where: { ...clientFilter, ...periodCreatedAt, status: { not: 'draft' } },
        _count: { status: true },
      }),
      this.prisma.order.aggregate({
        where: {
          ...clientFilter,
          status: 'completed',
          ...(since ? { updatedAt: { gte: since, lte: until } } : {}),
        },
        _sum: { total: true },
      }),
    ]);

    const noShowBase = bookingNoShow + bookingCompleted;
    const bookings = {
      total: bookingTotal,
      confirmed: bookingConfirmed,
      noShowRate: noShowBase > 0 ? bookingNoShow / noShowBase : null,
      upcomingThisWeek: bookingUpcomingWeek,
    };
    const orders = {
      total: orderTotal,
      byStatus: Object.fromEntries(
        orderByStatus.map((r) => [r.status, r._count.status]),
      ),
      revenue: orderRevenue._sum.total ?? 0,
    };

    const response: Record<string, unknown> = {
      period: { since: since ?? null, until },
      totalConversations,
      activeConversations,
      resolvedConversations,
      humanHandoffs: handoffsInPeriod,
      handoffRate:
        totalConversations > 0 ? handoffsInPeriod / totalConversations : null,
      aiResolutionRate: aiResolution.rate,
      aiResolvedWithoutHandoff: aiResolution.withoutHandoff,
      totalMessages,
      topHandoffReasons,
      dailyVolume,
      avgResolutionTimeMinutes,
      avgHandoffResponseSeconds,
      csat,
      bookings,
      orders,
    };

    // Token counts and USD cost are provider-margin data — staff-only.
    // Portal users see their allowance balance (usage endpoint), never this.
    if (isStaff) {
      response.tokens = tokenUsage.tokens;
      response.estimatedCostUsd = tokenUsage.estimatedCostUsd;
    }

    return response;
  }

  /**
   * Date-range filter: today / 7d / 30d presets, or a custom from/to range.
   * No params = all-time (backwards compatible).
   */
  private resolvePeriod(
    range?: string,
    from?: string,
    to?: string,
  ): { since?: Date; until: Date } {
    const until = new Date();
    const startOfDay = (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x;
    };
    if (range === 'today') return { since: startOfDay(until), until };
    if (range === '7d' || range === '30d') {
      const days = range === '7d' ? 6 : 29;
      const since = startOfDay(until);
      since.setDate(since.getDate() - days);
      return { since, until };
    }
    if (from || to) {
      const since =
        from && !isNaN(Date.parse(from)) ? startOfDay(new Date(from)) : undefined;
      const end = to && !isNaN(Date.parse(to)) ? new Date(to) : until;
      end.setHours(23, 59, 59, 999);
      return { since, until: end };
    }
    return { since: undefined, until };
  }

  /** Raw-SQL date condition fragment for a quoted column name (hardcoded values only). */
  private dateCond(column: string, since?: Date, until?: Date): Prisma.Sql {
    let cond = Prisma.empty;
    if (since) {
      cond = Prisma.sql`${cond} AND ${Prisma.raw(column)} >= ${since}`;
    }
    if (until) {
      cond = Prisma.sql`${cond} AND ${Prisma.raw(column)} <= ${until}`;
    }
    return cond;
  }

  private clientCond(clientId: string | undefined, column: string): Prisma.Sql {
    return clientId
      ? Prisma.sql`AND ${Prisma.raw(column)} = ${clientId}`
      : Prisma.empty;
  }

  private async getHandoffCount(clientId?: string, since?: Date, until?: Date) {
    const rows = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count
      FROM handoff_logs h
      JOIN conversations c ON c.id = h."conversationId"
      WHERE 1=1
      ${this.clientCond(clientId, 'c."clientId"')}
      ${this.dateCond('h."createdAt"', since, until)}
    `;
    return Number(rows[0]?.count ?? 0);
  }

  private async getAiResolution(clientId?: string, since?: Date, until?: Date) {
    const rows = await this.prisma.$queryRaw<
      { total: bigint; without_handoff: bigint }[]
    >`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (
          WHERE NOT EXISTS (
            SELECT 1 FROM handoff_logs h WHERE h."conversationId" = c.id
          )
        ) AS without_handoff
      FROM conversations c
      WHERE c.status = 'resolved' AND c."resolvedAt" IS NOT NULL
      ${this.clientCond(clientId, 'c."clientId"')}
      ${this.dateCond('c."resolvedAt"', since, until)}
    `;
    const total = Number(rows[0]?.total ?? 0);
    const withoutHandoff = Number(rows[0]?.without_handoff ?? 0);
    return {
      total,
      withoutHandoff,
      rate: total > 0 ? withoutHandoff / total : null,
    };
  }

  private async getTopHandoffReasons(clientId?: string, since?: Date, until?: Date) {
    const rows = await this.prisma.$queryRaw<
      { reason: string | null; count: bigint }[]
    >`
      SELECT h."reason", COUNT(*) as count
      FROM handoff_logs h
      JOIN conversations c ON c.id = h."conversationId"
      WHERE h."reason" IS NOT NULL
      ${this.clientCond(clientId, 'c."clientId"')}
      ${this.dateCond('h."createdAt"', since, until)}
      GROUP BY h."reason"
      ORDER BY count DESC
      LIMIT 5
    `;
    return rows.map((r) => ({ reason: r.reason, count: Number(r.count) }));
  }

  private async getDailyVolume(clientId?: string, since?: Date, until?: Date) {
    const rows = await this.prisma.$queryRaw<
      { date: string; count: bigint }[]
    >`
      SELECT DATE("createdAt") as date, COUNT(*) as count
      FROM conversations
      WHERE 1=1
      ${this.clientCond(clientId, '"clientId"')}
      ${this.dateCond('"createdAt"', since, until)}
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;
    return rows.map((r) => ({ date: r.date, count: Number(r.count) }));
  }

  private async getAvgResolutionTimeMinutes(clientId?: string, since?: Date, until?: Date) {
    const rows = await this.prisma.$queryRaw<{ avg: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM ("resolvedAt" - "createdAt")) / 60) as avg
      FROM conversations
      WHERE status = 'resolved' AND "resolvedAt" IS NOT NULL
      ${this.clientCond(clientId, '"clientId"')}
      ${this.dateCond('"resolvedAt"', since, until)}
    `;
    const avg = rows[0]?.avg;
    return avg == null ? null : Math.round(avg * 10) / 10;
  }

  private async getAvgHandoffResponseSeconds(clientId?: string, since?: Date, until?: Date) {
    const rows = await this.prisma.$queryRaw<{ avg: number | null }[]>`
      SELECT AVG(h."responseTimeSeconds") as avg
      FROM handoff_logs h
      JOIN conversations c ON c.id = h."conversationId"
      WHERE h."responseTimeSeconds" IS NOT NULL
      ${this.clientCond(clientId, 'c."clientId"')}
      ${this.dateCond('h."createdAt"', since, until)}
    `;
    const avg = rows[0]?.avg;
    return avg == null ? null : Math.round(avg);
  }

  private async getCsatStats(clientId?: string, since?: Date, until?: Date) {
    const rows = await this.prisma.$queryRaw<
      { avg: number | null; count: bigint }[]
    >`
      SELECT AVG("csatRating") as avg, COUNT("csatRating") as count
      FROM conversations
      WHERE "csatRating" IS NOT NULL
      ${this.clientCond(clientId, '"clientId"')}
      ${this.dateCond('"resolvedAt"', since, until)}
    `;
    const row = rows[0];
    return {
      average: row?.avg == null ? null : Math.round(row.avg * 100) / 100,
      responses: Number(row?.count ?? 0),
    };
  }

  private async getTokenUsage(clientId?: string, since?: Date, until?: Date) {
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
      ${this.clientCond(clientId, 'c."clientId"')}
      ${this.dateCond('m."createdAt"', since, until)}
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
