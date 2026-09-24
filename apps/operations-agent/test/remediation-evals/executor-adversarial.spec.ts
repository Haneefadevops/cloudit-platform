/**
 * Phase H eval suite: TierARemediationExecutor adversarial gating (Worker B).
 *
 * The executor is the only execution path, so its gate ORDER and fail-closed
 * behaviour are evaluated adversarially against a fake AttemptStore and a
 * fake evidence port returning SanitizedEvidenceProjection-shaped values:
 *  - contract validation first: critical sources ('database',
 *    'backups-daily', 'public-website'), issueCodes outside the accepted
 *    closed list and malformed idempotencyDayUtc are PRECONDITION_FAILED
 *    with zero claims and zero evidence reads;
 *  - the per-runbook enable flag (runbookEnabled) denies with zero claims
 *    and zero evidence reads;
 *  - the auto-remediation kill switch denies with BLOCKED_KILL_SWITCH, zero
 *    claims and zero evidence reads — and the denial wins even over an
 *    already-claimed key and over an open circuit;
 *  - an open circuit alone yields CIRCUIT_OPEN before any claim;
 *  - the ALREADY_CLAIMED path performs zero evidence reads;
 *  - the timeout path finishes the attempt TIMED_OUT and leaves no RUNNING
 *    attempt behind;
 *  - a successful run performs exactly 2 evidence reads (recheck +
 *    independent verification), 1 when the recheck fails;
 *  - verification disagreement fails closed (SOURCE_FAILED);
 *  - summaries never contain evidence safeSummary text (canary tripwire);
 *  - audit events are frozen, carry eventType 'remediation_attempt', and
 *    contain no raw error text;
 *  - the executor never throws, even when every dependency throws.
 *
 * PENDING-INTEGRATION: skips loudly while Worker B's executor is absent.
 *
 * DOCUMENTED SEAM (reconciled to the landed implementation): the executor
 * takes one options object { attemptStore, evidence: {read}, killSwitch:
 * {check('auto-remediation')}, runbookEnabled, audit?, now?,
 * recheckTimeoutMs?, circuit? }. Each test passes a complete, consistent bag
 * and flips exactly one knob. Evidence records use the closed projection
 * record shape; 'OK' classifies healthy, anything else NOT_OK.
 */

import type {
  AttemptResultCode,
  AttemptStatus,
  AttemptStore,
  ClaimAttemptInput,
  FinishAttemptInput,
  RemediationAttemptRecord,
} from '../../src/remediation/attempt-contract';
import type { RemediationExecutionRequest } from '../../src/remediation/executor/executor-contract';
import { collectStrings, findProperty, RecordingAuditSink } from './fixtures';

// --- synthetic instants / canaries (obviously fake) ---

const T0 = Date.UTC(2026, 9, 12, 9, 0, 0, 0);
const PROJECTION_CANARY = 'LEAK_CANARY_PROJ_7d21b4';
const ERROR_CANARY = 'RAW_ERROR_TEXT_CANARY_9f31c8';

const RUNBOOK_KEY = 'RB-READONLY-RECHECK-001';
const RUNBOOK_VERSION = '1';
const ACCEPTED_ISSUE_CODES = ['STATUS_UNKNOWN', 'EVIDENCE_STALE'] as const;
const ALLOWED_TARGETS = ['vercel-analytics', 'imagekit-delivery'] as const;

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

// --- fake attempt store (typed against the coordinator-owned contract) ---

class FakeAttemptStore implements AttemptStore {
  readonly claimed: ClaimAttemptInput[] = [];
  readonly finished: Array<{ attemptId: string; input: FinishAttemptInput }> = [];
  private readonly byKey = new Map<string, RemediationAttemptRecord>();
  private readonly byId = new Map<string, RemediationAttemptRecord>();
  private seq = 0;
  /** When set, every method rejects (never-throws property pass). */
  alwaysThrow: Error | undefined;

  private guard(): void {
    if (this.alwaysThrow) throw this.alwaysThrow;
  }

  async claim(input: ClaimAttemptInput): Promise<RemediationAttemptRecord | null> {
    this.guard();
    this.claimed.push(input);
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
    this.guard();
    this.finished.push({ attemptId, input });
    const record = this.byId.get(attemptId);
    if (!record || record.status !== 'RUNNING') return null;
    const updated: RemediationAttemptRecord = {
      ...record,
      status: input.status as AttemptStatus,
      resultCode: input.resultCode as AttemptResultCode,
      finishedAtMs: input.nowMs,
      summary: input.summary,
    };
    this.byId.set(attemptId, updated);
    this.byKey.set(updated.idempotencyKey, updated);
    return updated;
  }

  async finalizeStaleRunning(): Promise<readonly string[]> {
    this.guard();
    return [];
  }

  async get(attemptId: string): Promise<RemediationAttemptRecord | null> {
    this.guard();
    return this.byId.get(attemptId) ?? null;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<RemediationAttemptRecord | null> {
    this.guard();
    return this.byKey.get(idempotencyKey) ?? null;
  }

  runningCount(): number {
    let count = 0;
    for (const record of this.byId.values()) if (record.status === 'RUNNING') count += 1;
    return count;
  }

  timedOutFinishes(): Array<{ attemptId: string; input: FinishAttemptInput }> {
    return this.finished.filter((f) => f.input.resultCode === 'TIMED_OUT');
  }
}

// --- fake evidence port (SanitizedEvidenceProjection-shaped) ---

function makeProjection(
  targetKey: string,
  status: string,
  safeSummary = 'synthetic safe summary',
): Record<string, unknown> {
  return {
    client: 'client-synth-alpha',
    environment: 'env-synth-alpha',
    records: [
      {
        sourceKey: targetKey,
        status,
        severity: 'warning',
        observedAt: '2026-10-12T08:00:00Z',
        freshUntil: '2026-10-12T10:00:00Z',
        criticality: 'analytics',
        safeSummary,
        counts: { samples: 1 },
      },
    ],
  };
}

class FakeEvidencePort {
  reads = 0;
  /** Sequential results; the final entry repeats for later reads. */
  script: unknown[] = [];
  error: Error | undefined;
  hang = false;

  async read(_clientKey: string, _environmentKey: string): Promise<unknown> {
    this.reads += 1;
    if (this.hang) return new Promise(() => {});
    if (this.error) throw this.error;
    if (this.script.length === 0) return makeProjection('vercel-analytics', 'OK');
    return this.script.length > 1 ? this.script.shift()! : this.script[0];
  }
}

// --- runtime module loading (tolerant while the worker module is absent) ---

interface GateDecisionLike {
  readonly allowed: boolean;
  readonly capability: string;
  readonly reason?: string;
  readonly message?: string;
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
    'executor-adversarial: TierARemediationExecutor is not present under ' +
      'src/remediation/executor in this worktree; suite PENDING-INTEGRATION (Worker B).',
  );
}

const ALLOWED_DECISION: GateDecisionLike = { allowed: true, capability: 'auto-remediation' };
const DENIED_DECISION: GateDecisionLike = {
  allowed: false,
  capability: 'auto-remediation',
  reason: 'AUTO_REMEDIATION_DISABLED',
  message: 'synthetic fixed-safe denial',
};

interface Harness {
  executor: { execute(request: RemediationExecutionRequest): Promise<unknown> };
  store: FakeAttemptStore;
  audit: RecordingAuditSink;
  evidence: FakeEvidencePort;
}

interface OptionsKnobs {
  runbookEnabled?: boolean;
  killSwitchAllowed?: boolean;
  circuitOpen?: boolean;
  recheckTimeoutMs?: number;
}

/**
 * Construction seam: one complete, consistent options bag per the landed
 * TierARemediationExecutorOptions; each test flips exactly the knobs it
 * probes. Any future wiring divergence is reconciled HERE, in one place.
 */
function makeHarness(knobs: OptionsKnobs = {}): Harness {
  if (!executorModule) throw new Error('executor module not present in this worktree');
  const store = new FakeAttemptStore();
  const audit = new RecordingAuditSink();
  const evidence = new FakeEvidencePort();
  const decision = knobs.killSwitchAllowed === false ? DENIED_DECISION : ALLOWED_DECISION;
  const executor = new executorModule.TierARemediationExecutor!({
    attemptStore: store,
    evidence,
    killSwitch: { check: () => decision },
    runbookEnabled: () => knobs.runbookEnabled ?? true,
    audit,
    now: () => T0,
    recheckTimeoutMs: knobs.recheckTimeoutMs ?? 5_000,
    circuit: {
      isOpen: () => knobs.circuitOpen ?? false,
      onSuccess: () => undefined,
      onFailure: () => undefined,
    },
  });
  return { executor, store, audit, evidence };
}

const describeExecutor = executorModule ? describe : describe.skip;

const OUTCOMES = [
  'EXECUTED',
  'ALREADY_CLAIMED',
  'BLOCKED_KILL_SWITCH',
  'PRECONDITION_FAILED',
  'CIRCUIT_OPEN',
  'INTERNAL_ERROR',
] as const;

describeExecutor('TierARemediationExecutor — adversarial gating', () => {
  it('kill switch denied -> BLOCKED_KILL_SWITCH with zero evidence reads, zero claims, zero finishes', async () => {
    const h = makeHarness({ killSwitchAllowed: false });
    const result = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect(result['outcome']).toBe('BLOCKED_KILL_SWITCH');
    expect(h.evidence.reads).toBe(0);
    expect(h.store.claimed).toHaveLength(0);
    expect(h.store.finished).toHaveLength(0);
  });

  it('per-runbook enable flag denied -> PRECONDITION_FAILED with zero evidence reads and zero claims', async () => {
    const h = makeHarness({ runbookEnabled: false });
    const result = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect(result['outcome']).toBe('PRECONDITION_FAILED');
    expect(h.evidence.reads).toBe(0);
    expect(h.store.claimed).toHaveLength(0);
  });

  it('kill-switch denial wins over an open circuit (gate order cannot be bypassed)', async () => {
    const h = makeHarness({ killSwitchAllowed: false, circuitOpen: true });
    const result = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect(result['outcome']).toBe('BLOCKED_KILL_SWITCH');
    expect(h.store.claimed).toHaveLength(0);
    expect(h.evidence.reads).toBe(0);
  });

  it('an open circuit alone -> CIRCUIT_OPEN with zero claims and zero evidence reads', async () => {
    const h = makeHarness({ circuitOpen: true });
    const result = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect(result['outcome']).toBe('CIRCUIT_OPEN');
    expect(h.store.claimed).toHaveLength(0);
    expect(h.evidence.reads).toBe(0);
  });

  it('kill-switch denial wins over an already-claimed key (claim is never reached)', async () => {
    const h = makeHarness({ killSwitchAllowed: false });
    // Pre-claim the executor's idempotency key directly in the store: were
    // the executor to reach the claim it would see ALREADY_CLAIMED.
    await h.store.claim({
      attemptId: 'att-synth-pre',
      runbookKey: RUNBOOK_KEY,
      runbookVersion: RUNBOOK_VERSION,
      targetKey: 'vercel-analytics',
      issueCode: 'STATUS_UNKNOWN',
      idempotencyKey: `${RUNBOOK_KEY}:vercel-analytics:2026-10-12`,
      nowMs: T0,
    });
    const result = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect(result['outcome']).toBe('BLOCKED_KILL_SWITCH');
  });

  it.each(['database', 'backups-daily', 'public-website'])(
    'critical source "%s" is unexecutable -> PRECONDITION_FAILED',
    async (targetKey) => {
      const h = makeHarness();
      const result = (await h.executor.execute(makeRequest({ targetKey }))) as Record<
        string,
        unknown
      >;
      expect(result['outcome']).toBe('PRECONDITION_FAILED');
      expect(h.store.claimed).toHaveLength(0);
      expect(h.evidence.reads).toBe(0);
    },
  );

  it('issueCode outside the accepted closed list -> PRECONDITION_FAILED', async () => {
    const h = makeHarness();
    for (const issueCode of ['DROP_TABLE', 'WF_STALE_SNAPSHOT', 'NO_SUCH_SYNTHETIC_ISSUE', '']) {
      const result = (await h.executor.execute(makeRequest({ issueCode }))) as Record<
        string,
        unknown
      >;
      expect(result['outcome']).toBe('PRECONDITION_FAILED');
    }
    expect(h.store.claimed).toHaveLength(0);
    expect(h.evidence.reads).toBe(0);
  });

  it.each(['2026-9-1', 'tomorrow', '12/10/2026'])(
    'malformed idempotencyDayUtc "%s" -> PRECONDITION_FAILED',
    async (idempotencyDayUtc) => {
      const h = makeHarness();
      const result = (await h.executor.execute(makeRequest({ idempotencyDayUtc }))) as Record<
        string,
        unknown
      >;
      expect(result['outcome']).toBe('PRECONDITION_FAILED');
      expect(h.store.claimed).toHaveLength(0);
    },
  );

  it('ALREADY_CLAIMED path performs zero evidence reads and never finishes a second attempt', async () => {
    const h = makeHarness();
    const first = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect(first['outcome']).toBe('EXECUTED');
    h.evidence.reads = 0;
    const second = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect(second['outcome']).toBe('ALREADY_CLAIMED');
    expect(h.evidence.reads).toBe(0);
    expect(h.store.claimed).toHaveLength(2); // gate reached the store both times
    expect(h.store.finished).toHaveLength(1); // exactly one finish total
  });

  it('success performs exactly 2 evidence reads (recheck + independent verification) and RECOVERED', async () => {
    const h = makeHarness();
    const result = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect(result['outcome']).toBe('EXECUTED');
    expect(result['resultCode']).toBe('RECOVERED');
    expect(h.evidence.reads).toBe(2);
    expect(h.store.finished).toHaveLength(1);
  });

  it('a failing recheck performs exactly 1 evidence read (no verification read) and fails closed SOURCE_FAILED', async () => {
    const h = makeHarness();
    h.evidence.error = new Error(`synthetic recheck outage ${ERROR_CANARY}`);
    const result = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect(h.evidence.reads).toBe(1);
    expect(result['resultCode']).toBe('SOURCE_FAILED');
  });

  it('verification disagreement fails closed -> SOURCE_FAILED after exactly 2 reads', async () => {
    const h = makeHarness();
    h.evidence.script = [
      makeProjection('vercel-analytics', 'OK'),
      makeProjection('vercel-analytics', 'DEGRADED'),
    ];
    const result = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect(result['resultCode']).toBe('SOURCE_FAILED');
    expect(h.evidence.reads).toBe(2);
  });

  it('timeout path finishes TIMED_OUT and leaves no RUNNING attempt behind', async () => {
    const h = makeHarness({ recheckTimeoutMs: 1 });
    h.evidence.hang = true;
    const result = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect(result['resultCode']).toBe('TIMED_OUT');
    expect(h.store.timedOutFinishes()).toHaveLength(1);
    expect(h.store.runningCount()).toBe(0);
  });

  it('summaries never contain evidence safeSummary text (canary tripwire)', async () => {
    const h = makeHarness();
    h.evidence.script = [
      makeProjection('vercel-analytics', 'OK', `canary laced ${PROJECTION_CANARY}`),
    ];
    const result = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    for (const text of collectStrings(result)) {
      expect(text).not.toContain(PROJECTION_CANARY);
    }
    expect(h.audit.events.length).toBeGreaterThan(0);
    for (const event of h.audit.events) {
      for (const text of collectStrings(event)) {
        expect(text).not.toContain(PROJECTION_CANARY);
      }
    }
  });

  it('audit events are deeply frozen, carry eventType remediation_attempt, and hold no raw error text', async () => {
    const h = makeHarness();
    h.evidence.error = new Error(`synthetic outage ${ERROR_CANARY}`);
    await h.executor.execute(makeRequest());
    expect(h.audit.events.length).toBeGreaterThan(0);
    for (const event of h.audit.events) {
      expect(Object.isFrozen(event)).toBe(true);
      expect(findProperty(event, 'eventType')).toBe('remediation_attempt');
      for (const text of collectStrings(event)) {
        expect(text).not.toContain(ERROR_CANARY);
      }
    }
  });

  it('never throws: every dependency throwing/rejecting still yields a closed outcome', async () => {
    const h = makeHarness();
    h.store.alwaysThrow = new Error(`synthetic store outage ${ERROR_CANARY}`);
    h.evidence.error = new Error('synthetic recheck outage');
    // Patch the recording sink into a throwing one while still recording.
    const realRecord = h.audit.record.bind(h.audit);
    h.audit.record = (event: unknown) => {
      realRecord(event);
      throw new Error('synthetic audit sink outage');
    };

    const result = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect((OUTCOMES as readonly string[]).includes(result['outcome'] as string)).toBe(true);
  });
});
