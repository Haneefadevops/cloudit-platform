import { TierARemediationExecutor } from '../../src/remediation/executor';
import {
  CLIENT,
  DAY,
  ENV,
  FakeAttemptStore,
  FakeCircuit,
  FakeEvidence,
  killSwitchOf,
  makeClock,
  makeRequest,
  ManualTimer,
  TARGET,
} from './fakes';

function makeExecutor(overrides: Record<string, unknown> = {}) {
  const store = new FakeAttemptStore();
  const evidence = FakeEvidence.ok();
  const circuit = new FakeCircuit();
  const timer = new ManualTimer();
  const auditEvents: unknown[] = [];
  const executor = new TierARemediationExecutor({
    attemptStore: store,
    evidence,
    killSwitch: killSwitchOf({ allowed: true, capability: 'auto-remediation' }),
    runbookEnabled: () => true,
    audit: { record: (event: unknown) => auditEvents.push(event) },
    now: makeClock().now,
    setTimeoutFn: timer.setTimeoutFn,
    clearTimeoutFn: timer.clearTimeoutFn,
    circuit,
    ...(overrides as object),
  });
  return { executor, store, evidence, circuit, timer, auditEvents };
}

describe('Tier A executor gating order', () => {
  it.each([
    ['runbookKey', { runbookKey: 'RB-OTHER-001' }],
    ['runbookVersion', { runbookVersion: '2' }],
    ['issueCode', { issueCode: 'WF_STALE_SNAPSHOT' }],
    ['targetKey', { targetKey: 'database' }],
    ['idempotencyDayUtc', { idempotencyDayUtc: '2026-11-2' }],
    ['idempotencyDayUtc garbage', { idempotencyDayUtc: 'not-a-day' }],
  ])('rejects invalid %s with PRECONDITION_FAILED before any side effect', async (_name, patch) => {
    const { executor, store, evidence } = makeExecutor();
    const result = await executor.execute(makeRequest(patch));
    expect(result.outcome).toBe('PRECONDITION_FAILED');
    expect(result.attemptId).toBeNull();
    expect(result.resultCode).toBe('PRECONDITION_FAILED');
    expect(evidence.readCount).toBe(0);
    expect(store.claims).toHaveLength(0);
    expect(store.finishes).toHaveLength(0);
  });

  it('denies with PRECONDITION_FAILED when the per-runbook flag is off, before any side effect', async () => {
    const { executor, store, evidence, auditEvents } = makeExecutor({
      runbookEnabled: () => false,
    });
    const result = await executor.execute(makeRequest());
    expect(result.outcome).toBe('PRECONDITION_FAILED');
    expect(result.resultCode).toBe('PRECONDITION_FAILED');
    expect(evidence.readCount).toBe(0);
    expect(store.claims).toHaveLength(0);
    expect(store.finishes).toHaveLength(0);
    expect(auditEvents).toHaveLength(0);
  });

  it('denies with BLOCKED_KILL_SWITCH on kill-switch denial with zero evidence reads and no claim', async () => {
    const { executor, store, evidence, circuit, auditEvents } = makeExecutor({
      killSwitch: killSwitchOf({
        allowed: false,
        capability: 'auto-remediation',
        reason: 'AUTO_REMEDIATION_DISABLED',
        message: 'capability "auto-remediation" is disabled by kill switch',
      }),
    });
    const result = await executor.execute(makeRequest());
    expect(result.outcome).toBe('BLOCKED_KILL_SWITCH');
    expect(result.resultCode).toBe('BLOCKED_KILL_SWITCH');
    expect(result.attemptId).toBeNull();
    expect(evidence.readCount).toBe(0);
    expect(store.claims).toHaveLength(0);
    expect(store.finishes).toHaveLength(0);
    expect(circuit.failures).toBe(0);
    expect(circuit.successes).toBe(0);
    expect(auditEvents).toHaveLength(0);
  });

  it('denies with CIRCUIT_OPEN when the circuit is open, after the kill switch, before any claim', async () => {
    const { executor, store, evidence, circuit } = makeExecutor();
    circuit.opened = true;
    const result = await executor.execute(makeRequest());
    expect(result.outcome).toBe('CIRCUIT_OPEN');
    expect(result.resultCode).toBe('BLOCKED_KILL_SWITCH');
    expect(evidence.readCount).toBe(0);
    expect(store.claims).toHaveLength(0);
    expect(store.finishes).toHaveLength(0);
  });

  it('returns ALREADY_CLAIMED with a null resultCode when the idempotency key is taken, zero evidence reads', async () => {
    const { executor, store, evidence } = makeExecutor();
    const first = await executor.execute(makeRequest());
    expect(first.outcome).toBe('EXECUTED');
    const second = await executor.execute(makeRequest());
    expect(second.outcome).toBe('ALREADY_CLAIMED');
    expect(second.attemptId).toBeNull();
    expect(second.resultCode).toBeNull();
    // The conflicting execute still asks the store to claim (that is how the
    // exactly-once conflict is detected); the store rejects the duplicate,
    // so the happy path remains the only one that read evidence (2 reads).
    expect(store.claims).toHaveLength(2);
    expect(evidence.readCount).toBe(2);
  });

  it('claims with the fixed idempotency key shape runbook:target:day', async () => {
    const { executor, store } = makeExecutor();
    await executor.execute(makeRequest());
    expect(store.claims).toHaveLength(1);
    expect(store.claims[0].idempotencyKey).toBe(
      `RB-READONLY-RECHECK-001:${TARGET}:${DAY}`,
    );
    expect(store.claims[0].runbookKey).toBe('RB-READONLY-RECHECK-001');
    expect(store.claims[0].runbookVersion).toBe('1');
  });

  it('passes the request client/environment through to the evidence reads', async () => {
    const { executor, evidence } = makeExecutor();
    await executor.execute(makeRequest());
    expect(evidence.readCount).toBe(2);
    expect(evidence.calls[0]).toEqual({ clientKey: CLIENT, environmentKey: ENV });
    expect(evidence.calls[1]).toEqual({ clientKey: CLIENT, environmentKey: ENV });
  });

  it('maps a claim fault (store throws) to INTERNAL_ERROR without an attempt', async () => {
    const { executor, store, evidence } = makeExecutor();
    store.failNext('claim');
    const result = await executor.execute(makeRequest());
    expect(result.outcome).toBe('INTERNAL_ERROR');
    expect(result.resultCode).toBe('INTERNAL_ERROR');
    expect(result.attemptId).toBeNull();
    expect(evidence.readCount).toBe(0);
  });
});
