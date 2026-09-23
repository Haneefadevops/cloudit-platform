import { AgentConfig, AgentConfigService } from '../../src/config/agent-config.service';
import { budgetSummaryBinding } from '../../src/ai-bindings';
import { BudgetService } from '../../src/platform/budget/budget.service';
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
    pollIntervalMs: 10_000,
  },
  ai: {
    routineModel: 'gpt-5.6-luna',
    escalationModel: 'gpt-5.6-terra',
    requestTimeoutMs: 30_000,
    maxInputTokens: 8_000,
    maxOutputTokens: 1_000,
    maxEscalationsPerDay: 3,
    providerApiKey: undefined,
    providerBaseUrl: 'https://api.openai.com',
    fxUsdToEur: 0.85,
  },
};

function stubConfig(overrides: Partial<AgentConfig> = {}): AgentConfigService {
  const config = { ...BASE, ...overrides };
  return { get: () => ({ ...config }) } as AgentConfigService;
}

function makeBudget(
  overrides: Partial<AgentConfig> = {},
  start = '2026-09-21T12:00:00.000Z',
): { service: BudgetService; config: AgentConfigService } {
  const config = stubConfig(overrides);
  const service = new BudgetService(config, { clock: new ManualClock(new Date(start)) });
  return { service, config };
}

describe('budgetSummaryBinding', () => {
  it('maps BudgetService day/month summaries and config caps to the exact port shape', () => {
    const { service, config } = makeBudget({ aiEnabled: true, aiDailyCallMax: 5, aiMonthlyEurCeiling: 2 });
    service.recordUsage({ model: 'gpt-5.6-luna', tokensIn: 1_000, tokensOut: 500, estimatedEur: 0.123456789 });
    service.recordUsage({ model: 'gpt-5.6-luna', tokensIn: 2_000, tokensOut: 1_000, estimatedEur: 0.1 });

    const summary = budgetSummaryBinding(service, config).summary();
    expect(summary).toEqual({
      aiEnabled: true,
      dayCallsUsed: 2,
      dayCallsMax: 5,
      monthEurUsed: '0.223457',
      monthEurCeiling: 2,
    });
  });

  it('formats month EUR with exactly six decimal places, including zero usage', () => {
    const { service, config } = makeBudget();
    const summary = budgetSummaryBinding(service, config).summary();
    expect(summary.monthEurUsed).toBe('0.000000');
    expect(summary.dayCallsUsed).toBe(0);
  });

  it('reads aiEnabled and caps from config, not from budget state', () => {
    const { service, config } = makeBudget({ aiDailyCallMax: 3, aiMonthlyEurCeiling: 1 });
    service.recordUsage({ model: 'gpt-5.6-luna', tokensIn: 100, tokensOut: 50, estimatedEur: 0.05 });
    const summary = budgetSummaryBinding(service, config).summary();
    expect(summary.aiEnabled).toBe(false);
    expect(summary.dayCallsMax).toBe(3);
    expect(summary.monthEurCeiling).toBe(1);
  });

  it('is read-only: calling summary() does not record usage', () => {
    const { service, config } = makeBudget();
    const port = budgetSummaryBinding(service, config);
    port.summary();
    port.summary();
    expect(service.getLedger()).toHaveLength(0);
    expect(port.summary().dayCallsUsed).toBe(0);
  });
});
