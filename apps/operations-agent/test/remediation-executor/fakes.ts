/**
 * Fakes for the Tier A remediation executor specs. Everything is in-memory
 * and deterministic: scripted evidence reads, a manual clock, a manual
 * timer, a capturing audit sink, a fake attempt store with exactly-once
 * claim semantics on the idempotency key.
 */

import type {
  AttemptStore,
  ClaimAttemptInput,
  FinishAttemptInput,
  RemediationAttemptRecord,
} from '../../src/remediation/attempt-contract';
import type { RemediationExecutionRequest } from '../../src/remediation/executor';
import { READONLY_RECHECK_RUNBOOK_KEY, READONLY_RECHECK_RUNBOOK_VERSION } from '../../src/remediation/executor';

export const CLIENT = 'client-a';
export const ENV = 'env-test';
export const TARGET = 'vercel-analytics';
export const OTHER_TARGET = 'imagekit-delivery';
export const DAY = '2026-11-02';
export const FIXED_NOW_MS = Date.UTC(2026, 10, 2, 12, 0, 0);

export interface ManualClock {
  now: () => number;
  set: (ms: number) => void;
  advance: (ms: number) => void;
}

export function makeClock(startMs: number = FIXED_NOW_MS): ManualClock {
  let current = startMs;
  return {
    now: () => current,
    set: (ms: number) => {
      current = ms;
    },
    advance: (ms: number) => {
      current += ms;
    },
  };
}

/** Builds a validator-passing projection with one record for `sourceKey`. */
export function makeProjection(
  sourceKey: string,
  status: string,
  client: string = CLIENT,
  environment: string = ENV,
): Record<string, unknown> {
  const observedAt = new Date(FIXED_NOW_MS).toISOString();
  const freshUntil = new Date(FIXED_NOW_MS + 60_000).toISOString();
  return {
    client,
    environment,
    records: [
      {
        sourceKey,
        status,
        severity: status === 'OK' ? 'none' : status === 'FAILED' ? 'critical' : 'warning',
        observedAt,
        freshUntil,
        criticality: 'analytics',
        safeSummary: `${sourceKey} ${String(status).toLowerCase()} canary-token-free, 1 sample(s)`,
        counts: { samples: 1 },
      },
    ],
  };
}

/** Builds one validator-passing projection record for `sourceKey`. */
export function makeRecord(
  sourceKey: string,
  status: string,
  freshUntilMs: number = FIXED_NOW_MS + 60_000,
  observedAtMs: number = FIXED_NOW_MS,
): Record<string, unknown> {
  return {
    sourceKey,
    status,
    severity: status === 'OK' ? 'none' : status === 'FAILED' ? 'critical' : 'warning',
    observedAt: new Date(observedAtMs).toISOString(),
    freshUntil: new Date(freshUntilMs).toISOString(),
    criticality: 'analytics',
    safeSummary: `${sourceKey} ${String(status).toLowerCase()} canary-token-free, 1 sample(s)`,
    counts: { samples: 1 },
  };
}

/** Builds a validator-passing multi-record projection. */
export function makeMultiProjection(
  records: Record<string, unknown>[],
  client: string = CLIENT,
  environment: string = ENV,
): Record<string, unknown> {
  return { client, environment, records };
}

type EvidenceOutcome =
  | { kind: 'projection'; value: Record<string, unknown> }
  | { kind: 'reject'; error: Error }
  | { kind: 'hang' };

export class FakeEvidence {
  calls: Array<{ clientKey: string; environmentKey: string }> = [];
  private readonly script: EvidenceOutcome[];

  constructor(...outcomes: EvidenceOutcome[]) {
    this.script = outcomes;
  }

  static ok(sourceKey: string = TARGET, status: string = 'OK'): FakeEvidence {
    return new FakeEvidence({ kind: 'projection', value: makeProjection(sourceKey, status) });
  }

  get readCount(): number {
    return this.calls.length;
  }

  read = (clientKey: string, environmentKey: string): Promise<unknown> => {
    this.calls.push({ clientKey, environmentKey });
    if (this.script.length === 0) {
      return Promise.reject(new Error('fake evidence: unscripted call'));
    }
    // Script entries apply per call; the final entry repeats for any further
    // calls (the verification read re-checks the same source).
    const outcome = this.script[Math.min(this.calls.length - 1, this.script.length - 1)];
    if (outcome.kind === 'projection') return Promise.resolve(outcome.value);
    if (outcome.kind === 'reject') return Promise.reject(outcome.error);
    return new Promise(() => undefined); // never settles
  };
}

export class FakeAttemptStore implements AttemptStore {
  readonly claims: ClaimAttemptInput[] = [];
  readonly finishes: Array<{ attemptId: string; input: FinishAttemptInput }> = [];
  readonly records = new Map<string, RemediationAttemptRecord>();
  private byIdempotencyKey = new Map<string, string>();
  private nextFail: 'claim' | 'finish' | null = null;

  failNext(kind: 'claim' | 'finish'): void {
    this.nextFail = kind;
  }

  async claim(input: ClaimAttemptInput): Promise<RemediationAttemptRecord | null> {
    if (this.nextFail === 'claim') {
      this.nextFail = null;
      throw new Error('fake store: claim fault');
    }
    this.claims.push(input);
    if (this.byIdempotencyKey.has(input.idempotencyKey)) return null;
    const record: RemediationAttemptRecord = {
      attemptId: input.attemptId,
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
    this.records.set(record.attemptId, record);
    this.byIdempotencyKey.set(input.idempotencyKey, input.attemptId);
    return Object.freeze({ ...record });
  }

  async finish(
    attemptId: string,
    input: FinishAttemptInput,
  ): Promise<RemediationAttemptRecord | null> {
    if (this.nextFail === 'finish') {
      this.nextFail = null;
      throw new Error('fake store: finish fault');
    }
    this.finishes.push({ attemptId, input });
    const record = this.records.get(attemptId);
    if (!record || record.status !== 'RUNNING') return null;
    const updated: RemediationAttemptRecord = {
      ...record,
      status: input.status,
      resultCode: input.resultCode,
      finishedAtMs: input.nowMs,
      summary: input.summary,
    };
    this.records.set(attemptId, updated);
    return Object.freeze({ ...updated });
  }

  async finalizeStaleRunning(): Promise<readonly string[]> {
    return [];
  }

  async get(attemptId: string): Promise<RemediationAttemptRecord | null> {
    const record = this.records.get(attemptId);
    return record ? Object.freeze({ ...record }) : null;
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<RemediationAttemptRecord | null> {
    const attemptId = this.byIdempotencyKey.get(idempotencyKey);
    return attemptId === undefined ? null : this.get(attemptId);
  }
}

import type { KillSwitchDenialReason } from '../../src/platform/kill-switch/kill-switch.service';

export type FakeGate =
  | { allowed: true; capability: 'auto-remediation' }
  | {
      allowed: false;
      capability: 'auto-remediation';
      reason: KillSwitchDenialReason;
      message: string;
    };

export function killSwitchOf(decision: FakeGate): {
  check: (c: 'auto-remediation') => FakeGate;
} {
  return {
    check: () => decision,
  };
}

export class FakeCircuit {
  opened = false;
  successes = 0;
  failures = 0;

  isOpen = (): boolean => this.opened;

  onSuccess = (): void => {
    this.successes += 1;
  };

  onFailure = (): void => {
    this.failures += 1;
  };
}

/** Manual timer: timers never fire unless the test fires them. */
export class ManualTimer {
  readonly scheduled: Array<{ delayMs: number; fire: () => void }> = [];
  cleared = 0;

  setTimeoutFn = ((fire: () => void, delayMs: number): unknown => {
    const entry = { delayMs, fire };
    this.scheduled.push(entry);
    return entry;
  }) as typeof setTimeout;

  clearTimeoutFn = ((handle: unknown): void => {
    this.cleared += 1;
    const index = this.scheduled.indexOf(handle as (typeof this.scheduled)[number]);
    if (index >= 0) this.scheduled.splice(index, 1);
  }) as typeof clearTimeout;

  fireNext(): void {
    const entry = this.scheduled.shift();
    if (!entry) throw new Error('manual timer: nothing scheduled');
    entry.fire();
  }
}

export class ThrowingAuditSink {
  readonly attempted: unknown[] = [];

  record = (event: unknown): unknown => {
    this.attempted.push(event);
    throw new Error('fake audit sink: recording fault');
  };
}

export function makeRequest(
  overrides: Partial<RemediationExecutionRequest> = {},
): RemediationExecutionRequest {
  return {
    proposalId: 'prop-1',
    runbookKey: READONLY_RECHECK_RUNBOOK_KEY,
    runbookVersion: READONLY_RECHECK_RUNBOOK_VERSION,
    issueCode: 'STATUS_UNKNOWN',
    targetKey: TARGET,
    clientKey: CLIENT,
    environmentKey: ENV,
    idempotencyDayUtc: DAY,
    nowMs: FIXED_NOW_MS,
    ...overrides,
  };
}
