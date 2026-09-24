/**
 * Phase H runbook 2 eval suite: closed two-entry executor registry isolation
 * (Worker B). The executor registry must contain exactly RB-READONLY-RECHECK-001
 * and RB-INCIDENT-RECOVERY-VERIFY-001, with independent per-runbook enable
 * flags and runbook-scoped idempotency:
 *  - enabling ONLY the recovery flag leaves runbook 1 disabled: a runbook-1
 *    request is PRECONDITION_FAILED with zero evidence reads, while a
 *    runbook-2 request executes;
 *  - enabling ONLY the runbook-1 flag leaves runbook 2 disabled (symmetric);
 *  - an unknown runbook key 'RB-INCIDENT-RECOVERY-VERIFY-002' (one digit off
 *    the real key) is PRECONDITION_FAILED even with BOTH flags enabled —
 *    the registry is closed, not prefix-matched;
 *  - runbook-1 idempotency keys are unaffected by runbook-2 executions: a
 *    runbook-2 attempt on the same UTC day does not consume the runbook-1
 *    attempt, and repeated runbook-1 executions still collapse to exactly
 *    one attempt.
 *
 * PENDING-INTEGRATION: skips loudly until Worker B lands runbook-2 support in
 * the executor (detected textually: some file under src/remediation/executor/
 * must reference RB-INCIDENT-RECOVERY-VERIFY-001 — the runbook-1-only
 * executor present in this worktree today does NOT).
 *
 * DOCUMENTED SEAM: same options bag as recovery-verify-adversarial.spec.ts.
 * The landed wiring gates the two registry entries through two callbacks —
 * `runbookEnabled` for RB-READONLY-RECHECK-001 and the additive
 * `recoveryVerifyEnabled` for RB-INCIDENT-RECOVERY-VERIFY-001 (undefined =
 * disabled, fail closed) — so the enabled-key set is wired into BOTH; the
 * executor only consults each callback for its own entry.
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
import { RecordingAuditSink } from './fixtures';
import * as fs from 'fs';
import * as path from 'path';

const T0 = Date.UTC(2026, 9, 12, 9, 0, 0, 0);
const FRESH_UNTIL = '2026-10-12T10:00:00Z';
const DAY = '2026-10-12';

const RUNBOOK1_KEY = 'RB-READONLY-RECHECK-001';
const RUNBOOK2_KEY = 'RB-INCIDENT-RECOVERY-VERIFY-001';
const UNKNOWN_RUNBOOK_KEY = 'RB-INCIDENT-RECOVERY-VERIFY-002';

function makeRequest(
  runbook: 1 | 2,
  overrides: Partial<RemediationExecutionRequest> = {},
): RemediationExecutionRequest {
  const base: RemediationExecutionRequest = {
    proposalId: 'prop-synth-reg-001',
    runbookKey: runbook === 1 ? RUNBOOK1_KEY : RUNBOOK2_KEY,
    runbookVersion: '1',
    issueCode: runbook === 1 ? 'STATUS_UNKNOWN' : 'SOURCE_DEGRADED',
    targetKey: runbook === 1 ? 'vercel-analytics' : 'MAIN_WEBSITE',
    clientKey: 'client-synth-alpha',
    environmentKey: 'env-synth-alpha',
    idempotencyDayUtc: DAY,
    nowMs: T0,
    ...overrides,
  };
  if (runbook === 2) return { ...base, evidenceKeys: ['backups-daily'] };
  return base;
}

class FakeAttemptStore implements AttemptStore {
  readonly claimed: ClaimAttemptInput[] = [];
  readonly finished: Array<{ attemptId: string; input: FinishAttemptInput }> = [];
  private readonly byKey = new Map<string, RemediationAttemptRecord>();
  private readonly byId = new Map<string, RemediationAttemptRecord>();
  private seq = 0;

  async claim(input: ClaimAttemptInput): Promise<RemediationAttemptRecord | null> {
    this.claimed.push(input);
    if (this.byKey.has(input.idempotencyKey)) return null;
    this.seq += 1;
    const record: RemediationAttemptRecord = {
      attemptId: `att-synth-reg-${this.seq}`,
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
          sourceKey: 'backups-daily',
          status: 'OK',
          severity: 'warning',
          observedAt: '2026-10-12T08:00:00Z',
          freshUntil: FRESH_UNTIL,
          criticality: 'required',
          safeSummary: 'synthetic safe summary',
          counts: { samples: 1 },
        },
        {
          sourceKey: 'vercel-analytics',
          status: 'OK',
          severity: 'warning',
          observedAt: '2026-10-12T08:00:00Z',
          freshUntil: FRESH_UNTIL,
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

/**
 * Runbook-2 landed gate (textual, same rule as recovery-verify-adversarial):
 * exclude the coordinator seam executor-contract.ts — its evidenceKeys doc
 * comment already mentions the key without runbook-2 being implemented.
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
        if (fs.readFileSync(full, 'utf8').includes(RUNBOOK2_KEY)) return true;
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
    'registry-isolation: RB-INCIDENT-RECOVERY-VERIFY-001 support is not ' +
      'present under src/remediation/executor in this worktree; suite ' +
      'PENDING-INTEGRATION (Worker B runbook 2).',
  );
}

interface Harness {
  executor: { execute(request: RemediationExecutionRequest): Promise<unknown> };
  store: FakeAttemptStore;
  evidence: FakeEvidencePort;
}

/** runbookEnabledKeys: the exact set of runbook keys whose flag is enabled. */
function makeHarness(runbookEnabledKeys: ReadonlySet<string>): Harness {
  if (!executorModule) throw new Error('executor module not present in this worktree');
  const store = new FakeAttemptStore();
  const evidence = new FakeEvidencePort();
  const executor = new executorModule.TierARemediationExecutor!({
    attemptStore: store,
    evidence,
    killSwitch: { check: () => ({ allowed: true, capability: 'auto-remediation' }) },
    runbookEnabled: (runbookKey: string) => runbookEnabledKeys.has(runbookKey),
    recoveryVerifyEnabled: (runbookKey: string) => runbookEnabledKeys.has(runbookKey),
    audit: new RecordingAuditSink(),
    now: () => T0,
    recheckTimeoutMs: 5_000,
    circuit: { isOpen: () => false, onSuccess: () => undefined, onFailure: () => undefined },
  });
  return { executor, store, evidence };
}

const describeRegistry = recoveryLanded ? describe : describe.skip;

describeRegistry('executor registry — two-entry closed registry isolation', () => {
  it('only the recovery flag enabled: runbook 1 is disabled with zero evidence reads, runbook 2 executes', async () => {
    const h = makeHarness(new Set([RUNBOOK2_KEY]));
    const rb1 = (await h.executor.execute(makeRequest(1))) as Record<string, unknown>;
    expect(rb1['outcome']).toBe('PRECONDITION_FAILED');
    expect(h.evidence.reads).toBe(0);
    expect(h.store.claimed).toHaveLength(0);

    const rb2 = (await h.executor.execute(makeRequest(2))) as Record<string, unknown>;
    expect(rb2['outcome']).toBe('EXECUTED');
    expect(rb2['resultCode']).toBe('RECOVERED');
  });

  it('only the runbook-1 flag enabled: runbook 2 is disabled with zero evidence reads, runbook 1 executes', async () => {
    const h = makeHarness(new Set([RUNBOOK1_KEY]));
    const rb2 = (await h.executor.execute(makeRequest(2))) as Record<string, unknown>;
    expect(rb2['outcome']).toBe('PRECONDITION_FAILED');
    expect(h.evidence.reads).toBe(0);
    expect(h.store.claimed).toHaveLength(0);

    const rb1 = (await h.executor.execute(makeRequest(1))) as Record<string, unknown>;
    expect(rb1['outcome']).toBe('EXECUTED');
    expect(rb1['resultCode']).toBe('RECOVERED');
  });

  it('unknown runbookKey RB-INCIDENT-RECOVERY-VERIFY-002 -> PRECONDITION_FAILED even with BOTH flags enabled', async () => {
    const h = makeHarness(new Set([RUNBOOK1_KEY, RUNBOOK2_KEY]));
    const result = (await h.executor.execute(
      makeRequest(2, { runbookKey: UNKNOWN_RUNBOOK_KEY }),
    )) as Record<string, unknown>;
    expect(result['outcome']).toBe('PRECONDITION_FAILED');
    expect(h.store.claimed).toHaveLength(0);
    expect(h.evidence.reads).toBe(0);
  });

  it('runbook-1 idempotency keys are unaffected by runbook-2 executions (independent per-runbook attempt streams)', async () => {
    const h = makeHarness(new Set([RUNBOOK1_KEY, RUNBOOK2_KEY]));

    // A runbook-2 attempt on this UTC day must not consume the runbook-1 key.
    const rb2 = (await h.executor.execute(makeRequest(2))) as Record<string, unknown>;
    expect(rb2['outcome']).toBe('EXECUTED');

    const rb1First = (await h.executor.execute(makeRequest(1))) as Record<string, unknown>;
    expect(rb1First['outcome']).toBe('EXECUTED');
    const rb1Second = (await h.executor.execute(makeRequest(1))) as Record<string, unknown>;
    expect(rb1Second['outcome']).toBe('ALREADY_CLAIMED');

    // The runbook-2 attempt also still stands alone (no cross-runbook claim).
    const rb2Second = (await h.executor.execute(makeRequest(2))) as Record<string, unknown>;
    expect(rb2Second['outcome']).toBe('ALREADY_CLAIMED');

    expect(h.store.attemptCount).toBe(2);
    expect(h.store.finished).toHaveLength(2);
    expect(h.store.claimed.filter((c) => c.runbookKey === RUNBOOK1_KEY)).toHaveLength(2);
    expect(h.store.claimed.filter((c) => c.runbookKey === RUNBOOK2_KEY)).toHaveLength(2);
  });
});
