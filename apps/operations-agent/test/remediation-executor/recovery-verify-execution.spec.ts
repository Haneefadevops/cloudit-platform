import { SECRET_CANARY_FIXTURES } from '@cloudit/operations-agent-contracts';
import { TierARemediationExecutor } from '../../src/remediation/executor';
import type { RemediationAttemptAuditEvent } from '../../src/remediation/executor';
import {
  RECOVERY_VERIFY_RUNBOOK,
  RECOVERY_VERIFY_RUNBOOK_KEY,
  RECOVERY_VERIFY_RUNBOOK_VERSION,
  buildRecoveryVerifyGateSummary,
  buildRecoveryVerifySummary,
} from '../../src/remediation/executor';
import {
  CLIENT,
  DAY,
  ENV,
  FakeAttemptStore,
  FakeCircuit,
  FakeEvidence,
  killSwitchOf,
  makeClock,
  makeMultiProjection,
  makeRecord,
  makeRequest,
  ManualTimer,
  ThrowingAuditSink,
} from './fakes';

const SUBJECT = 'EVIDENCE_STALE';
const RECOVERY_ISSUE = 'SOURCE_FAILED';

function makeRecoveryRequest(overrides: Record<string, unknown> = {}) {
  return makeRequest({
    runbookKey: RECOVERY_VERIFY_RUNBOOK_KEY,
    runbookVersion: RECOVERY_VERIFY_RUNBOOK_VERSION,
    issueCode: RECOVERY_ISSUE,
    targetKey: SUBJECT,
    ...overrides,
  } as never);
}

function makeRecoveryExecutor(overrides: Record<string, unknown> = {}) {
  const store = new FakeAttemptStore();
  const circuit = new FakeCircuit();
  const timer = new ManualTimer();
  const clock = makeClock();
  const auditEvents: unknown[] = [];
  const base = {
    attemptStore: store,
    evidence: FakeEvidence.ok(),
    killSwitch: killSwitchOf({ allowed: true, capability: 'auto-remediation' }),
    runbookEnabled: () => false,
    recoveryVerifyEnabled: () => true,
    audit: { record: (event: unknown) => auditEvents.push(event) },
    now: clock.now,
    attemptIdFactory: () => 'att-recovery-1',
    setTimeoutFn: timer.setTimeoutFn,
    clearTimeoutFn: timer.clearTimeoutFn,
    circuit,
    ...(overrides as object),
  };
  const executor = new TierARemediationExecutor(base);
  return { executor, store, circuit, timer, clock, auditEvents, base };
}

/** Two agreeing OK+fresh reads → RECOVERED. */
function okEvidence(): FakeEvidence {
  const projection = makeMultiProjection([makeRecord('vercel-analytics', 'OK')]);
  return new FakeEvidence(
    { kind: 'projection', value: projection },
    { kind: 'projection', value: projection },
  );
}

describe('RB-INCIDENT-RECOVERY-VERIFY-001 execution paths', () => {
  it('RECOVERED when all checked sources are OK and fresh on both agreeing reads', async () => {
    const evidence = okEvidence();
    const { executor, store, circuit, auditEvents } = makeRecoveryExecutor({ evidence });
    const result = await executor.execute(makeRecoveryRequest());
    expect(result.outcome).toBe('EXECUTED');
    expect(result.attemptId).toBe('att-recovery-1');
    expect(result.resultCode).toBe('RECOVERED');
    expect(evidence.readCount).toBe(2);
    expect(store.finishes).toHaveLength(1);
    expect(store.finishes[0].input.status).toBe('SUCCEEDED');
    expect(circuit.successes).toBe(1);
    expect(auditEvents).toHaveLength(1);
    const event = auditEvents[0] as RemediationAttemptAuditEvent;
    expect(event.eventType).toBe('remediation_attempt');
    expect(event.reasonCode).toBe('EXECUTED');
    expect(event.resultCode).toBe('RECOVERED');
    expect(event.evidenceKeys).toEqual([SUBJECT]);
  });

  it('claims with the fixed idempotency key runbook:target:day', async () => {
    const { executor, store } = makeRecoveryExecutor({ evidence: okEvidence() });
    await executor.execute(makeRecoveryRequest());
    expect(store.claims).toHaveLength(1);
    expect(store.claims[0].idempotencyKey).toBe(
      `${RECOVERY_VERIFY_RUNBOOK_KEY}:${SUBJECT}:${DAY}`,
    );
    expect(store.claims[0].runbookKey).toBe(RECOVERY_VERIFY_RUNBOOK_KEY);
    expect(store.claims[0].runbookVersion).toBe('1');
  });

  it('checks only the requested evidenceKeys when present and non-empty', async () => {
    const projection = makeMultiProjection([
      makeRecord('database', 'UNKNOWN'),
      makeRecord('public-api', 'OK'),
    ]);
    const evidence = new FakeEvidence(
      { kind: 'projection', value: projection },
      { kind: 'projection', value: projection },
    );
    const { executor } = makeRecoveryExecutor({ evidence });
    const result = await executor.execute(
      makeRecoveryRequest({ evidenceKeys: ['public-api'] }),
    );
    expect(result.resultCode).toBe('RECOVERED');
  });

  it.each([
    ['DEGRADED'],
    ['UNKNOWN'],
    ['FAILED'],
  ])('CONFIRMED_STALE when a checked source is %s on both agreeing reads', async (status) => {
    const projection = makeMultiProjection([
      makeRecord('vercel-analytics', 'OK'),
      makeRecord('database', status),
    ]);
    const evidence = new FakeEvidence(
      { kind: 'projection', value: projection },
      { kind: 'projection', value: projection },
    );
    const { executor, circuit } = makeRecoveryExecutor({ evidence });
    const result = await executor.execute(makeRecoveryRequest({ evidenceKeys: ['database'] }));
    expect(result.outcome).toBe('EXECUTED');
    expect(result.resultCode).toBe('CONFIRMED_STALE');
    expect(circuit.successes).toBe(1);
  });

  it('CONFIRMED_STALE when a checked source is OK but its freshUntil has passed', async () => {
    const projection = makeMultiProjection([
      makeRecord('database', 'OK', Date.UTC(2026, 10, 2, 11, 59, 59), Date.UTC(2026, 10, 2, 11, 58, 59)),
    ]);
    const evidence = new FakeEvidence(
      { kind: 'projection', value: projection },
      { kind: 'projection', value: projection },
    );
    const { executor } = makeRecoveryExecutor({ evidence });
    const result = await executor.execute(
      makeRecoveryRequest({ evidenceKeys: ['database'], nowMs: Date.UTC(2026, 10, 2, 12, 0, 0) }),
    );
    expect(result.resultCode).toBe('CONFIRMED_STALE');
  });

  it('CONFIRMED_STALE when a requested evidenceKey has no projection record (fail closed)', async () => {
    const projection = makeMultiProjection([makeRecord('database', 'OK')]);
    const evidence = new FakeEvidence(
      { kind: 'projection', value: projection },
      { kind: 'projection', value: projection },
    );
    const { executor } = makeRecoveryExecutor({ evidence });
    const result = await executor.execute(
      makeRecoveryRequest({ evidenceKeys: ['database', 'incidents'] }),
    );
    expect(result.resultCode).toBe('CONFIRMED_STALE');
  });

  it('checks every projection record when evidenceKeys is absent', async () => {
    const projection = makeMultiProjection([
      makeRecord('vercel-analytics', 'OK'),
      makeRecord('database', 'FAILED'),
    ]);
    const evidence = new FakeEvidence(
      { kind: 'projection', value: projection },
      { kind: 'projection', value: projection },
    );
    const { executor } = makeRecoveryExecutor({ evidence });
    const result = await executor.execute(makeRecoveryRequest({ evidenceKeys: undefined }));
    expect(result.resultCode).toBe('CONFIRMED_STALE');
  });

  it('checks every projection record when evidenceKeys is empty', async () => {
    const projection = makeMultiProjection([
      makeRecord('vercel-analytics', 'OK'),
      makeRecord('database', 'OK'),
    ]);
    const evidence = new FakeEvidence(
      { kind: 'projection', value: projection },
      { kind: 'projection', value: projection },
    );
    const { executor } = makeRecoveryExecutor({ evidence });
    const result = await executor.execute(makeRecoveryRequest({ evidenceKeys: [] }));
    expect(result.resultCode).toBe('RECOVERED');
  });

  it('SOURCE_FAILED when the two reads disagree on the classification', async () => {
    const okProjection = makeMultiProjection([makeRecord('database', 'OK')]);
    const staleProjection = makeMultiProjection([makeRecord('database', 'UNKNOWN')]);
    const evidence = new FakeEvidence(
      { kind: 'projection', value: okProjection },
      { kind: 'projection', value: staleProjection },
    );
    const { executor, store, circuit } = makeRecoveryExecutor({ evidence });
    const result = await executor.execute(
      makeRecoveryRequest({ evidenceKeys: ['database'] }),
    );
    expect(result.resultCode).toBe('SOURCE_FAILED');
    expect(store.finishes[0].input.status).toBe('FAILED');
    expect(circuit.failures).toBe(1);
  });

  it('SOURCE_FAILED when the recheck read rejects', async () => {
    const evidence = new FakeEvidence({ kind: 'reject', error: new Error('fake read fault') });
    const { executor, store } = makeRecoveryExecutor({ evidence });
    const result = await executor.execute(makeRecoveryRequest());
    expect(result.resultCode).toBe('SOURCE_FAILED');
    expect(store.finishes[0].input.status).toBe('FAILED');
  });

  it('TIMED_OUT when the recheck read never settles and the timer fires', async () => {
    const evidence = new FakeEvidence({ kind: 'hang' });
    const { executor, store, circuit, timer } = makeRecoveryExecutor({ evidence });
    const promise = executor.execute(makeRecoveryRequest());
    for (let i = 0; i < 10 && timer.scheduled.length === 0; i += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(timer.scheduled).toHaveLength(1);
    timer.fireNext();
    const result = await promise;
    expect(result.resultCode).toBe('TIMED_OUT');
    expect(store.finishes[0].input.resultCode).toBe('TIMED_OUT');
    expect(circuit.failures).toBe(1);
    expect(timer.cleared).toBeGreaterThan(0);
  });

  it('SOURCE_FAILED when the verification read rejects', async () => {
    const projection = makeMultiProjection([makeRecord('database', 'OK')]);
    const evidence = new FakeEvidence(
      { kind: 'projection', value: projection },
      { kind: 'reject', error: new Error('fake verification fault') },
    );
    const { executor } = makeRecoveryExecutor({ evidence });
    const result = await executor.execute(makeRecoveryRequest());
    expect(result.resultCode).toBe('SOURCE_FAILED');
  });

  it('SOURCE_FAILED when the projection fails fail-closed validation', async () => {
    const broken = { client: CLIENT, environment: ENV, records: 'nope' };
    const evidence = new FakeEvidence(
      { kind: 'projection', value: broken },
      { kind: 'projection', value: broken },
    );
    const { executor } = makeRecoveryExecutor({ evidence });
    const result = await executor.execute(makeRecoveryRequest());
    expect(result.resultCode).toBe('SOURCE_FAILED');
  });

  it('RECOVERED with an empty projection and no evidenceKeys fails closed as CONFIRMED_STALE', async () => {
    const projection = makeMultiProjection([]);
    const evidence = new FakeEvidence(
      { kind: 'projection', value: projection },
      { kind: 'projection', value: projection },
    );
    const { executor } = makeRecoveryExecutor({ evidence });
    const result = await executor.execute(makeRecoveryRequest());
    expect(result.resultCode).toBe('CONFIRMED_STALE');
  });

  it('a throwing audit sink never changes the result and never throws', async () => {
    const sink = new ThrowingAuditSink();
    const { executor } = makeRecoveryExecutor({ evidence: okEvidence(), audit: sink });
    const result = await executor.execute(makeRecoveryRequest());
    expect(result.resultCode).toBe('RECOVERED');
    expect(sink.attempted).toHaveLength(1);
  });

  it('audit event carries the requested evidenceKeys, frozen record and event', async () => {
    const projection = makeMultiProjection([
      makeRecord('database', 'OK'),
      makeRecord('public-api', 'OK'),
    ]);
    const evidence = new FakeEvidence(
      { kind: 'projection', value: projection },
      { kind: 'projection', value: projection },
    );
    const { executor, store, auditEvents } = makeRecoveryExecutor({ evidence });
    const result = await executor.execute(
      makeRecoveryRequest({ evidenceKeys: ['database', 'public-api'] }),
    );
    const record = await store.get(result.attemptId!);
    expect(record?.status).toBe('SUCCEEDED');
    expect(Object.isFrozen(record)).toBe(true);
    const event = auditEvents[0] as RemediationAttemptAuditEvent;
    expect(Object.isFrozen(event)).toBe(true);
    expect(event.evidenceKeys).toEqual(['database', 'public-api']);
  });

  it('summaries stay under 200 chars and never carry evidence safeSummary or canary text', async () => {
    const canary = SECRET_CANARY_FIXTURES[0].value;
    const projection = makeMultiProjection([
      { ...makeRecord('database', 'OK'), safeSummary: `evidence said ${canary} secretly` },
    ]);
    const evidence = new FakeEvidence(
      { kind: 'projection', value: projection },
      { kind: 'projection', value: projection },
    );
    const { executor, store, auditEvents } = makeRecoveryExecutor({ evidence });
    const result = await executor.execute(makeRecoveryRequest());
    expect(result.summary.length).toBeLessThanOrEqual(200);
    expect(result.summary).not.toContain(canary);
    expect(result.summary).toContain(`target=${SUBJECT}`);
    expect(result.summary).toContain(`day=${DAY}`);
    expect(result.summary).toContain('result=RECOVERED');
    const finishSummary = store.finishes[0].input.summary;
    expect(finishSummary.length).toBeLessThanOrEqual(200);
    expect(finishSummary).not.toContain(canary);
    const event = auditEvents[0] as RemediationAttemptAuditEvent;
    expect(event.summary.length).toBeLessThanOrEqual(200);
    expect(JSON.stringify(event)).not.toContain(canary);
  });

  it('passes the request client/environment through to both evidence reads', async () => {
    const evidence = okEvidence();
    const { executor } = makeRecoveryExecutor({ evidence });
    await executor.execute(makeRecoveryRequest());
    expect(evidence.readCount).toBe(2);
    expect(evidence.calls[0]).toEqual({ clientKey: CLIENT, environmentKey: ENV });
    expect(evidence.calls[1]).toEqual({ clientKey: CLIENT, environmentKey: ENV });
  });
});

describe('RB-INCIDENT-RECOVERY-VERIFY-001 contract', () => {
  it('exposes the frozen closed enums fixed by the programme brief', () => {
    expect(RECOVERY_VERIFY_RUNBOOK.runbookKey).toBe('RB-INCIDENT-RECOVERY-VERIFY-001');
    expect(RECOVERY_VERIFY_RUNBOOK.version).toBe('1');
    expect(RECOVERY_VERIFY_RUNBOOK.tier).toBe('A');
    expect(RECOVERY_VERIFY_RUNBOOK.acceptedIssueCodes).toEqual([
      'EVIDENCE_MISSING',
      'EVIDENCE_STALE',
      'SOURCE_DEGRADED',
      'STATUS_UNKNOWN',
      'REPEATED_FAILURES',
      'SOURCE_FAILED',
    ]);
    expect(RECOVERY_VERIFY_RUNBOOK.expectedResultCodes).toEqual([
      'RECOVERED',
      'CONFIRMED_STALE',
      'SOURCE_FAILED',
    ]);
    expect(RECOVERY_VERIFY_RUNBOOK.maxAutomaticAttempts).toBe(1);
    expect(RECOVERY_VERIFY_RUNBOOK.timeoutMs).toBe(10_000);
    expect(RECOVERY_VERIFY_RUNBOOK.rollback).toContain(
      'No mutation was performed; rollback is a no-op.',
    );
    expect(Object.isFrozen(RECOVERY_VERIFY_RUNBOOK)).toBe(true);
  });

  it('summary templates stay within the 200-char bound for the longest closed inputs', () => {
    const target = 'REPEATED_FAILURES';
    for (const resultCode of [
      'RECOVERED',
      'CONFIRMED_STALE',
      'SOURCE_FAILED',
      'TIMED_OUT',
      'INTERNAL_ERROR',
    ]) {
      const summary = buildRecoveryVerifySummary(target, '2026-11-02', resultCode);
      expect(summary.length).toBeLessThanOrEqual(200);
      expect(summary).toContain(`target=${target}`);
      expect(summary).toContain('day=2026-11-02');
    }
    expect(buildRecoveryVerifyGateSummary('KILL_SWITCH').length).toBeLessThanOrEqual(200);
  });
});
