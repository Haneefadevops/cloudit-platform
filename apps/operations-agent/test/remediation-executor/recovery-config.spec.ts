import { AgentConfigService } from '../../src/config/agent-config.service';

const KEY = 'REMEDIATION_RB_INCIDENT_RECOVERY_VERIFY_ENABLED';

describe('AgentConfigService remediationRbIncidentRecoveryVerifyEnabled', () => {
  const saved = process.env[KEY];

  afterEach(() => {
    if (saved === undefined) delete process.env[KEY];
    else process.env[KEY] = saved;
  });

  it('defaults to false when the env var is absent', () => {
    delete process.env[KEY];
    const config = new AgentConfigService().get();
    expect(config.remediationRbIncidentRecoveryVerifyEnabled).toBe(false);
  });

  it('is true only on the exact value "true"', () => {
    process.env[KEY] = 'true';
    expect(new AgentConfigService().get().remediationRbIncidentRecoveryVerifyEnabled).toBe(true);
  });

  it.each([['1'], ['yes'], ['TRUE'], ['True'], ['false'], [' true'], ['on']])(
    'resolves %p to false (fail closed, never throws)',
    (value) => {
      process.env[KEY] = value;
      expect(new AgentConfigService().get().remediationRbIncidentRecoveryVerifyEnabled).toBe(
        false,
      );
    },
  );

  it('is independent of the readonly-recheck flag', () => {
    delete process.env[KEY];
    process.env.REMEDIATION_RB_READONLY_RECHECK_ENABLED = 'true';
    try {
      const config = new AgentConfigService().get();
      expect(config.remediationRbReadonlyRecheckEnabled).toBe(true);
      expect(config.remediationRbIncidentRecoveryVerifyEnabled).toBe(false);
    } finally {
      delete process.env.REMEDIATION_RB_READONLY_RECHECK_ENABLED;
    }
  });
});
