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

/** Failovers within this window mean "currently serving via fallback". */
const DEGRADED_WINDOW_MS = 15 * 60 * 1000;

/**
 * AI provider visibility for staff: which model does what, failover status,
 * and per-model token usage. Costs and margins (financial data) are admin
 * ONLY — enforced by an explicit role check, since AdminGuard also allows
 * supervisors.
 */
@Controller('ai/providers')
@UseGuards(JwtAuthGuard)
export class AiProvidersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Get('status')
  async status(@CurrentUser() user: { role?: string }) {
    this.requireStaff(user);

    const get = (key: string) => this.configService.get<string>(key);
    const hostOf = (url: string) => {
      try {
        return new URL(url).host;
      } catch {
        return url;
      }
    };

    const aiKey = get('AI_API_KEY');
    const kimiUrl =
      get('KIMI_API_URL') || 'https://api.moonshot.cn/v1/chat/completions';
    const chatPrimary = {
      model:
        get('AI_MODEL') || get('KIMI_MODEL') || 'kimi-latest',
      provider: hostOf(get('AI_API_URL') || kimiUrl),
      isOverride: !!aiKey,
    };
    const fallback =
      aiKey && get('KIMI_API_KEY')
        ? {
            model: get('KIMI_MODEL') || 'kimi-latest',
            provider: hostOf(kimiUrl),
          }
        : null;

    const [lastFailover, recentEvents] = await Promise.all([
      this.prisma.aiFailoverEvent.findFirst({
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.aiFailoverEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const degraded =
      !!lastFailover &&
      Date.now() - lastFailover.createdAt.getTime() < DEGRADED_WINDOW_MS;

    return {
      chat: {
        primary: chatPrimary,
        fallback,
        failoverConfigured: !!fallback,
        serving: degraded ? 'fallback' : 'primary',
      },
      vision: {
        model:
          get('VISION_MODEL') ||
          get('KIMI_VISION_MODEL') ||
          'kimi-latest',
        provider: hostOf(
          get('VISION_API_URL') ||
            get('KIMI_API_URL') ||
            'https://api.moonshot.ai/v1/chat/completions',
        ),
      },
      whisper: {
        model: get('WHISPER_MODEL') || 'whisper-1',
        provider: hostOf(
          get('WHISPER_API_URL') ||
            'https://api.openai.com/v1/audio/transcriptions',
        ),
      },
      embeddings: {
        model: get('EMBEDDING_MODEL') || 'moonshot-v3-embedding',
        provider: hostOf(
          get('EMBEDDING_API_URL') || 'https://api.moonshot.ai/v1/embeddings',
        ),
      },
      lastFailover,
      recentEvents,
    };
  }

  @Get('usage')
  async usage(
    @CurrentUser() user: { role?: string },
    @Query('range') range?: string,
  ) {
    this.requireStaff(user);
    const since = this.resolveSince(range);

    const rows = await this.prisma.$queryRaw<
      {
        model: string | null;
        requests: bigint;
        prompt: number;
        completion: number;
        total: number;
      }[]
    >`
      SELECT
        m."kimiMetadata"->>'model' AS model,
        COUNT(*) AS requests,
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
      WHERE m."senderType" = 'bot'
        AND m."kimiMetadata"->>'model' IS NOT NULL
        ${since ? Prisma.sql`AND m."createdAt" >= ${since}` : Prisma.empty}
      GROUP BY m."kimiMetadata"->>'model'
      ORDER BY total DESC
    `;

    return rows.map((r) => ({
      model: r.model,
      requests: Number(r.requests),
      prompt: Number(r.prompt),
      completion: Number(r.completion),
      total: Number(r.total),
    }));
  }

  @Get('margins')
  async margins(
    @CurrentUser() user: { role?: string },
    @Query('range') range?: string,
  ) {
    // Financial data: owner only. Explicit check — AdminGuard also allows
    // supervisors, so it cannot be used here.
    if (user?.role !== 'admin') {
      throw new ForbiddenException('Margins are visible to the owner only');
    }
    const since = this.resolveSince(range);
    const prices = this.modelPrices();

    const rows = await this.prisma.$queryRaw<
      {
        clientId: string;
        clientName: string;
        model: string | null;
        conversations: bigint;
        requests: bigint;
        prompt: number;
        completion: number;
      }[]
    >`
      SELECT
        c."clientId" AS "clientId",
        cl."name" AS "clientName",
        m."kimiMetadata"->>'model' AS model,
        COUNT(DISTINCT c.id) AS conversations,
        COUNT(*) AS requests,
        COALESCE(SUM(CASE
          WHEN jsonb_typeof(m."kimiMetadata"->'usage') = 'object'
            AND (m."kimiMetadata"->'usage'->>'prompt_tokens') ~ '^[0-9]+$'
          THEN (m."kimiMetadata"->'usage'->>'prompt_tokens')::bigint ELSE 0 END), 0) AS prompt,
        COALESCE(SUM(CASE
          WHEN jsonb_typeof(m."kimiMetadata"->'usage') = 'object'
            AND (m."kimiMetadata"->'usage'->>'completion_tokens') ~ '^[0-9]+$'
          THEN (m."kimiMetadata"->'usage'->>'completion_tokens')::bigint ELSE 0 END), 0) AS completion
      FROM messages m
      JOIN conversations c ON c.id = m."conversationId"
      JOIN clients cl ON cl.id = c."clientId"
      WHERE m."senderType" = 'bot'
        ${since ? Prisma.sql`AND m."createdAt" >= ${since}` : Prisma.empty}
      GROUP BY c."clientId", cl."name", m."kimiMetadata"->>'model'
      ORDER BY cl."name" ASC
    `;

    // Fold per-model rows into per-client totals with per-model pricing
    const byClient = new Map<
      string,
      {
        clientId: string;
        clientName: string;
        conversations: number;
        requests: number;
        prompt: number;
        completion: number;
        estimatedCostUsd: number;
      }
    >();
    for (const r of rows) {
      const price = r.model ? prices[r.model] : undefined;
      const inputPrice =
        price?.in ??
        (parseFloat(
          this.configService.get<string>('AI_INPUT_PRICE_PER_1M_TOKENS') || '0',
        ) || 0);
      const outputPrice =
        price?.out ??
        (parseFloat(
          this.configService.get<string>('AI_OUTPUT_PRICE_PER_1M_TOKENS') ||
            '0',
        ) || 0);
      const prompt = Number(r.prompt);
      const completion = Number(r.completion);
      const cost =
        (prompt / 1_000_000) * inputPrice +
        (completion / 1_000_000) * outputPrice;

      const entry = byClient.get(r.clientId) ?? {
        clientId: r.clientId,
        clientName: r.clientName,
        conversations: 0,
        requests: 0,
        prompt: 0,
        completion: 0,
        estimatedCostUsd: 0,
      };
      entry.conversations += Number(r.conversations);
      entry.requests += Number(r.requests);
      entry.prompt += prompt;
      entry.completion += completion;
      entry.estimatedCostUsd += cost;
      byClient.set(r.clientId, entry);
    }

    return [...byClient.values()].map((e) => ({
      ...e,
      estimatedCostUsd: Math.round(e.estimatedCostUsd * 1_000_000) / 1_000_000,
    }));
  }

  /** Per-model USD prices per 1M tokens, from the AI_MODEL_PRICES JSON env. */
  private modelPrices(): Record<string, { in: number; out: number }> {
    try {
      const raw = this.configService.get<string>('AI_MODEL_PRICES');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private resolveSince(range?: string): Date | undefined {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : 0;
    if (!days) return undefined;
    const since = new Date();
    since.setDate(since.getDate() - days);
    return since;
  }

  private requireStaff(user: { role?: string }): void {
    if (!user || !STAFF_ROLES.includes(user.role || '')) {
      throw new ForbiddenException('Staff access required');
    }
  }
}
