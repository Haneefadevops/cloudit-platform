import { AgentConfig, AgentConfigService } from '../../src/config/agent-config.service';
import {
  CAPABILITIES,
  Capability,
  KillSwitchDeniedError,
  KillSwitchService,
} from '../../src/platform/kill-switch/kill-switch.service';

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

function makeService(overrides: Partial<AgentConfig> = {}): KillSwitchService {
  return new KillSwitchService(stubConfig(overrides));
}

describe('KillSwitchService (Worker C)', () => {
  it('denies every capability by default (fail closed)', () => {
    const ks = makeService();
    for (const capability of CAPABILITIES) {
      const decision = ks.check(capability);
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) {
        expect(decision.message).toContain(capability);
        expect(decision.message).not.toMatch(/\n\s+at /); // no stack leakage
      }
    }
  });

  it.each<[Capability, Partial<AgentConfig>, Capability]>([
    ['ai', { aiEnabled: true }, 'ai'],
    ['telegram', { telegramCommandsEnabled: true }, 'telegram'],
    ['auto-remediation', { autoRemediationEnabled: true }, 'auto-remediation'],
  ])('allows %s only when its switch is on and never leaks other capabilities', (capability, overrides, allowedCapability) => {
    const ks = makeService(overrides);
    for (const c of CAPABILITIES) {
      const decision = ks.check(c);
      if (c === allowedCapability) {
        expect(decision).toEqual({ allowed: true, capability: c });
      } else {
        expect(decision.allowed).toBe(false);
      }
    }
  });

  it('repair requires BOTH repairMasterEnabled and autoRemediationEnabled', () => {
    // repairMaster alone is not enough
    expect(makeService({ repairMasterEnabled: true }).check('repair').allowed).toBe(false);
    // autoRemediation alone is not enough
    expect(makeService({ autoRemediationEnabled: true }).check('repair').allowed).toBe(false);
    // both switches on -> allowed, including the independent emergency switch chain
    const both = makeService({ repairMasterEnabled: true, autoRemediationEnabled: true });
    expect(both.check('repair')).toEqual({ allowed: true, capability: 'repair' });
    // denial reason distinguishes which switch blocked
    const denied = makeService({ repairMasterEnabled: true }).check('repair');
    if (!denied.allowed) expect(denied.reason).toBe('AUTO_REMEDIATION_DISABLED');
  });

  it('assertCanRun throws a typed, safe denial error', () => {
    const ks = makeService();
    let thrown: unknown;
    try {
      ks.assertCanRun('ai');
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(KillSwitchDeniedError);
    const denial = thrown as KillSwitchDeniedError;
    expect(denial.code).toBe('KILL_SWITCH_DENIED');
    expect(denial.capability).toBe('ai');
    expect(denial.reason).toBe('AI_DISABLED');
    expect(denial.message).not.toMatch(/\n\s+at /);
    expect(denial.message).toContain('"ai"');

    expect(() => makeService({ aiEnabled: true }).assertCanRun('ai')).not.toThrow();
  });

  it('denial messages never contain stack traces or raw config dumps', () => {
    const ks = makeService();
    for (const capability of CAPABILITIES) {
      const decision = ks.check(capability);
      if (!decision.allowed) {
        expect(decision.message.split('\n').length).toBe(1);
        expect(decision.message.length).toBeLessThan(200);
      }
    }
  });
});
