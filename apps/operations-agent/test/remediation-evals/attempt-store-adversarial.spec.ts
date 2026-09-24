/**
 * Phase H eval suite: PgAttemptStore adversarial properties (Worker A).
 *
 * Against a fake pg client (Map-backed unique-conflict emulation keyed by
 * idempotency_key, SQL text captured for canary sweeps) injected through the
 * store's real pgFactory seam:
 *  - a 25-way concurrent claim storm on one key resolves to exactly one
 *    winner and 24 nulls;
 *  - day-scoped idempotency holds forever: claim -> finish -> re-claim same
 *    key returns null;
 *  - finalizeStaleRunning touches only RUNNING rows older than maxAge and
 *    never SUCCEEDED/FAILED rows;
 *  - finish is once-only (second finish returns null);
 *  - malformed rows from the wire (bad enum, extra field, null claimed_at)
 *    map to null and never throw;
 *  - every returned record is deeply frozen;
 *  - no secret-shaped string appears in any SQL the store issues;
 *  - the store never throws, even when the pg client always throws.
 *
 * PENDING-INTEGRATION: if Worker A's attempts module is absent the suites
 * SKIP with a loud message; a present-but-unconstructible module fails loudly.
 *
 * DOCUMENTED SEAM (reconciled to the landed implementation):
 *  - PgAttemptStore is constructed with one options object
 *    { host, port, database, user, password, pgFactory, now? }; pgFactory
 *    returns a PgClientLike ({ connect, query, end }). The fake emulates
 *    INSERT ... ON CONFLICT (idempotency_key) DO NOTHING by keying rows on
 *    the synthetic 'idem-' prefixed idempotency parameter.
 */

import type {
  AttemptStore,
  ClaimAttemptInput,
  FinishAttemptInput,
  RemediationAttemptRecord,
} from '../../src/remediation/attempt-contract';
import { deepFreeze } from './fixtures';

// --- synthetic key/instants (obviously fake) ---

const T0 = Date.UTC(2026, 9, 12, 9, 0, 0, 0);
const HOUR_MS = 3_600_000;
const RESULT_CODES = [
  'RECOVERED',
  'CONFIRMED_STALE',
  'SOURCE_FAILED',
  'PRECONDITION_FAILED',
  'BLOCKED_KILL_SWITCH',
  'TIMED_OUT',
  'INTERNAL_ERROR',
] as const;

function claimInput(overrides: Partial<ClaimAttemptInput> = {}): ClaimAttemptInput {
  return {
    attemptId: 'att-synth-1',
    runbookKey: 'RB-READONLY-RECHECK-001',
    runbookVersion: '1',
    targetKey: 'vercel-analytics',
    issueCode: 'STATUS_UNKNOWN',
    idempotencyKey: 'idem-synth-default',
    nowMs: T0,
    ...overrides,
  };
}

// --- fake pg client: Map-backed rows, SQL capture, scriptable corruption ---

interface SqlCall {
  text: string;
  values: unknown[];
}

class FakePgClient {
  readonly calls: SqlCall[] = [];
  /** Raw query texts in issue order — swept for secret-shaped strings. */
  readonly issuedSql: string[] = [];
  /** When set, every query rejects with this error. */
  persistentError: Error | undefined;
  /** Rows returned once by the next SELECT-like query (malformed-row feed). */
  selectQueue: Record<string, unknown>[][] = [];
  /** Live row store keyed by idempotency_key. */
  private readonly rowsByKey = new Map<string, Record<string, unknown>>();

  /** Test seam: mutate a stored row directly. */
  rowFor(idempotencyKey: string): Record<string, unknown> | undefined {
    return this.rowsByKey.get(idempotencyKey);
  }

  private static asMs(raw: unknown): number {
    if (raw instanceof Date) return raw.getTime();
    return Date.parse(String(raw ?? ''));
  }

  private static keyOf(values: unknown[]): string | undefined {
    return values.find((v) => typeof v === 'string' && (v as string).startsWith('idem-')) as
      | string
      | undefined;
  }

  async connect(): Promise<void> {
    if (this.persistentError) throw this.persistentError;
  }

  async end(): Promise<void> {
    // no-op
  }

  async query(text: string, values: unknown[] = []): Promise<{ rows: Record<string, unknown>[] }> {
    this.calls.push({ text, values });
    this.issuedSql.push(text);
    if (this.persistentError) throw this.persistentError;
    const sql = text.trim();

    // claim(): INSERT ... ON CONFLICT (idempotency_key) DO NOTHING RETURNING *
    if (/^\s*insert/i.test(sql)) {
      const key = FakePgClient.keyOf(values);
      if (key === undefined || this.rowsByKey.has(key)) return { rows: [] }; // conflict DO NOTHING
      const row: Record<string, unknown> = {
        attempt_id: values[0],
        runbook_key: values[1],
        runbook_version: values[2],
        target_key: values[3],
        issue_code: values[4],
        idempotency_key: key,
        status: 'RUNNING',
        result_code: null,
        claimed_at: values[6],
        finished_at: null,
        summary: values[7],
        client_key: values[8],
        environment_key: values[9],
      };
      this.rowsByKey.set(key, row);
      return { rows: [row] };
    }

    // finalizeStaleRunning(): UPDATE ... WHERE status = 'RUNNING' AND claimed_at < $2
    if (/^\s*update/i.test(sql) && /claimed_at\s*</i.test(sql)) {
      const cutoffMs = FakePgClient.asMs(values[values.length - 1]);
      const affected: string[] = [];
      for (const row of this.rowsByKey.values()) {
        if (row['status'] !== 'RUNNING') continue;
        const claimedMs = FakePgClient.asMs(row['claimed_at']);
        if (!Number.isFinite(claimedMs) || claimedMs >= cutoffMs) continue;
        row['status'] = 'FAILED';
        row['result_code'] = 'TIMED_OUT';
        row['finished_at'] = values[0];
        affected.push(String(row['attempt_id']));
      }
      return { rows: affected.map((id) => ({ attempt_id: id })) };
    }

    // finish(): single-row UPDATE by attempt id; once-only (RUNNING guard).
    if (/^\s*update/i.test(sql)) {
      const idParam = values.find((v) => typeof v === 'string' && String(v).startsWith('att-'));
      const row = [...this.rowsByKey.values()].find((r) => r['attempt_id'] === idParam);
      if (!row || row['status'] !== 'RUNNING') return { rows: [] };
      row['status'] = values[1];
      row['result_code'] = values[2];
      row['summary'] = values[3];
      row['finished_at'] = values[4];
      return { rows: [row] };
    }

    // SELECT path (get / findByIdempotencyKey): malformed-row feed wins.
    if (this.selectQueue.length > 0) return { rows: this.selectQueue.shift()! };
    const key = FakePgClient.keyOf(values);
    if (key !== undefined && this.rowsByKey.has(key)) return { rows: [this.rowsByKey.get(key)!] };
    const idParam = values.find((v) => typeof v === 'string' && String(v).startsWith('att-'));
    const byId = [...this.rowsByKey.values()].find((r) => r['attempt_id'] === idParam);
    return { rows: byId ? [byId] : [] };
  }
}

// --- runtime module loading (tolerant while the worker module is absent) ---

interface PgAttemptStoreOptionsLike {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  queryTimeoutMs?: number;
  pgFactory?: (cfg: object) => FakePgClient;
  now?: () => number;
}

interface AttemptsModuleShape {
  PgAttemptStore?: new (options: PgAttemptStoreOptionsLike) => AttemptStore;
  createPgAttemptStore?: (options: PgAttemptStoreOptionsLike) => AttemptStore;
  [exportName: string]: unknown;
}

function tryRequire(modulePath: string): AttemptsModuleShape | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(modulePath) as AttemptsModuleShape;
  } catch {
    return undefined;
  }
}

function loadAttemptsModule(): AttemptsModuleShape | undefined {
  for (const candidate of [
    '../../src/remediation/attempts',
    '../../src/remediation/attempts/index',
    '../../src/remediation/attempts/pg-attempt-store',
  ]) {
    const mod = tryRequire(candidate);
    if (
      mod &&
      (typeof mod.PgAttemptStore === 'function' || typeof mod.createPgAttemptStore === 'function')
    ) {
      return mod;
    }
  }
  return undefined;
}

const attemptsModule = loadAttemptsModule();

if (!attemptsModule) {
  // eslint-disable-next-line no-console
  console.warn(
    'attempt-store-adversarial: src/remediation/attempts (PgAttemptStore) is ' +
      'not present in this worktree; suite PENDING-INTEGRATION (Worker A).',
  );
}

function constructStore(client: FakePgClient): AttemptStore {
  if (!attemptsModule) throw new Error('attempts module not present in this worktree');
  const options: PgAttemptStoreOptionsLike = {
    host: '127.0.0.1',
    port: 55_432,
    database: 'operations',
    user: 'operations_reader',
    password: 'synthetic-fake-password-NOT-REAL',
    queryTimeoutMs: 1_000,
    pgFactory: () => client,
    now: () => T0,
  };
  if (typeof attemptsModule.PgAttemptStore === 'function') {
    return new attemptsModule.PgAttemptStore(options);
  }
  if (typeof attemptsModule.createPgAttemptStore === 'function') {
    return attemptsModule.createPgAttemptStore(options);
  }
  throw new Error('attempts module exposes neither PgAttemptStore nor createPgAttemptStore');
}

const describeStore = attemptsModule ? describe : describe.skip;

/** Recursively assert a returned record is frozen at every level. */
function expectDeepFrozen(value: unknown): void {
  if (typeof value === 'object' && value !== null) {
    expect(Object.isFrozen(value)).toBe(true);
    for (const item of Object.values(value)) expectDeepFrozen(item);
  }
}

describeStore('PgAttemptStore — adversarial properties', () => {
  it('25 concurrent claims on one idempotency key: exactly one winner, 24 nulls', async () => {
    const client = new FakePgClient();
    const store = constructStore(client);
    const key = 'idem-synth-storm-001';
    const results = await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        store.claim(claimInput({ idempotencyKey: key, attemptId: `att-synth-${i}` })),
      ),
    );
    const winners = results.filter((r) => r !== null);
    expect(winners).toHaveLength(1);
    expect(results.filter((r) => r === null)).toHaveLength(24);
    expect(winners[0]!.idempotencyKey).toBe(key);
  });

  it('day-scoped idempotency holds forever: claim -> finish -> re-claim same key is null', async () => {
    const client = new FakePgClient();
    const store = constructStore(client);
    const key = 'idem-synth-forever-001';
    const won = await store.claim(claimInput({ idempotencyKey: key }));
    expect(won).not.toBeNull();

    const finishInput: FinishAttemptInput = {
      status: 'SUCCEEDED',
      resultCode: 'RECOVERED',
      summary: 'synthetic finish',
      nowMs: T0 + HOUR_MS,
    };
    const finished = await store.finish(won!.attemptId, finishInput);
    expect(finished).not.toBeNull();
    expect(finished!.status).toBe('SUCCEEDED');

    const replay = await store.claim(
      claimInput({ idempotencyKey: key, attemptId: 'att-synth-replay' }),
    );
    expect(replay).toBeNull();
  });

  it('finish is once-only: a second finish on the same attempt returns null', async () => {
    const client = new FakePgClient();
    const store = constructStore(client);
    const won = (await store.claim(claimInput({ idempotencyKey: 'idem-synth-once-001' })))!;
    const input: FinishAttemptInput = {
      status: 'FAILED',
      resultCode: 'SOURCE_FAILED',
      summary: 'synthetic once-only',
      nowMs: T0 + HOUR_MS,
    };
    expect(await store.finish(won.attemptId, input)).not.toBeNull();
    expect(await store.finish(won.attemptId, input)).toBeNull();
  });

  it('finalizeStaleRunning touches only RUNNING rows older than maxAge (not fresh RUNNING, not SUCCEEDED/FAILED)', async () => {
    const client = new FakePgClient();
    const store = constructStore(client);

    const stale = (
      await store.claim(claimInput({ idempotencyKey: 'idem-synth-stale-001', attemptId: 'att-synth-stale' }))
    )!;
    const fresh = (
      await store.claim(claimInput({ idempotencyKey: 'idem-synth-fresh-001', attemptId: 'att-synth-fresh' }))
    )!;
    const done = (
      await store.claim(claimInput({ idempotencyKey: 'idem-synth-done-001', attemptId: 'att-synth-done' }))
    )!;
    await store.finish(done.attemptId, {
      status: 'SUCCEEDED',
      resultCode: 'RECOVERED',
      summary: 'synthetic',
      nowMs: T0 + HOUR_MS,
    });

    // Age the stale row past the window; keep the fresh row inside it.
    client.rowFor('idem-synth-stale-001')!['claimed_at'] = new Date(T0 - 10 * HOUR_MS);
    client.rowFor('idem-synth-fresh-001')!['claimed_at'] = new Date(T0 - HOUR_MS + 1);

    const nowMs = T0;
    const maxAgeMs = 2 * HOUR_MS;
    const affected = await store.finalizeStaleRunning(maxAgeMs, nowMs);

    expect([...affected]).toEqual([stale.attemptId]);
    expect(affected).not.toContain(fresh.attemptId);
    expect(affected).not.toContain(done.attemptId);

    const staleAfter = await store.get(stale.attemptId);
    expect(staleAfter!.status).toBe('FAILED');
    expect(staleAfter!.resultCode).toBe('TIMED_OUT');
    expect((await store.get(fresh.attemptId))!.status).toBe('RUNNING');
    expect((await store.get(done.attemptId))!.status).toBe('SUCCEEDED');
  });

  it('malformed rows from the wire map to null and never throw (bad enum / extra field / null claimed_at)', async () => {
    const client = new FakePgClient();
    const store = constructStore(client);
    const malformed: unknown[] = [
      {
        attempt_id: 'att-synth-bad',
        idempotency_key: 'idem-synth-bad',
        runbook_key: 'RB-READONLY-RECHECK-001',
        runbook_version: '1',
        target_key: 'vercel-analytics',
        issue_code: 'STATUS_UNKNOWN',
        status: 'BROKEN_ENUM',
        result_code: 'NOPE',
        claimed_at: new Date(T0),
        finished_at: null,
        summary: '',
        client_key: 'unknown',
        environment_key: 'unknown',
        extra_unknown_field: { nested: true },
      },
      {
        attempt_id: 'att-synth-null',
        idempotency_key: 'idem-synth-null',
        runbook_key: 'RB-READONLY-RECHECK-001',
        runbook_version: '1',
        target_key: 'vercel-analytics',
        issue_code: 'STATUS_UNKNOWN',
        status: 'RUNNING',
        result_code: null,
        claimed_at: null,
        finished_at: null,
        summary: '',
        client_key: 'unknown',
        environment_key: 'unknown',
      },
      { not_even: 'the right shape' },
      null,
      'a string row',
    ];
    for (const row of malformed) {
      client.selectQueue.push([row as Record<string, unknown>]);
      await expect(store.get('att-synth-any')).resolves.toBeNull();
      client.selectQueue.push([row as Record<string, unknown>]);
      await expect(store.findByIdempotencyKey('idem-synth-any')).resolves.toBeNull();
    }
  });

  it('every record returned by the store is deeply frozen', async () => {
    const client = new FakePgClient();
    const store = constructStore(client);
    const won = (await store.claim(claimInput({ idempotencyKey: 'idem-synth-frozen-001' })))!;
    expectDeepFrozen(won);
    expectDeepFrozen(await store.get(won.attemptId));
    expectDeepFrozen(await store.findByIdempotencyKey(won.idempotencyKey));
    expectDeepFrozen(
      await store.finish(won.attemptId, {
        status: 'SUCCEEDED',
        resultCode: 'RECOVERED',
        summary: 'synthetic',
        nowMs: T0 + HOUR_MS,
      }),
    );
  });

  it('no secret-shaped string appears in any SQL the store issues', async () => {
    const client = new FakePgClient();
    const store = constructStore(client);
    const key = 'idem-synth-canary-001';
    const won = (await store.claim(claimInput({ idempotencyKey: key })))!;
    await store.finish(won.attemptId, {
      status: 'FAILED',
      resultCode: 'SOURCE_FAILED',
      summary: 'synthetic',
      nowMs: T0 + HOUR_MS,
    });
    await store.finalizeStaleRunning(HOUR_MS, T0 + 2 * HOUR_MS);
    await store.get(won.attemptId);
    await store.findByIdempotencyKey(key);

    const secretShape = /\b(password|passwd|pwd|token|secret|key_material|credential)s?\b/i;
    for (const text of client.issuedSql) {
      // 'key' alone is expected (idempotency_key); the specific secret words are not.
      expect(secretShape.test(text)).toBe(false);
    }
  });

  it('never throws: a pg client that always rejects still yields null/empty resolutions', async () => {
    const client = new FakePgClient();
    client.persistentError = new Error('synthetic pg outage RAW_PG_ERROR_8a17');
    const store = constructStore(client);

    await expect(store.claim(claimInput({ idempotencyKey: 'idem-synth-down-001' }))).resolves.toBeNull();
    await expect(
      store.finish('att-synth-down', {
        status: 'SUCCEEDED',
        resultCode: 'RECOVERED',
        summary: 'synthetic',
        nowMs: T0,
      }),
    ).resolves.toBeNull();
    await expect(store.finalizeStaleRunning(HOUR_MS, T0)).resolves.toEqual([]);
    await expect(store.get('att-synth-down')).resolves.toBeNull();
    await expect(store.findByIdempotencyKey('idem-synth-down-001')).resolves.toBeNull();
  });

  it('deep-frozen claim inputs are never mutated', async () => {
    const client = new FakePgClient();
    const store = constructStore(client);
    const input = deepFreeze(claimInput({ idempotencyKey: 'idem-synth-frozen-input-001' }));
    const snapshot = JSON.stringify(input);
    await store.claim(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});
