import { SECRET_CANARY_FIXTURES } from '@cloudit/operations-agent-contracts';
import { TierARemediationExecutor } from '../../src/remediation/executor';
import type { RemediationAttemptAuditEvent } from '../../src/remediation/executor';
import {
  DAY,
  FakeAttemptStore,
  FakeCircuit,
  FakeEvidence,
  killSwitchOf,
  makeClock,
  makeProjection,
  makeRequest,
  ManualTimer,
  TARGET,
  ThrowingAuditSink,
} from './fakes';

function makeExecutor(overrides: Record<string, unknown> = {}) {
  const store = new FakeAttemptStore();
  const circuit = new FakeCircuit();
  const timer = new ManualTimer();
  const clock = makeClock();
  const auditEvents: unknown[] = [];
  const evidence = (overrides.evidence as FakeEvidence) ?? FakeEvidence.ok();
  const base = {
    attemptStore: store,
    evidence,
    killSwitch: killSwitchOf({ allowed: true, capability: 'auto-remediation' }),
    runbookEnabled: () => true,
    audit: { record: (event: unknown) => auditEvents.push(event) },
    now: clock.now,
    attemptIdFactory: () => 'att-test-1',
    setTimeoutFn: timer.setTimeoutFn,
    clearTimeoutFn: timer.clearTimeoutFn,
    circuit,
    ...(overrides as object),
  };
  const executor = new TierARemediationExecutor(base);
  return { executor, store, circuit, timer, clock, auditEvents, base, evidence };
}

describe('Tier A executor execution paths', () => {
  it('RECOVERED on a stable OK status: exactly 2 reads, one finish, one audit event', async () => {
    const { executor, store, evidence, circuit, auditEvents } = makeExecutor();
    const result = await executor.execute(makeRequest());
    expect(result.outcome).toBe('EXECUTED');
    expect(result.attemptId).toBe('att-test-1');
    expect(result.resultCode).toBe('RECOVERED');
    expect(evidence.readCount).toBe(2);
    expect(store.finishes).toHaveLength(1);
    expect(store.finishes[0].input.status).toBe('SUCCEEDED');
    expect(store.finishes[0].input.resultCode).toBe('RECOVERED');
    expect(circuit.successes).toBe(1);
    expect(circuit.failures).toBe(0);
    expect(auditEvents).toHaveLength(1);
    const event = auditEvents[0] as RemediationAttemptAuditEvent;
    expect(event.eventType).toBe('remediation_attempt');
    expect(event.actor).toBe('agent:remediation');
    expect(event.reasonCode).toBe('EXECUTED');
    expect(event.resultCode).toBe('RECOVERED');
    expect(event.evidenceKeys).toEqual([TARGET]);
  });

  it.each([['DEGRADED'], ['UNKNOWN'], ['FAILED']])(
    'CONFIRMED_STALE on a stable %s status',
    async (status) => {
      const evidence = new FakeEvidence(
        { kind: 'projection', value: makeProjection(TARGET, status) },
        { kind: 'projection', value: makeProjection(TARGET, status) },
      );
      const { executor, store, circuit } = makeExecutor({ evidence });
      const result = await executor.execute(makeRequest());
      expect(result.outcome).toBe('EXECUTED');
      expect(result.resultCode).toBe('CONFIRMED_STALE');
      expect(store.finishes).toHaveLength(1);
      expect(store.finishes[0].input.status).toBe('SUCCEEDED');
      expect(circuit.successes).toBe(1);
      expect(circuit.failures).toBe(0);
    },
  );

  it('SOURCE_FAILED when the recheck read rejects; circuit failure is fed', async () => {
    const evidence = new FakeEvidence({ kind: 'reject', error: new Error('fake read fault') });
    const { executor, store, circuit, auditEvents } = makeExecutor({ evidence });
    const result = await executor.execute(makeRequest());
    expect(result.outcome).toBe('EXECUTED');
    expect(result.resultCode).toBe('SOURCE_FAILED');
    expect(store.finishes).toHaveLength(1);
    expect(store.finishes[0].input.status).toBe('FAILED');
    expect(circuit.failures).toBe(1);
    expect(circuit.successes).toBe(0);
    expect(auditEvents).toHaveLength(1);
    expect((auditEvents[0] as RemediationAttemptAuditEvent).resultCode).toBe('SOURCE_FAILED');
  });

  it('TIMED_OUT when the recheck read never settles and the timer fires; pending timer cleared', async () => {
    const evidence = new FakeEvidence({ kind: 'hang' });
    const { executor, store, circuit, timer } = makeExecutor({ evidence });
    const promise = executor.execute(makeRequest());
    // Let the microtask queue settle so the bounded read arms its timer.
    for (let i = 0; i < 10 && timer.scheduled.length === 0; i += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(timer.scheduled).toHaveLength(1);
    timer.fireNext();
    const result = await promise;
    expect(result.outcome).toBe('EXECUTED');
    expect(result.resultCode).toBe('TIMED_OUT');
    expect(store.finishes).toHaveLength(1);
    expect(store.finishes[0].input.resultCode).toBe('TIMED_OUT');
    expect(circuit.failures).toBe(1);
    expect(timer.cleared).toBeGreaterThan(0);
  });

  it('SOURCE_FAILED when the verification read rejects', async () => {
    const evidence = new FakeEvidence(
      { kind: 'projection', value: makeProjection(TARGET, 'OK') },
      { kind: 'reject', error: new Error('fake verification fault') },
    );
    const { executor, store } = makeExecutor({ evidence });
    const result = await executor.execute(makeRequest());
    expect(result.resultCode).toBe('SOURCE_FAILED');
    expect(store.finishes).toHaveLength(1);
    expect(store.finishes[0].input.status).toBe('FAILED');
  });

  it('SOURCE_FAILED when recheck and verification classifications disagree', async () => {
    const evidence = new FakeEvidence(
      { kind: 'projection', value: makeProjection(TARGET, 'OK') },
      { kind: 'projection', value: makeProjection(TARGET, 'UNKNOWN') },
    );
    const { executor, store } = makeExecutor({ evidence });
    const result = await executor.execute(makeRequest());
    expect(result.resultCode).toBe('SOURCE_FAILED');
    expect(store.finishes).toHaveLength(1);
    expect(store.finishes[0].input.status).toBe('FAILED');
  });

  it('SOURCE_FAILED when the target record is missing from a valid projection', async () => {
    const evidence = new FakeEvidence(
      { kind: 'projection', value: makeProjection('database', 'OK') },
      { kind: 'projection', value: makeProjection('database', 'OK') },
    );
    const { executor, store } = makeExecutor({ evidence });
    const result = await executor.execute(makeRequest());
    expect(result.resultCode).toBe('SOURCE_FAILED');
    expect(store.finishes).toHaveLength(1);
  });

  it('SOURCE_FAILED when the projection fails fail-closed validation', async () => {
    const broken = { client: 'client-a', environment: 'env-test', records: 'nope' };
    const evidence = new FakeEvidence(
      { kind: 'projection', value: broken },
      { kind: 'projection', value: broken },
    );
    const { executor } = makeExecutor({ evidence });
    const result = await executor.execute(makeRequest());
    expect(result.resultCode).toBe('SOURCE_FAILED');
  });

  it('INTERNAL_ERROR when the finish call faults; the result still stands and no throw escapes', async () => {
    const store = new FakeAttemptStore();
    store.failNext('finish');
    const { executor } = makeExecutor({ attemptStore: store });
    const result = await executor.execute(makeRequest());
    expect(result.outcome).toBe('EXECUTED');
    expect(result.resultCode).toBe('RECOVERED');
  });

  it('a throwing audit sink never changes the result and never throws', async () => {
    const sink = new ThrowingAuditSink();
    const { executor } = makeExecutor({ audit: sink });
    const result = await executor.execute(makeRequest());
    expect(result.outcome).toBe('EXECUTED');
    expect(result.resultCode).toBe('RECOVERED');
    expect(sink.attempted).toHaveLength(1);
  });

  it('summaries stay under 200 chars and never carry evidence safeSummary or canary text', async () => {
    const canary = SECRET_CANARY_FIXTURES[0].value;
    const projection = makeProjection(TARGET, 'OK');
    projection.records = [
      { ...(projection.records as Record<string, unknown>[])[0], safeSummary: `evidence said ${canary} secretly` },
    ];
    const evidence = new FakeEvidence(
      { kind: 'projection', value: projection },
      { kind: 'projection', value: projection },
    );
    const { executor, store, auditEvents } = makeExecutor({ evidence });
    const result = await executor.execute(makeRequest());
    expect(result.summary.length).toBeLessThanOrEqual(200);
    expect(result.summary).not.toContain(canary);
    expect(result.summary).not.toContain('evidence said');
    expect(result.summary).toContain(`target=${TARGET}`);
    expect(result.summary).toContain(`day=${DAY}`);
    expect(result.summary).toContain('result=RECOVERED');
    const finishSummary = store.finishes[0].input.summary;
    expect(finishSummary.length).toBeLessThanOrEqual(200);
    expect(finishSummary).not.toContain(canary);
    const event = auditEvents[0] as RemediationAttemptAuditEvent;
    expect(event.summary.length).toBeLessThanOrEqual(200);
    expect(JSON.stringify(event)).not.toContain(canary);
  });

  it('attempt record and audit event are frozen; store returns a finished record', async () => {
    const { executor, store, auditEvents } = makeExecutor();
    const result = await executor.execute(makeRequest());
    const record = await store.get(result.attemptId!);
    expect(record?.status).toBe('SUCCEEDED');
    expect(record?.resultCode).toBe('RECOVERED');
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(auditEvents[0])).toBe(true);
  });
});
