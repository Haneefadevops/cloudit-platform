import { AgentConfig, AgentConfigService } from '../../src/config/agent-config.service';
import {
  BudgetService,
  DEFAULT_MODEL_RATES,
} from '../../src/platform/budget/budget.service';
import { ManualClock } from '../../src/platform/clock';

const BASE: AgentConfig = {
  aiEnabled: false,
  telegramCommandsEnabled: false,
  autoRemediationEnabled: false,
  repairMasterEnabled: false,
  aiMonthlyEurCeiling: 7,
  aiDailyCallMax: 10,
  operationsApiBaseUrl: 'http://127.0.0.1:3017',
  n8nApiBaseUrl: 'http://127.0.0.1:5678',
  syncScanIntervalMs: 900_000,
  telegram: {
    botToken: undefined,
    webhookSecret: undefined,
    allowedUserIds: [],
    allowedChatIds: [],
    maxBodyBytes: 65_536,
    maxCommandArgs: 8,
    rateLimitPerMinute: 20,
  },
  ai: {
    routineModel: 'gpt-5.6-luna',
    escalationModel: 'gpt-5.6-terra',
    requestTimeoutMs: 30_000,
    maxInputTokens: 8_000,
    maxOutputTokens: 1_000,
    maxEscalationsPerDay: 3,
  },
};

function makeBudget(overrides: Partial<AgentConfig> = {}, start = '2026-09-21T12:00:00.000Z') {
  const clock = new ManualClock(new Date(start));
  const config = { ...BASE, ...overrides };
  const service = new BudgetService(
    { get: () => ({ ...config }) } as AgentConfigService,
    { clock },
  );
  return { service, clock };
}

describe('BudgetService (Worker C)', () => {
  it('records usage within caps and keeps accurate ledger totals', () => {
    const { service } = makeBudget({ aiDailyCallMax: 3, aiMonthlyEurCeiling: 1 });
    for (let i = 0; i < 3; i += 1) {
      const decision = service.recordUsage({
        model: 'gpt-5.6-luna',
        tokensIn: 100,
        tokensOut: 50,
        estimatedEur: 0.1,
      });
      expect(decision.allowed).toBe(true);
    }
    const day = service.getDaySummary();
    expect(day.calls).toBe(3);
    expect(day.tokensIn).toBe(300);
    expect(day.tokensOut).toBe(150);
    expect(day.estimatedEur).toBeCloseTo(0.3, 6);
    expect(day.byModel['gpt-5.6-luna'].calls).toBe(3);
    const month = service.getMonthSummary();
    expect(month.estimatedEur).toBeCloseTo(0.3, 6);
    expect(service.getLedger().length).toBe(3);
  });

  it('denies further calls once the UTC-day cap is reached (fail closed)', () => {
    const { service } = makeBudget({ aiDailyCallMax: 2, aiMonthlyEurCeiling: 100 });
    expect(service.recordUsage({ model: 'm', tokensIn: 1, tokensOut: 1, estimatedEur: 0.01 }).allowed).toBe(true);
    expect(service.recordUsage({ model: 'm', tokensIn: 1, tokensOut: 1, estimatedEur: 0.01 }).allowed).toBe(true);
    const denied = service.recordUsage({ model: 'm', tokensIn: 1, tokensOut: 1, estimatedEur: 0.01 });
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) expect(denied.reason).toBe('DAILY_CALL_CAP_REACHED');
    // Denied calls are not recorded.
    expect(service.getLedger().length).toBe(2);
    expect(service.checkBudget().allowed).toBe(false);
  });

  it('denies further calls once the monthly EUR ceiling is reached (fail closed)', () => {
    const { service } = makeBudget({ aiDailyCallMax: 100, aiMonthlyEurCeiling: 1 });
    expect(service.recordUsage({ model: 'm', tokensIn: 1, tokensOut: 1, estimatedEur: 0.5 }).allowed).toBe(true);
    // 0.5 EUR recorded, ceiling 1 -> still allowed.
    expect(service.recordUsage({ model: 'm', tokensIn: 1, tokensOut: 1, estimatedEur: 0.5 }).allowed).toBe(true);
    const denied = service.recordUsage({ model: 'm', tokensIn: 1, tokensOut: 1, estimatedEur: 0.01 });
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) expect(denied.reason).toBe('MONTHLY_EUR_CEILING_REACHED');
    expect(service.getLedger().length).toBe(2);
  });

  it('derives the estimate from the constructor-injected rate table when omitted', () => {
    const { service } = makeBudget();
    const decision = service.recordUsage({ model: 'gpt-5.6-luna', tokensIn: 1_000_000, tokensOut: 1_000_000 });
    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      const rate = DEFAULT_MODEL_RATES['gpt-5.6-luna'];
      expect(decision.record.estimatedEur).toBeCloseTo(
        rate.inputEurPerMillionTokens + rate.outputEurPerMillionTokens,
        6,
      );
    }
  });

  it('rejects unpriced models and invalid usage input', () => {
    const { service } = makeBudget();
    const unknown = service.recordUsage({ model: 'unknown-model', tokensIn: 1, tokensOut: 1 });
    expect(unknown.allowed).toBe(false);
    if (!unknown.allowed) expect(unknown.reason).toBe('UNKNOWN_MODEL_RATE');

    const negative = service.recordUsage({ model: 'm', tokensIn: -1, tokensOut: 0, estimatedEur: 0 });
    expect(negative.allowed).toBe(false);
    if (!negative.allowed) expect(negative.reason).toBe('INVALID_USAGE');

    const nanEur = service.recordUsage({ model: 'm', tokensIn: 1, tokensOut: 1, estimatedEur: Number.NaN });
    expect(nanEur.allowed).toBe(false);

    expect(service.getLedger().length).toBe(0);
  });

  it('resets the daily count on the UTC-day boundary but keeps the monthly total', () => {
    const { service, clock } = makeBudget({ aiDailyCallMax: 1, aiMonthlyEurCeiling: 100 });
    expect(service.recordUsage({ model: 'm', tokensIn: 1, tokensOut: 1, estimatedEur: 0.4 }).allowed).toBe(true);
    expect(service.recordUsage({ model: 'm', tokensIn: 1, tokensOut: 1, estimatedEur: 0.4 }).allowed).toBe(false);

    clock.advance(12 * 60 * 60 * 1000); // 2026-09-22T00:00:00Z
    const check = service.checkBudget();
    expect(check.allowed).toBe(true);
    if (check.allowed) {
      expect(check.day.calls).toBe(0);
      expect(check.month.estimatedEur).toBeCloseTo(0.4, 6);
    }
    expect(service.recordUsage({ model: 'm', tokensIn: 1, tokensOut: 1, estimatedEur: 0.4 }).allowed).toBe(true);
    expect(service.getDaySummary().calls).toBe(1);
    expect(service.getMonthSummary().estimatedEur).toBeCloseTo(0.8, 6);
  });

  it('resets the monthly ceiling only on a UTC calendar-month boundary', () => {
    const { service, clock } = makeBudget({ aiDailyCallMax: 100, aiMonthlyEurCeiling: 1 });
    expect(service.recordUsage({ model: 'm', tokensIn: 1, tokensOut: 1, estimatedEur: 1 }).allowed).toBe(true);
    expect(service.recordUsage({ model: 'm', tokensIn: 1, tokensOut: 1, estimatedEur: 0.01 }).allowed).toBe(false);

    clock.advance(10 * 24 * 60 * 60 * 1000); // 2026-10-01T12:00:00Z
    const check = service.checkBudget();
    expect(check.allowed).toBe(true);
    if (check.allowed) {
      expect(check.month.month).toBe('2026-10');
      expect(check.month.estimatedEur).toBe(0);
    }
    // September history remains queryable for later portal display.
    expect(service.getMonthSummary('2026-09').estimatedEur).toBe(1);
    expect(service.recordUsage({ model: 'm', tokensIn: 1, tokensOut: 1, estimatedEur: 0.5 }).allowed).toBe(true);
  });

  it('raises the internal warning once month-to-date spend crosses the warning threshold', () => {
    const { service } = makeBudget({ aiMonthlyEurCeiling: 7 }, '2026-09-21T00:00:00.000Z');
    const first = service.recordUsage({ model: 'm', tokensIn: 1, tokensOut: 1, estimatedEur: 5 });
    expect(first.allowed).toBe(true);
    if (first.allowed) expect(first.warning).toBe(true);
    // Calls are still allowed below the ceiling; only the warning fires.
    expect(service.checkBudget().allowed).toBe(true);
  });
});
