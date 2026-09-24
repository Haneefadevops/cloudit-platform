/**
 * Phase H runbook 2 eval suite: RB-INCIDENT-RECOVERY-VERIFY-001 adversarial
 * gating (Worker B). False-recovery tripwires: the runbook re-checks the
 * checked evidence sources (request.evidenceKeys when non-empty, else every
 * projection record) with TWO bounded reads from the one read-only evidence
 * port, and must only ever conclude RECOVERED when every checked record is
 * status 'OK' AND freshUntil > nowMs in BOTH reads and the classifications
 * agree. Tripwires evaluated:
 *  - projection all-OK but freshUntil in the past -> CONFIRMED_STALE, never
 *    RECOVERED (stale is not recovered);
 *  - one requested evidenceKey UNKNOWN (or any non-OK status)
 *    -> CONFIRMED_STALE;
 *  - a requested evidenceKey missing from the projection -> CONFIRMED_STALE
 *    (fail closed, never RECOVERED);
 *  - recheck healthy but verification stale (disagreement) -> SOURCE_FAILED;
 *  - recheck read rejection -> SOURCE_FAILED after exactly 1 read;
 *  - bounded-read timeout -> TIMED_OUT with no RUNNING attempt left;
 *  - evidenceKeys carrying control characters or oversized strings
 *    -> PRECONDITION_FAILED with zero evidence reads and zero claims;
 *  - lowercase issueCode 'status_unknown' -> PRECONDITION_FAILED (the six
 *    supervisor issue codes are accepted case-sensitively);
 *  - targetKey 'database' / 'vercel-analytics' (non-subject shapes) and
 *    subject keys outside /^[A-Z][A-Z0-9_]{2,63}$/ -> PRECONDITION_FAILED;
 *  - per-runbook flag off -> PRECONDITION_FAILED with zero evidence reads;
 *  - kill switch denied -> BLOCKED_KILL_SWITCH, winning over an open circuit
 *    and over an already-claimed key;
 *  - 40 concurrent same-key executes -> exactly one claim and one finish;
 *  - a different subject (targetKey) on the same UTC day is a separate
 *    attempt;
 *  - projection records, the request and every audit event are deeply
 *    frozen; summaries stay <= 200 chars and canary-free;
 *  - the executor never throws, even when every dependency rejects.
 *
 * PENDING-INTEGRATION: skips loudly until Worker B lands runbook-2 support in
 * the executor (detected textually: some file under src/remediation/executor/
 * must reference RB-INCIDENT-RECOVERY-VERIFY-001 — the runbook-1-only
 * executor present in this worktree today does NOT).
 *
 * DOCUMENTED SEAM (reconciled to the landed implementation): options bag
 * { attemptStore, evidence: {read}, killSwitch: {check('auto-remediation')},
 * runbookEnabled: (runbookKey) => boolean  — gates RB-READONLY-RECHECK-001,
 * recoveryVerifyEnabled?: (runbookKey) => boolean — gates
 * RB-INCIDENT-RECOVERY-VERIFY-001 (undefined = disabled, fail closed),
 * audit?, now?, recheckTimeoutMs?, circuit? }. The two bounded reads both
 * come from the single injected evidence port (read called exactly 2x on a
 * successful run).
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
import { collectStrings, deepFreeze, findProperty, RecordingAuditSink } from './fixtures';
import * as fs from 'fs';
import * as path from 'path';

// --- synthetic instants / canaries (obviously fake) ---

const T0 = Date.UTC(2026, 9, 12, 9, 0, 0, 0);
const PROJECTION_CANARY = 'LEAK_CANARY_PROJ_4c81aa';
const ERROR_CANARY = 'RAW_ERROR_TEXT_CANARY_6e52d0';

const RUNBOOK_KEY = 'RB-INCIDENT-RECOVERY-VERIFY-001';
const RUNBOOK_VERSION = '1';
const DAY = '2026-10-12';
const FRESH_UNTIL = '2026-10-12T10:00:00Z'; // > T0: fresh
const STALE_UNTIL = '2026-10-12T08:00:00Z'; // < T0: stale
const ACCEPTED_ISSUE_CODES = [
  'EVIDENCE_MISSING',
  'EVIDENCE_STALE',
  'SOURCE_DEGRADED',
  'STATUS_UNKNOWN',
  'REPEATED_FAILURES',
  'SOURCE_FAILED',
] as const;
const EVIDENCE_KEYS = ['backups-daily', 'public-website'] as const; // closed source catalogue
                                                       // (src/supervisor/supervisor-options.ts
                                                       // DEFAULT_SOURCE_KEYS); the projection
                                                       // validator rejects unknown source keys.

function makeRequest(
  overrides: Partial<RemediationExecutionRequest> = {},
): RemediationExecutionRequest {
  return {
    proposalId: 'prop-synth-r2-001',
    runbookKey: RUNBOOK_KEY,
    runbookVersion: RUNBOOK_VERSION,
    issueCode: 'SOURCE_DEGRADED',
    targetKey: 'MAIN_WEBSITE',
    clientKey: 'client-synth-alpha',
    environmentKey: 'env-synth-alpha',
    idempotencyDayUtc: DAY,
    evidenceKeys: [...EVIDENCE_KEYS],
    nowMs: T0,
    ...overrides,
  };
}

// --- fake attempt store (typed against the coordinator-owned contract) ---

class FakeAttemptStore implements AttemptStore {
  /** Every claim attempt (including idempotent rejects). */
  readonly claimed: ClaimAttemptInput[] = [];
  /** Claims that actually created a RUNNING record (exactly-once winners). */
  acceptedClaims = 0;
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
    this.acceptedClaims += 1;
    this.seq += 1;
    const record: RemediationAttemptRecord = {
      attemptId: `att-synth-r2-${this.seq}`,
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

interface SyntheticRecord {
  sourceKey: string;
  status: string;
  freshUntilIso: string;
  safeSummary?: string;
}

function makeRecord(
  sourceKey: string,
  status: string,
  freshUntilIso: string,
  safeSummary = 'synthetic safe summary',
): Record<string, unknown> {
  return {
    sourceKey,
    status,
    severity: 'warning',
    observedAt: '2026-10-12T08:00:00Z',
    freshUntil: freshUntilIso,
    criticality: 'required',
    safeSummary,
    counts: { samples: 1 },
  };
}

function makeProjection(spec: readonly SyntheticRecord[]): Record<string, unknown> {
  return {
    client: 'client-synth-alpha',
    environment: 'env-synth-alpha',
    records: spec.map((r) => makeRecord(r.sourceKey, r.status, r.freshUntilIso, r.safeSummary)),
  };
}

function allOkFresh(safeSummary?: string): Record<string, unknown> {
  return makeProjection(
    EVIDENCE_KEYS.map((sourceKey) => ({
      sourceKey,
      status: 'OK',
      freshUntilIso: FRESH_UNTIL,
      safeSummary,
    })),
  );
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
    if (this.script.length === 0) return allOkFresh();
    return this.script.length > 1 ? this.script.shift()! : this.script[0];
  }
}

// --- runtime module loading + runbook-2 landed detection ---

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

/**
 * Runbook-2 landed gate: the runbook-1-only executor ships in this worktree
 * today AND the coordinator seam executor-contract.ts already mentions the
 * runbook-2 key in its evidenceKeys doc comment — so detection must exclude
 * the contract file and require the key in an IMPLEMENTATION file (Worker B
 * must at minimum add recovery-verify-runbook.ts and wire it into the
 * executor/registry).
 */
function recoveryRunbookReferenced(): boolean {
  const dir = path.join(__dirname, '..', '..', 'src', 'remediation', 'executor');
  if (!fs.existsSync(dir)) return false;
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith('.ts')) {
        if (path.basename(full) === 'executor-contract.ts') continue; // coordinator seam doc mention
        if (fs.readFileSync(full, 'utf8').includes(RUNBOOK_KEY)) return true;
      }
    }
  }
  return false;
}

const executorModule = loadExecutorModule();
const recoveryLanded = executorModule !== undefined && recoveryRunbookReferenced();

if (!recoveryLanded) {
  // eslint-disable-next-line no-console
  console.warn(
    'recovery-verify-adversarial: RB-INCIDENT-RECOVERY-VERIFY-001 support is ' +
      'not present under src/remediation/executor in this worktree; suite ' +
      'PENDING-INTEGRATION (Worker B runbook 2).',
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
 * Construction seam: one complete, consistent options bag reconciled to the
 * landed TierARemediationExecutorOptions. Worker B's final wiring gates the
 * two registry entries through TWO callbacks: `runbookEnabled` gates
 * RB-READONLY-RECHECK-001 exactly as before, and the additive optional
 * `recoveryVerifyEnabled` gates RB-INCIDENT-RECOVERY-VERIFY-001 (undefined =
 * disabled, fail closed). Each test flips exactly the knobs it probes; any
 * future wiring divergence is reconciled HERE, in one place.
 */
function makeHarness(knobs: OptionsKnobs = {}): Harness {
  if (!executorModule) throw new Error('executor module not present in this worktree');
  const store = new FakeAttemptStore();
  const audit = new RecordingAuditSink();
  const evidence = new FakeEvidencePort();
  const decision = knobs.killSwitchAllowed === false ? DENIED_DECISION : ALLOWED_DECISION;
  const recoveryEnabled = knobs.runbookEnabled ?? true;
  const executor = new executorModule.TierARemediationExecutor!({
    attemptStore: store,
    evidence,
    killSwitch: { check: () => decision },
    runbookEnabled: () => true, // runbook-1 gate; irrelevant to these runbook-2 probes
    recoveryVerifyEnabled: () => recoveryEnabled,
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

const describeRecovery = recoveryLanded ? describe : describe.skip;

const OUTCOMES = [
  'EXECUTED',
  'ALREADY_CLAIMED',
  'BLOCKED_KILL_SWITCH',
  'PRECONDITION_FAILED',
  'CIRCUIT_OPEN',
  'INTERNAL_ERROR',
] as const;

describeRecovery('RB-INCIDENT-RECOVERY-VERIFY-001 — adversarial false-recovery gating', () => {
  it('success: all checked sources OK and fresh in both reads -> RECOVERED with exactly 2 evidence reads', async () => {
    const h = makeHarness();
    const result = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect(result['outcome']).toBe('EXECUTED');
    expect(result['resultCode']).toBe('RECOVERED');
    expect(h.evidence.reads).toBe(2);
    expect(h.store.claimed).toHaveLength(1);
    expect(h.store.finished).toHaveLength(1);
  });

  it('false-recovery tripwire: all OK but freshUntil in the past -> CONFIRMED_STALE, never RECOVERED', async () => {
    const h = makeHarness();
    h.evidence.script = [
      makeProjection(
        EVIDENCE_KEYS.map((sourceKey) => ({
          sourceKey,
          status: 'OK',
          freshUntilIso: STALE_UNTIL,
        })),
      ),
    ];
    const result = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect(result['resultCode']).toBe('CONFIRMED_STALE');
    expect(result['resultCode']).not.toBe('RECOVERED');
    expect(h.evidence.reads).toBe(2);
  });

  it('one requested evidenceKey with status UNKNOWN -> CONFIRMED_STALE', async () => {
    const h = makeHarness();
    h.evidence.script = [
      makeProjection([
        { sourceKey: 'backups-daily', status: 'OK', freshUntilIso: FRESH_UNTIL },
        { sourceKey: 'public-website', status: 'UNKNOWN', freshUntilIso: FRESH_UNTIL },
      ]),
    ];
    const result = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect(result['resultCode']).toBe('CONFIRMED_STALE');
  });

  it('a requested evidenceKey missing from the projection -> CONFIRMED_STALE (fail closed, never RECOVERED)', async () => {
    const h = makeHarness();
    h.evidence.script = [
      makeProjection([
        { sourceKey: 'backups-daily', status: 'OK', freshUntilIso: FRESH_UNTIL },
        // public-website requested but absent from the projection.
      ]),
    ];
    const result = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect(result['resultCode']).toBe('CONFIRMED_STALE');
    expect(result['resultCode']).not.toBe('RECOVERED');
  });

  it('empty evidenceKeys verifies EVERY projection record: one DEGRADED record -> CONFIRMED_STALE', async () => {
    const h = makeHarness();
    h.evidence.script = [
      makeProjection([
        { sourceKey: 'backups-daily', status: 'OK', freshUntilIso: FRESH_UNTIL },
        { sourceKey: 'database', status: 'DEGRADED', freshUntilIso: FRESH_UNTIL },
      ]),
    ];
    const result = (await h.executor.execute(
      makeRequest({ evidenceKeys: [] }),
    )) as Record<string, unknown>;
    expect(result['resultCode']).toBe('CONFIRMED_STALE');
  });

  it('recheck healthy but verification stale (disagreement) -> SOURCE_FAILED after exactly 2 reads', async () => {
    const h = makeHarness();
    h.evidence.script = [
      allOkFresh(),
      makeProjection(
        EVIDENCE_KEYS.map((sourceKey) => ({
          sourceKey,
          status: 'OK',
          freshUntilIso: STALE_UNTIL,
        })),
      ),
    ];
    const result = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect(result['resultCode']).toBe('SOURCE_FAILED');
    expect(h.evidence.reads).toBe(2);
  });

  it('recheck read rejection -> SOURCE_FAILED after exactly 1 read (no verification read)', async () => {
    const h = makeHarness();
    h.evidence.error = new Error(`synthetic recheck outage ${ERROR_CANARY}`);
    const result = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect(h.evidence.reads).toBe(1);
    expect(result['resultCode']).toBe('SOURCE_FAILED');
  });

  it('bounded-read timeout -> TIMED_OUT and no RUNNING attempt left behind', async () => {
    const h = makeHarness({ recheckTimeoutMs: 1 });
    h.evidence.hang = true;
    const result = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect(result['resultCode']).toBe('TIMED_OUT');
    expect(h.store.timedOutFinishes()).toHaveLength(1);
    expect(h.store.runningCount()).toBe(0);
  });

  it.each([
    ['control character', ['BAD\nKEY']],
    ['carriage return', ['BAD\rKEY']],
    ['oversized string', [`${'X'.repeat(200)}`]],
    ['empty element', ['']],
  ])(
    'evidenceKeys with %s -> PRECONDITION_FAILED with zero evidence reads and zero claims',
    async (_label, evidenceKeys) => {
      const h = makeHarness();
      const result = (await h.executor.execute(
        makeRequest({ evidenceKeys }),
      )) as Record<string, unknown>;
      expect(result['outcome']).toBe('PRECONDITION_FAILED');
      expect(h.evidence.reads).toBe(0);
      expect(h.store.claimed).toHaveLength(0);
    },
  );

  it('lowercase issueCode status_unknown -> PRECONDITION_FAILED', async () => {
    const h = makeHarness();
    const result = (await h.executor.execute(
      makeRequest({ issueCode: 'status_unknown' }),
    )) as Record<string, unknown>;
    expect(result['outcome']).toBe('PRECONDITION_FAILED');
    expect(h.store.claimed).toHaveLength(0);
    expect(h.evidence.reads).toBe(0);
  });

  it.each(ACCEPTED_ISSUE_CODES)('supervisor issueCode %s is accepted (RECOVERED on healthy projection)', async (issueCode) => {
    const h = makeHarness();
    const result = (await h.executor.execute(makeRequest({ issueCode }))) as Record<
      string,
      unknown
    >;
    expect(result['outcome']).toBe('EXECUTED');
    expect(result['resultCode']).toBe('RECOVERED');
  });

  it.each(['database', 'vercel-analytics'])(
    'non-subject targetKey "%s" -> PRECONDITION_FAILED with zero evidence reads',
    async (targetKey) => {
      const h = makeHarness();
      const result = (await h.executor.execute(makeRequest({ targetKey }))) as Record<
        string,
        unknown
      >;
      expect(result['outcome']).toBe('PRECONDITION_FAILED');
      expect(h.evidence.reads).toBe(0);
      expect(h.store.claimed).toHaveLength(0);
    },
  );

  it.each(['AB', 'A', `${'A'.repeat(65)}`])(
    'subject targetKey "%s" outside /^[A-Z][A-Z0-9_]{2,63}$/ -> PRECONDITION_FAILED',
    async (targetKey) => {
      const h = makeHarness();
      const result = (await h.executor.execute(makeRequest({ targetKey }))) as Record<
        string,
        unknown
      >;
      expect(result['outcome']).toBe('PRECONDITION_FAILED');
    },
  );

  it('per-runbook flag off -> PRECONDITION_FAILED with zero evidence reads and zero claims', async () => {
    const h = makeHarness({ runbookEnabled: false });
    const result = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect(result['outcome']).toBe('PRECONDITION_FAILED');
    expect(h.evidence.reads).toBe(0);
    expect(h.store.claimed).toHaveLength(0);
  });

  it('kill switch denied -> BLOCKED_KILL_SWITCH with zero evidence reads, zero claims, zero finishes', async () => {
    const h = makeHarness({ killSwitchAllowed: false });
    const result = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect(result['outcome']).toBe('BLOCKED_KILL_SWITCH');
    expect(h.evidence.reads).toBe(0);
    expect(h.store.claimed).toHaveLength(0);
    expect(h.store.finished).toHaveLength(0);
  });

  it('kill-switch denial wins over an open circuit (gate order cannot be bypassed)', async () => {
    const h = makeHarness({ killSwitchAllowed: false, circuitOpen: true });
    const result = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect(result['outcome']).toBe('BLOCKED_KILL_SWITCH');
    expect(h.store.claimed).toHaveLength(0);
    expect(h.evidence.reads).toBe(0);
  });

  it('kill-switch denial wins over an already-claimed key (claim is never reached)', async () => {
    const h = makeHarness({ killSwitchAllowed: false });
    await h.store.claim({
      attemptId: 'att-synth-pre',
      runbookKey: RUNBOOK_KEY,
      runbookVersion: RUNBOOK_VERSION,
      targetKey: 'MAIN_WEBSITE',
      issueCode: 'SOURCE_DEGRADED',
      idempotencyKey: `${RUNBOOK_KEY}:MAIN_WEBSITE:${DAY}`,
      nowMs: T0,
    });
    const result = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect(result['outcome']).toBe('BLOCKED_KILL_SWITCH');
  });

  it('40 concurrent identical executes: exactly one accepted claim, one finish, 39 ALREADY_CLAIMED', async () => {
    const h = makeHarness();
    const results = (await Promise.all(
      Array.from({ length: 40 }, () => h.executor.execute(deepFreeze(makeRequest()))),
    )) as Array<Record<string, unknown>>;

    expect(h.store.acceptedClaims).toBe(1);
    expect(h.store.finished).toHaveLength(1);
    const outcomes = results.map((r) => r['outcome']);
    expect(outcomes.filter((o) => o === 'EXECUTED')).toHaveLength(1);
    expect(outcomes.filter((o) => o === 'ALREADY_CLAIMED')).toHaveLength(39);
  });

  it('a different subject (targetKey) on the same UTC day is a separate attempt', async () => {
    const h = makeHarness();
    const first = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    const second = (await h.executor.execute(
      makeRequest({ targetKey: 'BACKUP_PIPELINE' }),
    )) as Record<string, unknown>;
    expect(first['outcome']).toBe('EXECUTED');
    expect(second['outcome']).toBe('EXECUTED');
    expect(h.store.claimed).toHaveLength(2);
    expect(h.store.finished).toHaveLength(2);
  });

  it('projection records may be deeply frozen (engine never mutates evidence)', async () => {
    const h = makeHarness();
    h.evidence.script = [deepFreeze(allOkFresh())];
    const result = (await h.executor.execute(deepFreeze(makeRequest()))) as Record<
      string,
      unknown
    >;
    expect(result['resultCode']).toBe('RECOVERED');
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

  it('summaries never exceed 200 chars and never contain evidence safeSummary text (canary tripwire)', async () => {
    const h = makeHarness();
    h.evidence.script = [allOkFresh(`canary laced ${PROJECTION_CANARY}`)];
    const result = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect(String(result['summary']).length).toBeLessThanOrEqual(200);
    for (const text of collectStrings(result)) {
      expect(text).not.toContain(PROJECTION_CANARY);
    }
    for (const finish of h.store.finished) {
      expect(finish.input.summary.length).toBeLessThanOrEqual(200);
      expect(finish.input.summary).not.toContain(PROJECTION_CANARY);
    }
    expect(h.audit.events.length).toBeGreaterThan(0);
    for (const event of h.audit.events) {
      for (const text of collectStrings(event)) {
        expect(text).not.toContain(PROJECTION_CANARY);
      }
    }
  });

  it('never throws: every dependency throwing/rejecting still yields a closed outcome', async () => {
    const h = makeHarness();
    h.store.alwaysThrow = new Error(`synthetic store outage ${ERROR_CANARY}`);
    h.evidence.error = new Error('synthetic recheck outage');
    const realRecord = h.audit.record.bind(h.audit);
    h.audit.record = (event: unknown) => {
      realRecord(event);
      throw new Error('synthetic audit sink outage');
    };

    const result = (await h.executor.execute(makeRequest())) as Record<string, unknown>;
    expect((OUTCOMES as readonly string[]).includes(result['outcome'] as string)).toBe(true);
  });
});
