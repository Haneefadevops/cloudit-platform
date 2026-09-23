/**
 * Budget meter enforcing operator-plan section 8.3:
 *
 * - maximum AI requests per UTC day (aiDailyCallMax from AgentConfigService);
 * - monthly EUR ceiling (aiMonthlyEurCeiling from AgentConfigService, itself
 *   capped at the EUR 15 owner budget);
 * - internal warning at a configurable EUR threshold (plan: EUR 5).
 *
 * Enforcement is fail closed: when either cap is reached, further calls are
 * denied and nothing is recorded. Usage is kept in an in-memory per-UTC-day
 * ledger - the offline stand-in for the `ai_usage_daily` table - and usage
 * summaries are exposed for later portal display.
 *
 * estimatedEur is caller-supplied; when omitted the meter derives the estimate
 * from a constructor-injected rate table. A model that is neither priced in
 * the rate table nor supplied with an explicit estimate is rejected, so
 * unpriced usage can never slip past the ceiling.
 */

import { Injectable, Optional } from '@nestjs/common';
import { buildVerifiedEurRateTable } from '../../ai/pricing';
import { AgentConfigService } from '../../config/agent-config.service';
import { Clock, SystemClock, utcDayKey, utcMonthKey } from '../clock';

export interface ModelRate {
  /** EUR price per 1M input tokens. */
  readonly inputEurPerMillionTokens: number;
  /** EUR price per 1M output tokens. */
  readonly outputEurPerMillionTokens: number;
}

export type ModelRateTable = Readonly<Record<string, ModelRate>>;

/**
 * Default rate table.
 *
 * Derived from the verified provider pricing snapshot (ai/pricing.ts):
 * official USD prices per 1M tokens converted at the configured USD→EUR FX
 * rate. Per operator-plan 8.2 the snapshot is pinned at phase preparation
 * (September 2026) and must be reverified before any live enablement; the FX
 * rate is configurable (AI_FX_USD_TO_EUR), not hard-coded history.
 */
export const DEFAULT_MODEL_RATES: ModelRateTable = buildVerifiedEurRateTable();

export interface BudgetServiceOptions {
  /**
   * Constructor-injected rate table; defaults to the verified-derived table
   * at the runtime-configured FX rate (config.ai.fxUsdToEur).
   */
  readonly rates?: ModelRateTable;
  /** Injectable clock; defaults to SystemClock. */
  readonly clock?: Clock;
  /** Internal warning threshold in EUR (operator plan: EUR 5). */
  readonly warnAtEur?: number;
}

export interface UsageRecord {
  readonly day: string;
  readonly month: string;
  readonly model: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly estimatedEur: number;
  readonly recordedAt: string;
}

export interface UsageTotals {
  readonly calls: number;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly estimatedEur: number;
}

export interface DaySummary extends UsageTotals {
  readonly day: string;
  readonly byModel: Readonly<Record<string, UsageTotals>>;
}

export interface MonthSummary extends UsageTotals {
  readonly month: string;
}

export type BudgetDenialReason =
  | 'DAILY_CALL_CAP_REACHED'
  | 'MONTHLY_EUR_CEILING_REACHED'
  | 'UNKNOWN_MODEL_RATE'
  | 'INVALID_USAGE';

export type BudgetCheck =
  | {
      readonly allowed: true;
      readonly day: DaySummary;
      readonly month: MonthSummary;
      /** True when month-to-date spend reached the warning threshold. */
      readonly warning: boolean;
    }
  | {
      readonly allowed: false;
      readonly reason: BudgetDenialReason;
      /** Fixed safe message; contains no config internals or stack trace. */
      readonly message: string;
    };

export type BudgetDecision =
  | (Extract<BudgetCheck, { allowed: true }> & { readonly record: UsageRecord })
  | Extract<BudgetCheck, { allowed: false }>;

export interface UsageInput {
  readonly model: string;
  readonly tokensIn: number;
  readonly tokensOut: number;
  /** Caller-supplied EUR estimate; derived from the rate table when omitted. */
  readonly estimatedEur?: number;
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

@Injectable()
export class BudgetService {
  private readonly rates: ModelRateTable;
  private readonly clock: Clock;
  private readonly warnAtEur: number;
  private readonly ledger: UsageRecord[] = [];

  constructor(
    private readonly config: AgentConfigService,
    @Optional() options?: BudgetServiceOptions,
  ) {
    this.rates = options?.rates ?? buildVerifiedEurRateTable(config.get().ai.fxUsdToEur);
    this.clock = options?.clock ?? new SystemClock();
    this.warnAtEur = options?.warnAtEur ?? 5;
  }

  /**
   * Records one AI call. Fails closed: invalid input, an unpriced model, or a
   * reached cap denies the call and records nothing.
   */
  recordUsage(input: UsageInput): BudgetDecision {
    const estimate = this.resolveEstimate(input);
    if (!estimate.ok) {
      return estimate.decision;
    }
    const budget = this.checkBudget();
    if (!budget.allowed) {
      return budget;
    }
    const now = this.clock.now();
    const record: UsageRecord = Object.freeze({
      day: utcDayKey(now),
      month: utcMonthKey(now),
      model: input.model,
      tokensIn: input.tokensIn,
      tokensOut: input.tokensOut,
      estimatedEur: estimate.value,
      recordedAt: now.toISOString(),
    });
    this.ledger.push(record);
    const month = this.getMonthSummary(record.month);
    return {
      allowed: true,
      record,
      day: this.getDaySummary(record.day),
      month,
      warning: month.estimatedEur >= this.warnAtEur,
    };
  }

  /**
   * Current budget state. Denies (fail closed) when the UTC-day call count has
   * reached aiDailyCallMax or month-to-date EUR has reached the ceiling.
   */
  checkBudget(): BudgetCheck {
    const c = this.config.get();
    const day = this.getDaySummary();
    const month = this.getMonthSummary();
    if (day.calls >= c.aiDailyCallMax) {
      return this.deny('DAILY_CALL_CAP_REACHED');
    }
    if (month.estimatedEur >= c.aiMonthlyEurCeiling) {
      return this.deny('MONTHLY_EUR_CEILING_REACHED');
    }
    return { allowed: true, day, month, warning: month.estimatedEur >= this.warnAtEur };
  }

  getDaySummary(day: string = utcDayKey(this.clock.now())): DaySummary {
    const byModel = new Map<string, { calls: number; tokensIn: number; tokensOut: number; estimatedEur: number }>();
    let calls = 0;
    let tokensIn = 0;
    let tokensOut = 0;
    let estimatedEur = 0;
    for (const r of this.ledger) {
      if (r.day !== day) continue;
      calls += 1;
      tokensIn += r.tokensIn;
      tokensOut += r.tokensOut;
      estimatedEur = round6(estimatedEur + r.estimatedEur);
      const m = byModel.get(r.model) ?? { calls: 0, tokensIn: 0, tokensOut: 0, estimatedEur: 0 };
      byModel.set(r.model, {
        calls: m.calls + 1,
        tokensIn: m.tokensIn + r.tokensIn,
        tokensOut: m.tokensOut + r.tokensOut,
        estimatedEur: round6(m.estimatedEur + r.estimatedEur),
      });
    }
    return Object.freeze({
      day,
      calls,
      tokensIn,
      tokensOut,
      estimatedEur,
      byModel: Object.freeze(Object.fromEntries(byModel)),
    });
  }

  getMonthSummary(month: string = utcMonthKey(this.clock.now())): MonthSummary {
    let calls = 0;
    let tokensIn = 0;
    let tokensOut = 0;
    let estimatedEur = 0;
    for (const r of this.ledger) {
      if (r.month !== month) continue;
      calls += 1;
      tokensIn += r.tokensIn;
      tokensOut += r.tokensOut;
      estimatedEur = round6(estimatedEur + r.estimatedEur);
    }
    return Object.freeze({ month, calls, tokensIn, tokensOut, estimatedEur });
  }

  /** Read-only copy of the full ledger for later portal display. */
  getLedger(): readonly UsageRecord[] {
    return Object.freeze([...this.ledger]);
  }

  private resolveEstimate(
    input: UsageInput,
  ):
    | { ok: true; value: number }
    | { ok: false; decision: Extract<BudgetCheck, { allowed: false }> } {
    if (
      typeof input.model !== 'string' ||
      input.model.length === 0 ||
      input.model.length > 64 ||
      !Number.isInteger(input.tokensIn) ||
      input.tokensIn < 0 ||
      !Number.isInteger(input.tokensOut) ||
      input.tokensOut < 0
    ) {
      return { ok: false, decision: this.deny('INVALID_USAGE') };
    }
    if (input.estimatedEur !== undefined) {
      if (!Number.isFinite(input.estimatedEur) || input.estimatedEur < 0) {
        return { ok: false, decision: this.deny('INVALID_USAGE') };
      }
      return { ok: true, value: round6(input.estimatedEur) };
    }
    const rate = this.rates[input.model];
    if (!rate) {
      return { ok: false, decision: this.deny('UNKNOWN_MODEL_RATE') };
    }
    return {
      ok: true,
      value: round6(
        (input.tokensIn / 1_000_000) * rate.inputEurPerMillionTokens +
          (input.tokensOut / 1_000_000) * rate.outputEurPerMillionTokens,
      ),
    };
  }

  private deny(reason: BudgetDenialReason): Extract<BudgetCheck, { allowed: false }> {
    return { allowed: false, reason, message: `AI call denied by budget control (${reason})` };
  }
}
