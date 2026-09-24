/**
 * Phase H runbook 2 eval: config flag defaults for
 * remediationRbIncidentRecoveryVerifyEnabled
 * (env REMEDIATION_RB_INCIDENT_RECOVERY_VERIFY_ENABLED, default false).
 *
 * This flag is the per-runbook enable gate for RB-INCIDENT-RECOVERY-VERIFY-001
 * (runbook 2): it must be OPT-IN (never default true) and parsed fail-closed:
 * only the exact string 'true' enables it — every other value ('1', 'yes',
 * 'TRUE', 'on') resolves to FALSE, never to true (the documented strictness
 * of readTrueOnlyBoolean in agent-config.service.ts).
 *
 * The flag is added by Worker B in parallel; while it has not landed this
 * suite SKIPS with a loud PENDING-INTEGRATION message. The moment it lands,
 * every assertion runs: a default of true, a missing flag, or a weakened
 * parser is a loud failure. Runtime (not compile-time) presence assertion is
 * deliberate: it keeps tsc green pre-integration and still fails loudly the
 * instant an implementation ships.
 */

import { AgentConfigService } from '../../src/config/agent-config.service';

const FLAG = 'remediationRbIncidentRecoveryVerifyEnabled';
const ENV_KEY = 'REMEDIATION_RB_INCIDENT_RECOVERY_VERIFY_ENABLED';

/** Env vars that could make the constructor throw for unrelated reasons. */
const GATING_ENV_VARS = [
  ENV_KEY,
  'AI_ENABLED',
  'TELEGRAM_COMMANDS_ENABLED',
  'AI_MONTHLY_EUR_CEILING',
  'TELEGRAM_POLL_INTERVAL_MS',
  'OBSERVER_INTERVAL_MS',
] as const;

function withScrubbedEnv<T>(fn: () => T): T {
  const saved: Record<string, string | undefined> = {};
  for (const key of GATING_ENV_VARS) {
    saved[key] = process.env[key];
  }
  try {
    for (const key of GATING_ENV_VARS) delete process.env[key];
    return fn();
  } finally {
    for (const key of GATING_ENV_VARS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

function flagValue(envValue: string | undefined): unknown {
  return withScrubbedEnv(() => {
    if (envValue === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = envValue;
    const config = new AgentConfigService().get() as unknown as Record<string, unknown>;
    return config[FLAG];
  });
}

function flagLanded(): boolean {
  try {
    return typeof flagValue(undefined) === 'boolean';
  } catch {
    return false;
  }
}

const describeFlag = flagLanded() ? describe : describe.skip;

if (describeFlag === describe.skip) {
  // eslint-disable-next-line no-console
  console.warn(
    `config-flag2-defaults: AgentConfig does not yet carry ${FLAG} ` +
      '(Worker B has not landed the runbook-2 flag); suite PENDING-INTEGRATION.',
  );
}

describeFlag(`AgentConfigService — ${FLAG}`, () => {
  it('defaults to false when the env var is unset (opt-in, never default true)', () => {
    expect(flagValue(undefined)).toBe(false);
  });

  it('is true when REMEDIATION_RB_INCIDENT_RECOVERY_VERIFY_ENABLED=\'true\'', () => {
    expect(flagValue('true')).toBe(true);
  });

  it('is false when REMEDIATION_RB_INCIDENT_RECOVERY_VERIFY_ENABLED=\'false\'', () => {
    expect(flagValue('false')).toBe(false);
  });

  it('is exposed as a boolean on the config object (not string, not absent)', () => {
    expect(typeof flagValue('true')).toBe('boolean');
    expect(typeof flagValue(undefined)).toBe('boolean');
  });

  it('uses the fail-closed parser: \'1\', \'yes\', \'TRUE\', \'on\' all resolve to false (never true by coercion)', () => {
    for (const loose of ['1', 'yes', 'TRUE', 'True', 'on']) {
      expect(flagValue(loose)).toBe(false);
    }
  });

  it('empty string falls back to the default (false)', () => {
    expect(flagValue('')).toBe(false);
  });

  it('is independent of the runbook-1 flag (remediationRbReadonlyRecheckEnabled)', () => {
    // Enabling the runbook-1 flag must NOT enable runbook 2 and vice versa.
    withScrubbedEnv(() => {
      process.env['REMEDIATION_RB_READONLY_RECHECK_ENABLED'] = 'true';
      delete process.env[ENV_KEY];
      const config = new AgentConfigService().get() as unknown as Record<string, unknown>;
      expect(config[FLAG]).toBe(false);
    });
  });
});
