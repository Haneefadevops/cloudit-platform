/**
 * Phase H eval suite: exactly-once integration (Worker A store + Worker B
 * executor end-to-end through the pinned AttemptStore contract).
 *
 * A FakeAttemptStore (Map keyed by idempotency_key, recording claim/finish
 * counts) backs the real TierARemediationExecutor:
 *  - 50 concurrent execute() calls with an identical request produce
 *    exactly one claim, exactly one finish, and 49 ALREADY_CLAIMED;
 *  - two different UTC days produce two attempts;
 *  - the same day with a different allowlisted target produces two attempts;
 *  - the same day and target with a different issueCode still produces ONE
 *    attempt (the first wins — the idempotency key is runbook+target+day
 *    scoped, not issueCode scoped).
 *
 * PENDING-INTEGRATION: skips loudly while Worker B's executor is absent;
 * once landed, every assertion runs and fails loudly on drift.
 *
 * DOCUMENTED SEAM (reconciled to the landed implementation): options bag per
 * TierARemediationExecutorOptions (attemptStore, evidence: {read}, killSwitch,
 * runbookEnabled, audit, now, recheckTimeoutMs, circuit); the evidence port
 * returns a SanitizedEvidenceProjection-shaped value with the target record
 * status 'OK'.
 */

import type {
  AttemptStore,
  ClaimAttemptInput,
  FinishAttemptInput,
  RemediationAttemptRecord,
} from '../../src/remediation/attempt-contract';
import type { RemediationExecutionRequest } from '../../src/remediation/executor/executor-contract';
import { RecordingAuditSink } from './fixtures';

const T0 = Date.UTC(2026, 9, 12, 9, 0, 0, 0);

const RUNBOOK_KEY = 'RB-READONLY-RECHECK-001';
const RUNBOOK_VERSION = '1';

class FakeAttemptStore implements AttemptStore {
  claimCalls = 0;
  finishCalls = 0;
  private readonly byKey = new Map<string, RemediationAttemptRecord>();
  private readonly byId = new Map<string, RemediationAttemptRecord>();
  private seq = 0;

  async claim(input: ClaimAttemptInput): Promise<RemediationAttemptRecord | null> {
    this.claimCalls += 1;
    if (this.byKey.has(input.idempotencyKey)) return null;
    this.seq += 1;
    const record: RemediationAttemptRecord = {
      attemptId: `att-synth-${this.seq}`,
      runbookKey: input.runbookKey,
      runbookVersion: input.runbookVersion,
      targetKey: input.targetKey,
      issueCode: input.issueCode,
      idempotencyKey: input.idempotencyKey,
      status: 'RUNNING',
      resultCode: null,
      claimedAtMs: input.nowMs,
      finishedAtMs: null,
      summary: '',
    };
    this.byKey.set(input.idempotencyKey, record);
    this.byId.set(record.attemptId, record);
    return record;
  }

  async finish(
    attemptId: string,
    input: FinishAttemptInput,
  ): Promise<RemediationAttemptRecord | null> {
    this.finishCalls += 1;
    const record = this.byId.get(attemptId);
    if (!record || record.status !== 'RUNNING') return null;
    const updated: RemediationAttemptRecord = {
      ...record,
      status: input.status,
      resultCode: input.resultCode,
      finishedAtMs: input.nowMs,
      summary: input.summary,
    };
    this.byId.set(attemptId, updated);
    this.byKey.set(updated.idempotencyKey, updated);
    return updated;
  }

  async finalizeStaleRunning(): Promise<readonly string[]> {
    return [];
  }

  async get(attemptId: string): Promise<RemediationAttemptRecord | null> {
    return this.byId.get(attemptId) ?? null;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<RemediationAttemptRecord | null> {
    return this.byKey.get(idempotencyKey) ?? null;
  }

  get attemptCount(): number {
    return this.seq;
  }
}

class FakeEvidencePort {
  reads = 0;
  async read(_clientKey: string, _environmentKey: string): Promise<unknown> {
    this.reads += 1;
    return {
      client: 'client-synth-alpha',
      environment: 'env-synth-alpha',
      records: [
        {
          sourceKey: 'vercel-analytics',
          status: 'OK',
          severity: 'warning',
          observedAt: '2026-10-12T08:00:00Z',
          freshUntil: '2026-10-12T10:00:00Z',
          criticality: 'analytics',
          safeSummary: 'synthetic safe summary',
          counts: { samples: 1 },
        },
      ],
    };
  }
}

interface ExecutorModuleShape {
  TierARemediationExecutor?: new (options: Record<string, unknown>) => {
    execute(request: RemediationExecutionRequest): Promise<unknown>;
  };
  [exportName: string]: unknown;
}

function tryRequire(modulePath: string): ExecutorModuleShape | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(modulePath) as ExecutorModuleShape;
  } catch {
    return undefined;
  }
}

function loadExecutorModule(): ExecutorModuleShape | undefined {
  for (const candidate of [
    '../../src/remediation/executor',
    '../../src/remediation/executor/tier-a-executor',
  ]) {
    const mod = tryRequire(candidate);
    if (mod && typeof mod.TierARemediationExecutor === 'function') return mod;
  }
  return undefined;
}

const executorModule = loadExecutorModule();

if (!executorModule) {
  // eslint-disable-next-line no-console
  console.warn(
    'exactly-once-integration: TierARemediationExecutor is not present under ' +
      'src/remediation/executor in this worktree; suite PENDING-INTEGRATION (Worker B).',
  );
}

function makeHarness(): {
  executor: { execute(request: RemediationExecutionRequest): Promise<unknown> };
  store: FakeAttemptStore;
} {
  if (!executorModule) throw new Error('executor module not present in this worktree');
  const store = new FakeAttemptStore();
  const executor = new executorModule.TierARemediationExecutor!({
    attemptStore: store,
    evidence: new FakeEvidencePort(),
    killSwitch: { check: () => ({ allowed: true, capability: 'auto-remediation' }) },
    runbookEnabled: () => true,
    audit: new RecordingAuditSink(),
    now: () => T0,
    recheckTimeoutMs: 5_000,
    circuit: { isOpen: () => false, onSuccess: () => undefined, onFailure: () => undefined },
  });
  return { executor, store };
}

function makeRequest(
  overrides: Partial<RemediationExecutionRequest> = {},
): RemediationExecutionRequest {
  return {
    proposalId: 'prop-synth-001',
    runbookKey: RUNBOOK_KEY,
    runbookVersion: RUNBOOK_VERSION,
    issueCode: 'STATUS_UNKNOWN',
    targetKey: 'vercel-analytics',
    clientKey: 'client-synth-alpha',
    environmentKey: 'env-synth-alpha',
    idempotencyDayUtc: '2026-10-12',
    nowMs: T0,
    ...overrides,
  };
}

const describeIntegration = executorModule ? describe : describe.skip;

describeIntegration('exactly-once integration — executor over durable attempt store', () => {
  it('50 concurrent identical executes: exactly one claim, one finish, 49 ALREADY_CLAIMED', async () => {
    const { executor, store } = makeHarness();
    const results = (await Promise.all(
      Array.from({ length: 50 }, () => executor.execute(makeRequest())),
    )) as Array<Record<string, unknown>>;

    expect(store.attemptCount).toBe(1);
    expect(store.finishCalls).toBe(1);
    const outcomes = results.map((r) => r['outcome']);
    expect(outcomes.filter((o) => o === 'EXECUTED')).toHaveLength(1);
    expect(outcomes.filter((o) => o === 'ALREADY_CLAIMED')).toHaveLength(49);
  });

  it('two different UTC days produce two attempts', async () => {
    const { executor, store } = makeHarness();
    const first = (await executor.execute(
      makeRequest({ idempotencyDayUtc: '2026-10-12' }),
    )) as Record<string, unknown>;
    const second = (await executor.execute(
      makeRequest({ idempotencyDayUtc: '2026-10-13' }),
    )) as Record<string, unknown>;
    expect(first['outcome']).toBe('EXECUTED');
    expect(second['outcome']).toBe('EXECUTED');
    expect(store.attemptCount).toBe(2);
    expect(store.finishCalls).toBe(2);
  });

  it('same day, different allowlisted target produces two attempts', async () => {
    const { executor, store } = makeHarness();
    const first = (await executor.execute(
      makeRequest({ targetKey: 'vercel-analytics' }),
    )) as Record<string, unknown>;
    const second = (await executor.execute(
      makeRequest({ targetKey: 'imagekit-delivery' }),
    )) as Record<string, unknown>;
    expect(first['outcome']).toBe('EXECUTED');
    expect(second['outcome']).toBe('EXECUTED');
    expect(store.attemptCount).toBe(2);
  });

  it('same day, same target, different issueCode still produces ONE attempt (first wins)', async () => {
    const { executor, store } = makeHarness();
    const first = (await executor.execute(
      makeRequest({ issueCode: 'STATUS_UNKNOWN' }),
    )) as Record<string, unknown>;
    const second = (await executor.execute(
      makeRequest({ issueCode: 'EVIDENCE_STALE' }),
    )) as Record<string, unknown>;
    expect(first['outcome']).toBe('EXECUTED');
    expect(second['outcome']).toBe('ALREADY_CLAIMED');
    expect(store.attemptCount).toBe(1);
    expect(store.finishCalls).toBe(1);
  });
});
