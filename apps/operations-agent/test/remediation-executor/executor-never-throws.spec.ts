import { TierARemediationExecutor } from '../../src/remediation/executor';
import type { RemediationExecutionResult } from '../../src/remediation/executor';
import { REMEDIATION_EXECUTION_OUTCOMES } from '../../src/remediation/executor';
import {
  FakeAttemptStore,
  FakeCircuit,
  FakeEvidence,
  killSwitchOf,
  makeClock,
  makeProjection,
  makeRequest,
  ManualTimer,
  TARGET,
} from './fakes';

const OUTCOMES: RemediationExecutionResult['outcome'][] = [...REMEDIATION_EXECUTION_OUTCOMES];

function adversarialExecutor(store: FakeAttemptStore, evidence: FakeEvidence) {
  return new TierARemediationExecutor({
    attemptStore: store,
    evidence,
    killSwitch: {
      check: () => {
        throw new Error('fake kill switch fault');
      },
    },
    runbookEnabled: () => {
      throw new Error('fake flag fault');
    },
    now: makeClock().now,
    setTimeoutFn: new ManualTimer().setTimeoutFn,
    clearTimeoutFn: new ManualTimer().clearTimeoutFn,
  });
}

describe('Tier A executor never-throws property pass', () => {
  it('every gate and path returns a closed outcome, never rejects', async () => {
    const store = new FakeAttemptStore();
    const circuit = new FakeCircuit();
    const timer = new ManualTimer();
    const executor = new TierARemediationExecutor({
      attemptStore: store,
      evidence: FakeEvidence.ok(),
      killSwitch: killSwitchOf({ allowed: true, capability: 'auto-remediation' }),
      runbookEnabled: () => true,
      now: makeClock().now,
      setTimeoutFn: timer.setTimeoutFn,
      clearTimeoutFn: timer.clearTimeoutFn,
      circuit,
    });

    const results: RemediationExecutionResult[] = [];
    // Adversarial request shapes (never typed-trusted at the boundary).
    for (const patch of [
      { runbookKey: null },
      { runbookVersion: undefined },
      { issueCode: 42 },
      { targetKey: {} },
      { idempotencyDayUtc: '99999999' },
      { clientKey: '' },
      { nowMs: Number.NaN },
      { proposalId: 'x'.repeat(10_000) },
    ]) {
      results.push(await executor.execute(makeRequest(patch as never)));
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
      await adversarialExecutor(new FakeAttemptStore(), FakeEvidence.ok()).execute(
        makeRequest(),
      ),
    );

    const store = new FakeAttemptStore();
    const throwingEvidence = new FakeEvidence({ kind: 'reject', error: new Error('boom') });
    const executor = new TierARemediationExecutor({
      attemptStore: store,
      evidence: throwingEvidence,
      killSwitch: killSwitchOf({ allowed: true, capability: 'auto-remediation' }),
      runbookEnabled: () => true,
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
    results.push(await executor.execute(makeRequest()));

    // Store that faults on finish, evidence that hangs forever: the bounded
    // read must time out and the result still resolves closed.
    const badStore = new FakeAttemptStore();
    badStore.failNext('finish');
    const hanging = new FakeEvidence({ kind: 'hang' });
    const timer = new ManualTimer();
    const hangingExecutor = new TierARemediationExecutor({
      attemptStore: badStore,
      evidence: hanging,
      killSwitch: killSwitchOf({ allowed: true, capability: 'auto-remediation' }),
      runbookEnabled: () => true,
      now: makeClock().now,
      setTimeoutFn: timer.setTimeoutFn,
      clearTimeoutFn: timer.clearTimeoutFn,
    });
    const pending = hangingExecutor.execute(makeRequest());
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

  it('survives a randomized sequence of mixed requests against scripted evidence', async () => {
    let seed = 13;
    const rand = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    const store = new FakeAttemptStore();
    const circuit = new FakeCircuit();
    const timer = new ManualTimer();
    const statuses = ['OK', 'DEGRADED', 'UNKNOWN', 'FAILED'];
    const days = ['2026-11-02', '2026-11-03', '2026-11-04'];

    const executor = new TierARemediationExecutor({
      attemptStore: store,
      evidence: {
        read: (_clientKey: string, _environmentKey: string) => {
          const r = rand();
          if (r < 0.15) return Promise.reject(new Error('random read fault'));
          const status = statuses[Math.floor(rand() * statuses.length)];
          return Promise.resolve(makeProjection(TARGET, status));
        },
      },
      killSwitch: killSwitchOf({ allowed: true, capability: 'auto-remediation' }),
      runbookEnabled: () => rand() > 0.2,
      now: makeClock().now,
      setTimeoutFn: timer.setTimeoutFn,
      clearTimeoutFn: timer.clearTimeoutFn,
      circuit,
    });

    for (let i = 0; i < 120; i += 1) {
      const result = await executor.execute(
        makeRequest({
          idempotencyDayUtc: days[Math.floor(rand() * days.length)],
          nowMs: 1_760_000_000_000 + i,
        }),
      );
      expect(OUTCOMES).toContain(result.outcome);
      expect(result.summary.length).toBeLessThanOrEqual(200);
    }
  });
});
