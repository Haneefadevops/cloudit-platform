import { TierARemediationExecutor } from '../../src/remediation/executor';
import {
  RECOVERY_VERIFY_RUNBOOK_KEY,
  RECOVERY_VERIFY_RUNBOOK_VERSION,
} from '../../src/remediation/executor';
import {
  DAY,
  FakeAttemptStore,
  FakeCircuit,
  FakeEvidence,
  killSwitchOf,
  makeClock,
  makeMultiProjection,
  makeRecord,
  makeRequest,
  ManualTimer,
  TARGET,
} from './fakes';

const SUBJECT = 'EVIDENCE_STALE';

function makeRecoveryRequest(overrides: Record<string, unknown> = {}) {
  return makeRequest({
    runbookKey: RECOVERY_VERIFY_RUNBOOK_KEY,
    runbookVersion: RECOVERY_VERIFY_RUNBOOK_VERSION,
    issueCode: 'SOURCE_FAILED',
    targetKey: SUBJECT,
    ...overrides,
  } as never);
}

/** Two agreeing OK+fresh reads; used wherever the body must be reached. */
function okEvidence(): FakeEvidence {
  const projection = makeMultiProjection([makeRecord('vercel-analytics', 'OK')]);
  return new FakeEvidence(
    { kind: 'projection', value: projection },
    { kind: 'projection', value: projection },
  );
}

function makeExecutor(overrides: Record<string, unknown> = {}) {
  const store = new FakeAttemptStore();
  const evidence = (overrides.evidence as FakeEvidence) ?? okEvidence();
  const circuit = new FakeCircuit();
  const timer = new ManualTimer();
  const auditEvents: unknown[] = [];
  const base = {
    attemptStore: store,
    evidence,
    killSwitch: killSwitchOf({ allowed: true, capability: 'auto-remediation' }),
    runbookEnabled: () => false,
    recoveryVerifyEnabled: () => true,
    audit: { record: (event: unknown) => auditEvents.push(event) },
    now: makeClock().now,
    setTimeoutFn: timer.setTimeoutFn,
    clearTimeoutFn: timer.clearTimeoutFn,
    circuit,
    ...(overrides as object),
  };
  const executor = new TierARemediationExecutor(base);
  return { executor, store, evidence, circuit, timer, auditEvents };
}

describe('Tier A executor per-runbook gating', () => {
  it('recovery runbook is disabled when recoveryVerifyEnabled is undefined (fail closed)', async () => {
    const { executor, store, evidence, auditEvents } = makeExecutor({
      recoveryVerifyEnabled: undefined,
    });
    const result = await executor.execute(makeRecoveryRequest());
    expect(result.outcome).toBe('PRECONDITION_FAILED');
    expect(result.resultCode).toBe('PRECONDITION_FAILED');
    expect(result.summary).toContain(`${RECOVERY_VERIFY_RUNBOOK_KEY} gate=RUNBOOK_DISABLED`);
    expect(evidence.readCount).toBe(0);
    expect(store.claims).toHaveLength(0);
    expect(auditEvents).toHaveLength(0);
  });

  it('recheck flag on + recovery flag off → recovery runbook PRECONDITION_FAILED', async () => {
    const { executor, store, evidence } = makeExecutor({
      runbookEnabled: () => true,
      recoveryVerifyEnabled: () => false,
    });
    const result = await executor.execute(makeRecoveryRequest());
    expect(result.outcome).toBe('PRECONDITION_FAILED');
    expect(result.resultCode).toBe('PRECONDITION_FAILED');
    expect(evidence.readCount).toBe(0);
    expect(store.claims).toHaveLength(0);
  });

  it('recovery flag on + recheck flag off → recheck runbook PRECONDITION_FAILED', async () => {
    const { executor, store, evidence } = makeExecutor({
      runbookEnabled: () => false,
      recoveryVerifyEnabled: () => true,
    });
    const result = await executor.execute(makeRequest());
    expect(result.outcome).toBe('PRECONDITION_FAILED');
    expect(result.resultCode).toBe('PRECONDITION_FAILED');
    expect(evidence.readCount).toBe(0);
    expect(store.claims).toHaveLength(0);
  });

  it('each flag gates only its own runbook; both on → both execute', async () => {
    const { executor, store, evidence } = makeExecutor({
      runbookEnabled: () => true,
      recoveryVerifyEnabled: () => true,
    });
    const recheck = await executor.execute(makeRequest());
    expect(recheck.outcome).toBe('EXECUTED');
    expect(recheck.resultCode).toBe('RECOVERED');
    const recovery = await executor.execute(
      makeRecoveryRequest({ idempotencyDayUtc: '2026-11-03' }),
    );
    expect(recovery.outcome).toBe('EXECUTED');
    expect(recovery.resultCode).toBe('RECOVERED');
    expect(store.claims).toHaveLength(2);
    expect(evidence.readCount).toBe(4);
  });

  it('kill switch still first-class for the recovery runbook: BLOCKED_KILL_SWITCH beats the flag', async () => {
    const { executor, store, evidence, circuit } = makeExecutor({
      killSwitch: killSwitchOf({
        allowed: false,
        capability: 'auto-remediation',
        reason: 'AUTO_REMEDIATION_DISABLED',
        message: 'capability "auto-remediation" is disabled by kill switch',
      }),
    });
    const result = await executor.execute(makeRecoveryRequest());
    expect(result.outcome).toBe('BLOCKED_KILL_SWITCH');
    expect(result.resultCode).toBe('BLOCKED_KILL_SWITCH');
    expect(result.summary).toContain(`${RECOVERY_VERIFY_RUNBOOK_KEY} gate=KILL_SWITCH`);
    expect(evidence.readCount).toBe(0);
    expect(store.claims).toHaveLength(0);
    expect(circuit.failures).toBe(0);
  });

  it('CIRCUIT_OPEN for the recovery runbook after the kill switch, before any claim', async () => {
    const { executor, store, evidence, circuit } = makeExecutor();
    circuit.opened = true;
    const result = await executor.execute(makeRecoveryRequest());
    expect(result.outcome).toBe('CIRCUIT_OPEN');
    expect(result.resultCode).toBe('BLOCKED_KILL_SWITCH');
    expect(result.summary).toContain(`${RECOVERY_VERIFY_RUNBOOK_KEY} gate=CIRCUIT_OPEN`);
    expect(evidence.readCount).toBe(0);
    expect(store.claims).toHaveLength(0);
  });

  it('returns ALREADY_CLAIMED with a null resultCode on an idempotency conflict, zero reads', async () => {
    const { executor, store, evidence } = makeExecutor();
    const first = await executor.execute(makeRecoveryRequest());
    expect(first.outcome).toBe('EXECUTED');
    const second = await executor.execute(makeRecoveryRequest());
    expect(second.outcome).toBe('ALREADY_CLAIMED');
    expect(second.attemptId).toBeNull();
    expect(second.resultCode).toBeNull();
    expect(second.summary).toContain(`${RECOVERY_VERIFY_RUNBOOK_KEY} gate=ALREADY_CLAIMED`);
    expect(store.claims).toHaveLength(2);
    expect(evidence.readCount).toBe(2);
  });
});

describe('RB-INCIDENT-RECOVERY-VERIFY-001 contract validation', () => {
  it.each([
    ['runbookVersion', { runbookVersion: '2' }],
    ['issueCode', { issueCode: 'WF_STALE_SNAPSHOT' }],
    ['targetKey lowercase', { targetKey: 'evidence_stale' }],
    ['targetKey too short', { targetKey: 'AB' }],
    ['targetKey with dash', { targetKey: 'EVIDENCE-STALE' }],
    ['idempotencyDayUtc', { idempotencyDayUtc: '2026-11-2' }],
    ['evidenceKey too long', { evidenceKeys: ['a'.repeat(65)] }],
    ['evidenceKey with control char', { evidenceKeys: ['bad\u0007key'] }],
    ['evidenceKey non-string', { evidenceKeys: [42] }],
  ])('rejects invalid %s with PRECONDITION_FAILED before any side effect', async (_name, patch) => {
    const { executor, store, evidence } = makeExecutor();
    const result = await executor.execute(makeRecoveryRequest(patch));
    expect(result.outcome).toBe('PRECONDITION_FAILED');
    expect(result.resultCode).toBe('PRECONDITION_FAILED');
    expect(result.summary).toContain(`${RECOVERY_VERIFY_RUNBOOK_KEY} gate=CONTRACT`);
    expect(evidence.readCount).toBe(0);
    expect(store.claims).toHaveLength(0);
    expect(store.finishes).toHaveLength(0);
  });

  it.each([
    'EVIDENCE_MISSING',
    'EVIDENCE_STALE',
    'SOURCE_DEGRADED',
    'STATUS_UNKNOWN',
    'REPEATED_FAILURES',
    'SOURCE_FAILED',
  ])('accepts the live supervisor issue code %s', async (issueCode) => {
    const { executor } = makeExecutor();
    const result = await executor.execute(makeRecoveryRequest({ issueCode }));
    expect(result.outcome).toBe('EXECUTED');
  });

  it('an unknown runbookKey still fails closed at contract validation', async () => {
    const { executor, store, evidence } = makeExecutor();
    const result = await executor.execute(makeRequest({ runbookKey: 'RB-OTHER-001' }));
    expect(result.outcome).toBe('PRECONDITION_FAILED');
    expect(result.resultCode).toBe('PRECONDITION_FAILED');
    expect(evidence.readCount).toBe(0);
    expect(store.claims).toHaveLength(0);
  });

  it('recovers from a claim fault as INTERNAL_ERROR without an attempt', async () => {
    const { executor, store, evidence } = makeExecutor();
    store.failNext('claim');
    const result = await executor.execute(makeRecoveryRequest());
    expect(result.outcome).toBe('INTERNAL_ERROR');
    expect(result.resultCode).toBe('INTERNAL_ERROR');
    expect(result.attemptId).toBeNull();
    expect(evidence.readCount).toBe(0);
  });
});

describe('runbook 1 routing is untouched by the registry', () => {
  it('recheck requests keep their original gate summaries and flow', async () => {
    const { executor, store, evidence } = makeExecutor({
      runbookEnabled: () => true,
      evidence: FakeEvidence.ok(TARGET),
    });
    const result = await executor.execute(makeRequest());
    expect(result.outcome).toBe('EXECUTED');
    expect(result.resultCode).toBe('RECOVERED');
    expect(result.summary).toBe(
      `RB-READONLY-RECHECK-001 target=${TARGET} day=${DAY} result=RECOVERED`,
    );
    expect(store.claims[0].idempotencyKey).toBe(`RB-READONLY-RECHECK-001:${TARGET}:${DAY}`);
    expect(evidence.readCount).toBe(2);
  });
});
