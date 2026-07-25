import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UsageInfo {
  balance: number; // conversations left right now
  used: number; // conversations with an AI/bot reply this period
  planAllowance: number; // plan conversations per period
  topUpCredits: number; // prepaid credits (roll over)
  allowanceRemaining: number; // plan allowance left this period
  topUpRemaining: number; // top-up credits left
  remainingPct: number; // 0..1 of (planAllowance + topUpCredits)
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Usage wallet: each client has a monthly plan allowance of AI conversations
 * plus prepaid top-up credits that roll over. Counting unit: a conversation
 * with at least one AI/bot reply in the current period = 1 credit.
 *
 * Balance = planAllowance + topUpCredits − used-this-period.
 * Monthly reset advances usageResetAt; topUpCredits are never touched.
 */
@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  addMonths(date: Date, months: number): Date {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  }

  /**
   * Advances usageResetAt to the start of the current monthly period when it
   * has elapsed (first activity of a new period). Top-up credits roll over —
   * they are paid for and never reset.
   */
  async maybeAdvancePeriod(clientId: string, now: Date = new Date()) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) return null;

    let resetAt = client.usageResetAt;
    let changed = false;
    while (this.addMonths(resetAt, 1) <= now) {
      resetAt = this.addMonths(resetAt, 1);
      changed = true;
    }
    if (!changed) return client;

    return this.prisma.client.update({
      where: { id: clientId },
      data: { usageResetAt: resetAt },
    });
  }

  /** Conversations with at least one bot reply since `since` (1 credit each). */
  async countUsed(clientId: string, since: Date): Promise<number> {
    return this.prisma.conversation.count({
      where: {
        clientId,
        messages: { some: { senderType: 'bot', createdAt: { gte: since } } },
      },
    });
  }

  async getUsage(
    clientId: string,
    now: Date = new Date(),
  ): Promise<UsageInfo | null> {
    const client = await this.maybeAdvancePeriod(clientId, now);
    if (!client) return null;

    const used = await this.countUsed(clientId, client.usageResetAt);
    const total = client.planAllowance + client.topUpCredits;
    const balance = Math.max(0, total - used);
    const allowanceUsed = Math.min(used, client.planAllowance);
    const topUpUsed = Math.min(
      client.topUpCredits,
      Math.max(0, used - client.planAllowance),
    );

    return {
      balance,
      used,
      planAllowance: client.planAllowance,
      topUpCredits: client.topUpCredits,
      allowanceRemaining: client.planAllowance - allowanceUsed,
      topUpRemaining: client.topUpCredits - topUpUsed,
      remainingPct: total > 0 ? balance / total : 0,
      periodStart: client.usageResetAt,
      periodEnd: this.addMonths(client.usageResetAt, 1),
    };
  }

  /** Staff records a confirmed manual payment: credits + purchase history. */
  async topUp(
    clientId: string,
    data: { credits: number; priceLkr: number; note?: string },
  ) {
    if (!data.credits || data.credits <= 0) {
      throw new BadRequestException('credits must be a positive number');
    }
    if (data.priceLkr == null || data.priceLkr < 0) {
      throw new BadRequestException('priceLkr must be zero or positive');
    }
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) throw new NotFoundException('Client not found');

    const [purchase] = await this.prisma.$transaction([
      this.prisma.topUpPurchase.create({
        data: {
          clientId,
          credits: data.credits,
          priceLkr: data.priceLkr,
          note: data.note,
        },
      }),
      this.prisma.client.update({
        where: { id: clientId },
        data: { topUpCredits: { increment: data.credits } },
      }),
    ]);
    return purchase;
  }

  listTopUps(clientId: string) {
    return this.prisma.topUpPurchase.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
