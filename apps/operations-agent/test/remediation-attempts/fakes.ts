/**
 * Fakes for the remediation-attempt store specs (Worker A, Phase H).
 * No real database is ever touched: the FakePgClient emulates the four
 * statements PgAttemptStore issues against a shared in-memory table keyed by
 * idempotency_key, so ON CONFLICT / compare-and-set behavior is exercised for
 * real (including the concurrent-claim case). All fixture values are
 * obviously synthetic.
 */

import type { PgClientLike } from '../../src/remediation/attempts';

export const PASSWORD = 'fake-attempt-writer-password';
export const FIXED_NOW_MS = Date.UTC(2026, 10, 2, 12, 0, 0);

export interface RecordingClock {
  now: () => number;
  set: (ms: number) => void;
  advance: (ms: number) => void;
}

export function makeClock(startMs: number = FIXED_NOW_MS): RecordingClock {
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

function epochMs(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

/**
 * Shared in-memory emulation of operations.remediation_attempts. Rows are
 * keyed by idempotency_key; timestamps stay in whatever shape the caller
 * supplied (Date in production-shaped tests) to exercise timestamptz
 * mapping.
 */
export class FakeAttemptTable {
  private readonly byIdempotencyKey = new Map<string, Record<string, unknown>>();

  has(idempotencyKey: string): boolean {
    return this.byIdempotencyKey.has(idempotencyKey);
  }

  size(): number {
    return this.byIdempotencyKey.size;
  }

  rows(): Record<string, unknown>[] {
    return [...this.byIdempotencyKey.values()];
  }

  seed(rows: Record<string, unknown>[]): void {
    for (const row of rows) {
      this.byIdempotencyKey.set(String(row.idempotency_key), { ...row });
    }
  }

  query(text: string, values: unknown[]): { rows: Record<string, unknown>[] } {
    if (text.includes('INSERT INTO operations.remediation_attempts')) {
      const idempotencyKey = String(values[5]);
      if (this.byIdempotencyKey.has(idempotencyKey)) {
        // ON CONFLICT (idempotency_key) DO NOTHING: no row back.
        return { rows: [] };
      }
      const row: Record<string, unknown> = {
        attempt_id: values[0],
        runbook_key: values[1],
        runbook_version: values[2],
        target_key: values[3],
        issue_code: values[4],
        idempotency_key: idempotencyKey,
        status: 'RUNNING',
        result_code: null,
        claimed_at: values[6],
        finished_at: null,
        summary: values[7],
        client_key: values[8],
        environment_key: values[9],
      };
      this.byIdempotencyKey.set(idempotencyKey, row);
      return { rows: [{ ...row }] };
    }

    if (text.includes('RETURNING attempt_id')) {
      // finalizeStaleRunning: RUNNING rows claimed before the cutoff fail.
      const cutoffMs = epochMs(values[1]);
      const finalized: Record<string, unknown>[] = [];
      if (cutoffMs === null) return { rows: [] };
      for (const row of this.byIdempotencyKey.values()) {
        if (row.status !== 'RUNNING') continue;
        const claimedMs = epochMs(row.claimed_at);
        if (claimedMs === null || claimedMs >= cutoffMs) continue;
        row.status = 'FAILED';
        row.result_code = 'TIMED_OUT';
        row.finished_at = values[0];
        finalized.push({ attempt_id: row.attempt_id });
      }
      return { rows: finalized };
    }

    if (/^\s*UPDATE/i.test(text)) {
      // finish: compare-and-set on attempt_id + status = 'RUNNING'.
      const attemptId = String(values[0]);
      const row = [...this.byIdempotencyKey.values()].find((r) => r.attempt_id === attemptId);
      if (!row || row.status !== 'RUNNING') return { rows: [] };
      row.status = values[1];
      row.result_code = values[2];
      row.summary = values[3];
      row.finished_at = values[4];
      return { rows: [{ ...row }] };
    }

    if (/^\s*SELECT/i.test(text) && text.includes('WHERE attempt_id = $1')) {
      const row = [...this.byIdempotencyKey.values()].find((r) => r.attempt_id === values[0]);
      return { rows: row ? [{ ...row }] : [] };
    }

    if (/^\s*SELECT/i.test(text) && text.includes('WHERE idempotency_key = $1')) {
      const row = this.byIdempotencyKey.get(String(values[0]));
      return { rows: row ? [{ ...row }] : [] };
    }

    throw new Error(`fake attempt table: unhandled statement: ${text.slice(0, 60)}`);
  }
}

export class FakePgClient implements PgClientLike {
  readonly queries: string[] = [];
  readonly boundValues: unknown[][] = [];
  connected = false;
  ended = false;
  /** Force interleaving of concurrent claim() calls like real network I/O. */
  yieldBeforeQuery = false;
  failOnConnect: Error | undefined;
  failOnQuery: ((text: string) => Error | undefined) | undefined;

  constructor(private readonly table: FakeAttemptTable) {}

  async connect(): Promise<void> {
    this.connected = true;
    if (this.failOnConnect) throw this.failOnConnect;
  }

  async query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> {
    if (this.yieldBeforeQuery) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    this.queries.push(text);
    this.boundValues.push(values ?? []);
    const failure = this.failOnQuery?.(text);
    if (failure) throw failure;
    return this.table.query(text, values ?? []);
  }

  async end(): Promise<void> {
    this.ended = true;
  }
}

export interface AttemptStoreHarness {
  client: FakePgClient;
  table: FakeAttemptTable;
  capturedConfig: () => Record<string, unknown>;
}

export function makePgFactory(
  client: FakePgClient,
): { pgFactory: (cfg: object) => PgClientLike; capturedConfig: () => Record<string, unknown> } {
  let captured: Record<string, unknown> = {};
  return {
    pgFactory: (cfg: object) => {
      captured = cfg as Record<string, unknown>;
      return client;
    },
    capturedConfig: () => captured,
  };
}

export function baseClaimInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    attemptId: 'att-0001',
    runbookKey: 'workflow.stale-snapshot.republish',
    runbookVersion: '1.0.0',
    targetKey: 'workflow:wf-77',
    issueCode: 'WF_STALE_SNAPSHOT',
    idempotencyKey: 'idem-2026-11-02-wf-77',
    nowMs: FIXED_NOW_MS,
    ...overrides,
  };
}
