import { TierARemediationExecutor } from '../../src/remediation/executor';
import type { RemediationExecutionResult } from '../../src/remediation/executor';
import { REMEDIATION_EXECUTION_OUTCOMES } from '../../src/remediation/executor';
import { RECOVERY_VERIFY_RUNBOOK_KEY } from '../../src/remediation/executor';
import {
  FakeAttemptStore,
  FakeCircuit,
  FakeEvidence,
  killSwitchOf,
  makeClock,
  makeRequest,
  ManualTimer,
} from './fakes';

const OUTCOMES: RemediationExecutionResult['outcome'][] = [...REMEDIATION_EXECUTION_OUTCOMES];

function recoveryRequest(overrides: Record<string, unknown> = {}) {
  return makeRequest({
    runbookKey: RECOVERY_VERIFY_RUNBOOK_KEY,
    issueCode: 'SOURCE_FAILED',
    targetKey: 'EVIDENCE_STALE',
    ...overrides,
  } as never);
}

describe('Tier A executor never-throws — recovery-verify runbook', () => {
  it('every adversarial request shape returns a closed outcome, never rejects', async () => {
    const store = new FakeAttemptStore();
    const circuit = new FakeCircuit();
    const timer = new ManualTimer();
    const executor = new TierARemediationExecutor({
      attemptStore: store,
      evidence: FakeEvidence.ok(),
      killSwitch: killSwitchOf({ allowed: true, capability: 'auto-remediation' }),
      runbookEnabled: () => true,
      recoveryVerifyEnabled: () => true,
      now: makeClock().now,
      setTimeoutFn: timer.setTimeoutFn,
      clearTimeoutFn: timer.clearTimeoutFn,
      circuit,
    });

    const results: RemediationExecutionResult[] = [];
    for (const patch of [
      { runbookKey: null },
      { runbookVersion: undefined },
      { issueCode: 42 },
      { targetKey: {} },
      { idempotencyDayUtc: '99999999' },
      { clientKey: '' },
      { nowMs: Number.NaN },
      { proposalId: 'x'.repeat(10_000) },
      { evidenceKeys: 'not-an-array' },
      { evidenceKeys: [undefined] },
      { evidenceKeys: { length: 1 } },
    ]) {
      results.push(await executor.execute(recoveryRequest(patch)));
    }

    for (const result of results) {
      expect(OUTCOMES).toContain(result.outcome);
      expect(typeof result.summary).toBe('string');
      expect(result.summary.length).toBeLessThanOrEqual(200);
    }
  });

  it('hostile dependencies throwing on every call still resolve to closed outcomes', async () => {
    const results: RemediationExecutionResult[] = [];
    results.push(
      await new TierARemediationExecutor({
        attemptStore: new FakeAttemptStore(),
        evidence: FakeEvidence.ok(),
        killSwitch: {
          check: () => {
            throw new Error('fake kill switch fault');
          },
        },
        runbookEnabled: () => true,
        recoveryVerifyEnabled: () => {
          throw new Error('fake recovery flag fault');
        },
        now: makeClock().now,
        setTimeoutFn: new ManualTimer().setTimeoutFn,
        clearTimeoutFn: new ManualTimer().clearTimeoutFn,
      }).execute(recoveryRequest()),
    );

    const store = new FakeAttemptStore();
    const executor = new TierARemediationExecutor({
      attemptStore: store,
      evidence: new FakeEvidence({ kind: 'reject', error: new Error('boom') }),
      killSwitch: killSwitchOf({ allowed: true, capability: 'auto-remediation' }),
      runbookEnabled: () => true,
      recoveryVerifyEnabled: () => true,
      audit: {
        record: () => {
          throw new Error('audit boom');
        },
      },
      now: () => {
        throw new Error('clock boom');
      },
      attemptIdFactory: () => {
        throw new Error('id boom');
      },
    });
    results.push(await executor.execute(recoveryRequest()));

    const badStore = new FakeAttemptStore();
    badStore.failNext('finish');
    const timer = new ManualTimer();
    const hangingExecutor = new TierARemediationExecutor({
      attemptStore: badStore,
      evidence: new FakeEvidence({ kind: 'hang' }),
      killSwitch: killSwitchOf({ allowed: true, capability: 'auto-remediation' }),
      runbookEnabled: () => true,
      recoveryVerifyEnabled: () => true,
      now: makeClock().now,
      setTimeoutFn: timer.setTimeoutFn,
      clearTimeoutFn: timer.clearTimeoutFn,
    });
    const pending = hangingExecutor.execute(recoveryRequest());
    for (let i = 0; i < 10 && timer.scheduled.length === 0; i += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(timer.scheduled.length).toBeGreaterThan(0);
    timer.fireNext();
    results.push(await pending);

    for (const result of results) {
      expect(OUTCOMES).toContain(result.outcome);
      expect(result.summary.length).toBeLessThanOrEqual(200);
    }
  });

  it('survives a randomized sequence of mixed recovery requests', async () => {
    let seed = 29;
    const rand = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    const store = new FakeAttemptStore();
    const circuit = new FakeCircuit();
    const timer = new ManualTimer();
    const statuses = ['OK', 'DEGRADED', 'UNKNOWN', 'FAILED'];
    const days = ['2026-11-02', '2026-11-03', '2026-11-04'];
    const subjects = ['EVIDENCE_STALE', 'SOURCE_FAILED', 'STATUS_UNKNOWN'];

    const executor = new TierARemediationExecutor({
      attemptStore: store,
      evidence: {
        read: (_clientKey: string, _environmentKey: string) => {
          const r = rand();
          if (r < 0.15) return Promise.reject(new Error('random read fault'));
          const status = statuses[Math.floor(rand() * statuses.length)];
          return Promise.resolve({
            client: 'client-a',
            environment: 'env-test',
            records: [
              {
                sourceKey: 'vercel-analytics',
                status,
                severity: 'warning',
                observedAt: '2026-11-02T12:00:00.000Z',
                freshUntil: '2026-11-02T12:01:00.000Z',
                criticality: 'analytics',
                safeSummary: 'vercel-analytics sample',
                counts: { samples: 1 },
              },
            ],
          });
        },
      },
      killSwitch: killSwitchOf({ allowed: true, capability: 'auto-remediation' }),
      runbookEnabled: () => rand() > 0.2,
      recoveryVerifyEnabled: () => rand() > 0.2,
      now: makeClock().now,
      setTimeoutFn: timer.setTimeoutFn,
      clearTimeoutFn: timer.clearTimeoutFn,
      circuit,
    });

    for (let i = 0; i < 120; i += 1) {
      const result = await executor.execute(
        recoveryRequest({
          targetKey: subjects[Math.floor(rand() * subjects.length)],
          idempotencyDayUtc: days[Math.floor(rand() * days.length)],
          nowMs: 1_760_000_000_000 + i,
          evidenceKeys: rand() > 0.5 ? ['vercel-analytics'] : [],
        }),
      );
      expect(OUTCOMES).toContain(result.outcome);
      expect(result.summary.length).toBeLessThanOrEqual(200);
    }
  });
});
