import { AgentConfigService } from '../../src/config/agent-config.service';

const KEY = 'REMEDIATION_RB_READONLY_RECHECK_ENABLED';

describe('AgentConfigService remediationRbReadonlyRecheckEnabled', () => {
  const saved = process.env[KEY];

  afterEach(() => {
    if (saved === undefined) delete process.env[KEY];
    else process.env[KEY] = saved;
  });

  it('defaults to false when the env var is absent', () => {
    delete process.env[KEY];
    const config = new AgentConfigService().get();
    expect(config.remediationRbReadonlyRecheckEnabled).toBe(false);
  });

  it('is true only on the exact value "true"', () => {
    process.env[KEY] = 'true';
    expect(new AgentConfigService().get().remediationRbReadonlyRecheckEnabled).toBe(true);
  });

  it.each([['1'], ['yes'], ['TRUE'], ['True'], ['false'], [' true']])(
    'resolves %p to false (fail closed, never throws)',
    (value) => {
      process.env[KEY] = value;
      expect(new AgentConfigService().get().remediationRbReadonlyRecheckEnabled).toBe(false);
    },
  );
});
