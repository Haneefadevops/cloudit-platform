import { AgentConfigService } from '../src/config/agent-config.service';

describe('AI adapter configuration (coordinator)', () => {
  const envKeys = [
    'AI_ROUTINE_MODEL',
    'AI_ESCALATION_MODEL',
    'AI_REQUEST_TIMEOUT_MS',
    'AI_MAX_INPUT_TOKENS',
    'AI_MAX_OUTPUT_TOKENS',
    'AI_MAX_ESCALATIONS_PER_DAY',
  ] as const;

  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const key of envKeys) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('defaults to documented model aliases and plan limits', () => {
    const ai = new AgentConfigService().get().ai;
    expect(ai.routineModel).toBe('gpt-5.6-luna');
    expect(ai.escalationModel).toBe('gpt-5.6-terra');
    expect(ai.maxEscalationsPerDay).toBe(3);
    expect(ai.maxOutputTokens).toBe(1_000);
  });

  it('rejects escalation/day and output-token limits above the plan caps', () => {
    process.env.AI_MAX_ESCALATIONS_PER_DAY = '11';
    expect(() => new AgentConfigService()).toThrow(/10/);

    delete process.env.AI_MAX_ESCALATIONS_PER_DAY;
    process.env.AI_MAX_OUTPUT_TOKENS = '5000';
    expect(() => new AgentConfigService()).toThrow(/2000/);
  });

  it('reads overrides from the environment', () => {
    process.env.AI_ROUTINE_MODEL = 'alias-routine';
    process.env.AI_REQUEST_TIMEOUT_MS = '5000';
    const ai = new AgentConfigService().get().ai;
    expect(ai.routineModel).toBe('alias-routine');
    expect(ai.requestTimeoutMs).toBe(5_000);
  });
});
