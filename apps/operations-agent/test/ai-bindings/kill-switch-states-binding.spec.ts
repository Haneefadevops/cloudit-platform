import { AgentConfig, AgentConfigService } from '../../src/config/agent-config.service';
import { killSwitchStatesBinding } from '../../src/ai-bindings';
import { KillSwitchService } from '../../src/platform/kill-switch/kill-switch.service';

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
  },
};

function makeKillSwitches(overrides: Partial<AgentConfig> = {}): KillSwitchService {
  const config = { ...BASE, ...overrides };
  return new KillSwitchService({ get: () => ({ ...config }) } as AgentConfigService);
}

describe('killSwitchStatesBinding', () => {
  it('maps all four capability gates to the exact port shape when everything is enabled', () => {
    const port = killSwitchStatesBinding(
      makeKillSwitches({
        aiEnabled: true,
        telegramCommandsEnabled: true,
        autoRemediationEnabled: true,
        repairMasterEnabled: true,
      }),
    );
    expect(port.states()).toEqual({
      aiEnabled: true,
      telegramCommandsEnabled: true,
      autoRemediationEnabled: true,
      repairMasterEnabled: true,
    });
  });

  it('reports all false under the fail-closed default config', () => {
    const port = killSwitchStatesBinding(makeKillSwitches());
    expect(port.states()).toEqual({
      aiEnabled: false,
      telegramCommandsEnabled: false,
      autoRemediationEnabled: false,
      repairMasterEnabled: false,
    });
  });

  it('reflects the enforced repair gate: repair-master on but remediation off denies repair', () => {
    const port = killSwitchStatesBinding(
      makeKillSwitches({ aiEnabled: true, repairMasterEnabled: true }),
    );
    expect(port.states()).toEqual({
      aiEnabled: true,
      telegramCommandsEnabled: false,
      autoRemediationEnabled: false,
      repairMasterEnabled: false,
    });
  });

  it('reads config at call time', () => {
    const config = { ...BASE, aiEnabled: false };
    const service = new KillSwitchService({ get: () => ({ ...config }) } as AgentConfigService);
    const port = killSwitchStatesBinding(service);
    expect(port.states().aiEnabled).toBe(false);
    config.aiEnabled = true;
    expect(port.states().aiEnabled).toBe(true);
  });
});
