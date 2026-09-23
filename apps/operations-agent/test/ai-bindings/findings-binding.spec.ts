import { AiFindingProjection } from '@cloudit/operations-agent-contracts';
import { findingsBinding, budgetSummaryBinding, killSwitchStatesBinding, driftBinding } from '../../src/ai-bindings';
import { defaultFindingsSource, AiMaintenanceReadModel } from '../../src/ai/read-model';
import { AgentConfig, AgentConfigService } from '../../src/config/agent-config.service';
import { BudgetService } from '../../src/platform/budget/budget.service';
import { ManualClock } from '../../src/platform/clock';
import { KillSwitchService } from '../../src/platform/kill-switch/kill-switch.service';

const FINDING: AiFindingProjection = {
  findingKey: 'wf:backup-stale',
  severity: 'warning',
  safeTitle: 'Workflow snapshot is stale',
  assessment: 'RED',
  confidence: 'HIGH',
  issueCode: 'WF_STALE_SNAPSHOT',
  recommendedRunbook: 'none',
  explainedAt: '2026-09-21T12:00:00.000Z',
  model: 'gpt-5.6-terra',
};

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

describe('findingsBinding', () => {
  it('passes the given source through unchanged', () => {
    const source = { list: () => [FINDING] };
    expect(findingsBinding(source)).toBe(source);
    expect(findingsBinding(source).list()).toEqual([FINDING]);
  });

  it('falls back to the fail-closed default (empty list) when no source is bound', () => {
    const bound = findingsBinding(undefined);
    expect(bound).not.toBeUndefined();
    expect(bound.list()).toEqual([]);
    expect(bound.list()).toEqual(defaultFindingsSource().list());
  });

  it('composes with the real bindings into a full AiMaintenanceReadModel projection', () => {
    const config = { get: () => ({ ...BASE }) } as AgentConfigService;
    const budget = new BudgetService(config, {
      clock: new ManualClock(new Date('2026-09-21T12:00:00.000Z')),
    });
    const readModel = new AiMaintenanceReadModel({
      findings: findingsBinding({ list: () => [FINDING] }),
      budget: budgetSummaryBinding(budget, config),
      killSwitches: killSwitchStatesBinding(new KillSwitchService(config)),
      drift: driftBinding(undefined),
      environmentKey: 'env-test',
      now: () => new Date('2026-09-21T12:00:00.000Z').getTime(),
    });
    const projection = readModel.getProjection();
    expect(projection.findings).toEqual([FINDING]);
    expect(projection.budget).toEqual({
      aiEnabled: false,
      dayCallsUsed: 0,
      dayCallsMax: 10,
      monthEurUsed: '0.000000',
      monthEurCeiling: 7,
    });
    expect(projection.killSwitches).toEqual({
      aiEnabled: false,
      telegramCommandsEnabled: false,
      autoRemediationEnabled: false,
      repairMasterEnabled: false,
    });
    expect(projection.drift).toEqual({ state: 'unknown', driftCount: 0, staleCount: 0, scannedAt: null });
  });
});
