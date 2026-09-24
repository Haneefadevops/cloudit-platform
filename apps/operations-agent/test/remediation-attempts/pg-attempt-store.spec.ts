/**
 * Acceptance tests for the durable remediation-attempt store (Worker A,
 * Phase H). All database access goes through an injected fake PgClientLike
 * backed by an in-memory emulation of operations.remediation_attempts; no
 * real connection is ever attempted. All fixture values are synthetic.
 */

import {
  AttemptStore,
  ClaimAttemptInput,
  FinishAttemptInput,
  PgAttemptStore,
  createPgAttemptStore,
} from '../../src/remediation/attempts';
import {
  FIXED_NOW_MS,
  FakeAttemptTable,
  FakePgClient,
  PASSWORD,
  baseClaimInput,
  makeClock,
  makePgFactory,
} from './fakes';

function makeStore(
  table: FakeAttemptTable,
  overrides: Record<string, unknown> = {},
): { store: AttemptStore; client: FakePgClient; capturedConfig: () => Record<string, unknown> } {
  const client = new FakePgClient(table);
  const { pgFactory, capturedConfig } = makePgFactory(client);
  const store = createPgAttemptStore({
    host: 'db.internal',
    port: 5432,
    database: 'operations',
    user: 'operations_reader',
    password: PASSWORD,
    pgFactory,
    ...overrides,
  });
  return { store, client, capturedConfig };
}

const FINISH_INPUT: FinishAttemptInput = {
  status: 'SUCCEEDED',
  resultCode: 'RECOVERED',
  summary: 'source re-published, snapshot fresh',
  nowMs: FIXED_NOW_MS + 60_000,
};

describe('createPgAttemptStore option validation', () => {
  const base = {
    host: 'db.internal',
    port: 5432,
    database: 'operations',
    user: 'operations_reader',
    password: PASSWORD,
  };

  it('rejects a missing password (fail closed)', () => {
    expect(() => new PgAttemptStore({ ...base, password: undefined as unknown as string })).toThrow(
      'password must be configured',
    );
  });

  it('rejects malformed host, port, database and user', () => {
    expect(() => new PgAttemptStore({ ...base, host: '' })).toThrow('host');
    expect(() => new PgAttemptStore({ ...base, port: 0 })).toThrow('port');
    expect(() => new PgAttemptStore({ ...base, port: 70000 })).toThrow('port');
    expect(() => new PgAttemptStore({ ...base, database: '' })).toThrow('database');
    expect(() => new PgAttemptStore({ ...base, user: '' })).toThrow('user');
  });

  it('rejects a non-positive query timeout', () => {
    expect(() => new PgAttemptStore({ ...base, queryTimeoutMs: 0 })).toThrow('queryTimeoutMs');
  });
});

describe('PgAttemptStore.claim', () => {
  it('claims a new attempt and returns the frozen, correctly mapped record', async () => {
    const table = new FakeAttemptTable();
    const { store, client } = makeStore(table);

    const record = await store.claim(baseClaimInput() as unknown as ClaimAttemptInput);

    expect(record).not.toBeNull();
    expect(Object.isFrozen(record)).toBe(true);
    expect(record).toMatchObject({
      attemptId: 'att-0001',
      runbookKey: 'workflow.stale-snapshot.republish',
      runbookVersion: '1.0.0',
      targetKey: 'workflow:wf-77',
      issueCode: 'WF_STALE_SNAPSHOT',
      idempotencyKey: 'idem-2026-11-02-wf-77',
      status: 'RUNNING',
      resultCode: null,
      claimedAtMs: FIXED_NOW_MS,
      finishedAtMs: null,
    });
    expect(typeof record!.summary).toBe('string');
    expect(client.connected).toBe(true);
    expect(client.ended).toBe(true);
    expect(table.size()).toBe(1);
  });

  it('persists clientKey/environmentKey and falls back to "unknown" when absent', async () => {
    const table = new FakeAttemptTable();
    const { store } = makeStore(table);

    const scoped = await store.claim(
      baseClaimInput({ attemptId: 'att-a', idempotencyKey: 'idem-a', clientKey: 'cavetta', environmentKey: 'production' }) as unknown as ClaimAttemptInput,
    );
    expect(scoped).not.toBeNull();
    const scopedRow = table.rows().find((r) => r.attempt_id === 'att-a')!;
    expect(scopedRow.client_key).toBe('cavetta');
    expect(scopedRow.environment_key).toBe('production');

    const unscoped = await store.claim(
      baseClaimInput({ attemptId: 'att-b', idempotencyKey: 'idem-b' }) as unknown as ClaimAttemptInput,
    );
    expect(unscoped).not.toBeNull();
    const unscopedRow = table.rows().find((r) => r.attempt_id === 'att-b')!;
    expect(unscopedRow.client_key).toBe('unknown');
    expect(unscopedRow.environment_key).toBe('unknown');
  });

  it('returns null for a duplicate idempotency key (replay)', async () => {
    const table = new FakeAttemptTable();
    const { store } = makeStore(table);

    const first = await store.claim(baseClaimInput() as unknown as ClaimAttemptInput);
    const replay = await store.claim(baseClaimInput() as unknown as ClaimAttemptInput);

    expect(first).not.toBeNull();
    expect(replay).toBeNull();
    expect(table.size()).toBe(1);
  });

  it('resolves exactly one winner among concurrent claims', async () => {
    const table = new FakeAttemptTable();
    const client = new FakePgClient(table);
    client.yieldBeforeQuery = true;
    const { pgFactory } = makePgFactory(client);
    const store = createPgAttemptStore({
      host: 'db.internal',
      port: 5432,
      database: 'operations',
      user: 'operations_reader',
      password: PASSWORD,
      pgFactory,
    });

    const claims = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        store.claim(
          baseClaimInput({ attemptId: `att-conc-${i}` }) as unknown as ClaimAttemptInput,
        ),
      ),
    );

    const winners = claims.filter((c) => c !== null);
    expect(winners).toHaveLength(1);
    expect(table.size()).toBe(1);
  });

  it('returns null on a database error, never throws, still disconnects', async () => {
    const table = new FakeAttemptTable();
    const { store, client } = makeStore(table);
    client.failOnQuery = () => new Error('connection reset by peer');

    const result = await store.claim(baseClaimInput() as unknown as ClaimAttemptInput);

    expect(result).toBeNull();
    expect(client.ended).toBe(true);
  });

  it('returns null when the connection itself fails', async () => {
    const table = new FakeAttemptTable();
    const failingClient = new FakePgClient(table);
    failingClient.failOnConnect = new Error('auth failed');
    const { pgFactory } = makePgFactory(failingClient);
    const failingStore = createPgAttemptStore({
      host: 'db.internal',
      port: 5432,
      database: 'operations',
      user: 'operations_reader',
      password: PASSWORD,
      pgFactory,
    });

    await expect(
      failingStore.claim(baseClaimInput() as unknown as ClaimAttemptInput),
    ).resolves.toBeNull();
  });

  it('returns null on invalid input instead of throwing', async () => {
    const table = new FakeAttemptTable();
    const { store, client } = makeStore(table);

    const invalidInputs: Record<string, unknown>[] = [
      { ...baseClaimInput(), idempotencyKey: 'bad\nkey' },
      { ...baseClaimInput(), idempotencyKey: '' },
      { ...baseClaimInput(), idempotencyKey: 'x'.repeat(129) },
      { ...baseClaimInput(), runbookKey: 'x'.repeat(129) },
      { ...baseClaimInput(), targetKey: 'tab\tkey' },
      { ...baseClaimInput(), issueCode: 'bad\x7fissue' },
      { ...baseClaimInput(), attemptId: 'y'.repeat(65) },
      { ...baseClaimInput(), attemptId: '' },
      { ...baseClaimInput(), clientKey: 'bad\rkey' },
      { ...baseClaimInput(), environmentKey: 'x'.repeat(129) },
      { ...baseClaimInput(), nowMs: -5 },
      { ...baseClaimInput(), nowMs: Number.MAX_SAFE_INTEGER },
    ];

    for (const input of invalidInputs) {
      await expect(store.claim(input as unknown as ClaimAttemptInput)).resolves.toBeNull();
    }
    // Not one invalid input reached the fake database.
    expect(client.queries).toHaveLength(0);
    expect(table.size()).toBe(0);
  });

  it('falls back to the injected clock when nowMs is not a valid integer', async () => {
    const table = new FakeAttemptTable();
    const clock = makeClock(FIXED_NOW_MS + 5_000);
    const { store } = makeStore(table, { now: clock.now });

    const record = await store.claim(
      baseClaimInput({ nowMs: 'not-a-number' }) as unknown as ClaimAttemptInput,
    );

    expect(record).not.toBeNull();
    expect(record!.claimedAtMs).toBe(FIXED_NOW_MS + 5_000);
  });

  it('passes statement_timeout and connectionTimeoutMillis to the pg factory', async () => {
    const table = new FakeAttemptTable();
    const { store, capturedConfig } = makeStore(table, { queryTimeoutMs: 4321 });

    await store.claim(baseClaimInput() as unknown as ClaimAttemptInput);

    const captured = capturedConfig();
    expect(captured.statement_timeout).toBe(4321);
    expect(captured.connectionTimeoutMillis).toBe(4321);
    expect(captured.user).toBe('operations_reader');
    expect(captured.password).toBe(PASSWORD);
  });

  it('uses parameterized DML with no interpolated secrets', async () => {
    const table = new FakeAttemptTable();
    const { store, client } = makeStore(table);

    await store.claim(
      baseClaimInput({ idempotencyKey: PASSWORD }) as unknown as ClaimAttemptInput,
    );

    // The idempotency key went through a bind parameter, never the statement
    // text, and the password never appears anywhere.
    expect(client.queries.join('\n')).not.toContain(PASSWORD);
    expect(client.queries[0]).toContain('ON CONFLICT (idempotency_key) DO NOTHING');
  });
});

describe('PgAttemptStore.finish', () => {
  it('finishes a RUNNING attempt once and returns the frozen updated record', async () => {
    const table = new FakeAttemptTable();
    const { store } = makeStore(table);
    const claimed = await store.claim(baseClaimInput() as unknown as ClaimAttemptInput);
    expect(claimed).not.toBeNull();

    const finished = await store.finish(claimed!.attemptId, FINISH_INPUT);

    expect(finished).not.toBeNull();
    expect(Object.isFrozen(finished)).toBe(true);
    expect(finished).toMatchObject({
      attemptId: 'att-0001',
      status: 'SUCCEEDED',
      resultCode: 'RECOVERED',
      claimedAtMs: FIXED_NOW_MS,
      finishedAtMs: FIXED_NOW_MS + 60_000,
    });
    expect(finished!.summary).toBe(FINISH_INPUT.summary);
  });

  it('returns null on a second finish (once-only) and on an unknown attempt id', async () => {
    const table = new FakeAttemptTable();
    const { store } = makeStore(table);
    const claimed = await store.claim(baseClaimInput() as unknown as ClaimAttemptInput);

    const first = await store.finish(claimed!.attemptId, FINISH_INPUT);
    const second = await store.finish(claimed!.attemptId, FINISH_INPUT);
    const unknown = await store.finish('att-does-not-exist', FINISH_INPUT);

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(unknown).toBeNull();
  });

  it('returns null when the stored row is not RUNNING', async () => {
    const table = new FakeAttemptTable();
    table.seed([
      {
        attempt_id: 'att-stuck',
        runbook_key: 'workflow.stale-snapshot.republish',
        runbook_version: '1.0.0',
        target_key: 'workflow:wf-77',
        issue_code: 'WF_STALE_SNAPSHOT',
        idempotency_key: 'idem-stuck',
        status: 'FAILED',
        result_code: 'TIMED_OUT',
        claimed_at: new Date(FIXED_NOW_MS - 3_600_000),
        finished_at: new Date(FIXED_NOW_MS - 3_000_000),
        summary: 'timed out by sweep',
        client_key: 'cavetta',
        environment_key: 'production',
      },
    ]);
    const { store } = makeStore(table);

    await expect(store.finish('att-stuck', FINISH_INPUT)).resolves.toBeNull();
  });

  it('truncates over-long summaries to the 200-char contract bound', async () => {
    const table = new FakeAttemptTable();
    const { store } = makeStore(table);
    const claimed = await store.claim(baseClaimInput() as unknown as ClaimAttemptInput);

    const finished = await store.finish(claimed!.attemptId, {
      ...FINISH_INPUT,
      summary: 's'.repeat(250),
    });

    expect(finished).not.toBeNull();
    expect(finished!.summary).toHaveLength(200);
  });

  it('returns null on invalid input instead of throwing', async () => {
    const table = new FakeAttemptTable();
    const { store, client } = makeStore(table);
    const claimed = await store.claim(baseClaimInput() as unknown as ClaimAttemptInput);

    const queriesBefore = client.queries.length;
    await expect(store.finish('bad\nid', FINISH_INPUT)).resolves.toBeNull();
    await expect(
      store.finish('x'.repeat(65), FINISH_INPUT),
    ).resolves.toBeNull();
    await expect(store.finish(claimed!.attemptId, { ...FINISH_INPUT, status: 'RUNNING' as never })).resolves.toBeNull();
    await expect(
      store.finish(claimed!.attemptId, { ...FINISH_INPUT, resultCode: 'BOGUS' as never }),
    ).resolves.toBeNull();
    await expect(
      store.finish(claimed!.attemptId, { ...FINISH_INPUT, summary: '' }),
    ).resolves.toBeNull();
    await expect(
      store.finish(claimed!.attemptId, { ...FINISH_INPUT, nowMs: -1 }),
    ).resolves.toBeNull();
    // Not one invalid finish reached the fake database.
    expect(client.queries.length).toBe(queriesBefore);
  });

  it('returns null on a database error, never throws', async () => {
    const table = new FakeAttemptTable();
    const { store, client } = makeStore(table);
    const claimed = await store.claim(baseClaimInput() as unknown as ClaimAttemptInput);
    client.failOnQuery = () => new Error('statement timeout');

    await expect(store.finish(claimed!.attemptId, FINISH_INPUT)).resolves.toBeNull();
  });
});

describe('PgAttemptStore.finalizeStaleRunning', () => {
  function seedMixedTable(): FakeAttemptTable {
    const table = new FakeAttemptTable();
    table.seed([
      {
        attempt_id: 'att-old',
        runbook_key: 'rb',
        runbook_version: '1.0.0',
        target_key: 't1',
        issue_code: 'WF_STALE_SNAPSHOT',
        idempotency_key: 'idem-old',
        status: 'RUNNING',
        result_code: null,
        claimed_at: new Date(FIXED_NOW_MS - 7_200_000),
        finished_at: null,
        summary: 'attempt claimed',
        client_key: 'cavetta',
        environment_key: 'production',
      },
      {
        attempt_id: 'att-fresh',
        runbook_key: 'rb',
        runbook_version: '1.0.0',
        target_key: 't2',
        issue_code: 'WF_STALE_SNAPSHOT',
        idempotency_key: 'idem-fresh',
        status: 'RUNNING',
        result_code: null,
        claimed_at: new Date(FIXED_NOW_MS - 60_000),
        finished_at: null,
        summary: 'attempt claimed',
        client_key: 'cavetta',
        environment_key: 'production',
      },
      {
        attempt_id: 'att-done',
        runbook_key: 'rb',
        runbook_version: '1.0.0',
        target_key: 't3',
        issue_code: 'WF_STALE_SNAPSHOT',
        idempotency_key: 'idem-done',
        status: 'SUCCEEDED',
        result_code: 'RECOVERED',
        claimed_at: new Date(FIXED_NOW_MS - 7_200_000),
        finished_at: new Date(FIXED_NOW_MS - 7_000_000),
        summary: 'recovered',
        client_key: 'cavetta',
        environment_key: 'production',
      },
    ]);
    return table;
  }

  it('finalizes only old RUNNING rows and returns their ids', async () => {
    const table = seedMixedTable();
    const { store } = makeStore(table);

    const ids = await store.finalizeStaleRunning(3_600_000, FIXED_NOW_MS);

    expect(ids).toEqual(['att-old']);
    expect(Object.isFrozen(ids)).toBe(true);

    const rows = table.rows();
    const old = rows.find((r) => r.attempt_id === 'att-old')!;
    expect(old.status).toBe('FAILED');
    expect(old.result_code).toBe('TIMED_OUT');
    expect(epochOf(old.finished_at)).toBe(FIXED_NOW_MS);

    const fresh = rows.find((r) => r.attempt_id === 'att-fresh')!;
    expect(fresh.status).toBe('RUNNING');
    expect(fresh.finished_at).toBeNull();

    const done = rows.find((r) => r.attempt_id === 'att-done')!;
    expect(done.status).toBe('SUCCEEDED');
    expect(done.result_code).toBe('RECOVERED');
  });

  it('returns an empty list when nothing is stale or on invalid input', async () => {
    const freshTable = new FakeAttemptTable();
    freshTable.seed([
      {
        attempt_id: 'att-only-fresh',
        runbook_key: 'rb',
        runbook_version: '1.0.0',
        target_key: 't',
        issue_code: 'ISSUE',
        idempotency_key: 'idem-only-fresh',
        status: 'RUNNING',
        result_code: null,
        claimed_at: new Date(FIXED_NOW_MS),
        finished_at: null,
        summary: 'attempt claimed',
        client_key: 'cavetta',
        environment_key: 'production',
      },
    ]);
    const { store: freshStore } = makeStore(freshTable);
    // A clock 60s ahead still leaves the freshly claimed row inside the window.
    await expect(
      freshStore.finalizeStaleRunning(3_600_000, FIXED_NOW_MS + 60_000),
    ).resolves.toEqual([]);

    const table = seedMixedTable();
    const { store } = makeStore(table);
    await expect(store.finalizeStaleRunning(0, FIXED_NOW_MS)).resolves.toEqual([]);
    await expect(store.finalizeStaleRunning(-5, FIXED_NOW_MS)).resolves.toEqual([]);
    await expect(store.finalizeStaleRunning(Number.NaN, FIXED_NOW_MS)).resolves.toEqual([]);
    // A cutoff before the epoch must not touch anything.
    await expect(store.finalizeStaleRunning(8_640_000_000_000, FIXED_NOW_MS)).resolves.toEqual([]);
    expect(table.rows().filter((r) => r.status === 'FAILED')).toHaveLength(0);
  });

  it('returns an empty list on a database error, never throws', async () => {
    const table = seedMixedTable();
    const { store, client } = makeStore(table);
    client.failOnQuery = () => new Error('connection reset by peer');

    await expect(store.finalizeStaleRunning(3_600_000, FIXED_NOW_MS)).resolves.toEqual([]);
  });
});

describe('PgAttemptStore.get and findByIdempotencyKey', () => {
  it('maps a stored row by attempt id and by idempotency key', async () => {
    const table = new FakeAttemptTable();
    const { store } = makeStore(table);
    const claimed = await store.claim(baseClaimInput() as unknown as ClaimAttemptInput);

    const byId = await store.get(claimed!.attemptId);
    const byKey = await store.findByIdempotencyKey(claimed!.idempotencyKey);

    expect(byId).toEqual(claimed);
    expect(byKey).toEqual(claimed);
    expect(Object.isFrozen(byId)).toBe(true);
    expect(Object.isFrozen(byKey)).toBe(true);
  });

  it('returns null for unknown ids and keys', async () => {
    const table = new FakeAttemptTable();
    const { store } = makeStore(table);

    await expect(store.get('att-missing')).resolves.toBeNull();
    await expect(store.findByIdempotencyKey('idem-missing')).resolves.toBeNull();
  });

  it('returns null for invalid keys without touching the database', async () => {
    const table = new FakeAttemptTable();
    const { store, client } = makeStore(table);

    await expect(store.get('bad\nid')).resolves.toBeNull();
    await expect(store.get('')).resolves.toBeNull();
    await expect(store.get('x'.repeat(65))).resolves.toBeNull();
    await expect(store.findByIdempotencyKey('bad\nkey')).resolves.toBeNull();
    await expect(store.findByIdempotencyKey('')).resolves.toBeNull();
    await expect(store.findByIdempotencyKey('x'.repeat(129))).resolves.toBeNull();
    expect(client.queries).toHaveLength(0);
  });

  it('maps timestamptz values to epoch ms for Date and ISO-string shapes', async () => {
    const table = new FakeAttemptTable();
    table.seed([
      {
        attempt_id: 'att-date',
        runbook_key: 'rb',
        runbook_version: '1.0.0',
        target_key: 't1',
        issue_code: 'ISSUE',
        idempotency_key: 'idem-date',
        status: 'FAILED',
        result_code: 'INTERNAL_ERROR',
        claimed_at: new Date(FIXED_NOW_MS - 120_000),
        finished_at: new Date(FIXED_NOW_MS - 60_000),
        summary: 'boom',
        client_key: 'cavetta',
        environment_key: 'production',
      },
      {
        attempt_id: 'att-iso',
        runbook_key: 'rb',
        runbook_version: '1.0.0',
        target_key: 't2',
        issue_code: 'ISSUE',
        idempotency_key: 'idem-iso',
        status: 'RUNNING',
        result_code: null,
        claimed_at: new Date(FIXED_NOW_MS - 30_000).toISOString(),
        finished_at: null,
        summary: 'attempt claimed',
        client_key: 'cavetta',
        environment_key: 'production',
      },
    ]);
    const { store } = makeStore(table);

    const fromDate = await store.get('att-date');
    expect(fromDate).not.toBeNull();
    expect(fromDate!.claimedAtMs).toBe(FIXED_NOW_MS - 120_000);
    expect(fromDate!.finishedAtMs).toBe(FIXED_NOW_MS - 60_000);

    const fromIso = await store.get('att-iso');
    expect(fromIso).not.toBeNull();
    expect(fromIso!.claimedAtMs).toBe(FIXED_NOW_MS - 30_000);
    expect(fromIso!.finishedAtMs).toBeNull();
  });

  it('maps malformed stored rows to null and never throws', async () => {
    const baseRow: Record<string, unknown> = {
      attempt_id: 'att-x',
      runbook_key: 'rb',
      runbook_version: '1.0.0',
      target_key: 't',
      issue_code: 'ISSUE',
      idempotency_key: 'idem-x',
      status: 'RUNNING',
      result_code: null,
      claimed_at: new Date(FIXED_NOW_MS),
      finished_at: null,
      summary: 'attempt claimed',
      client_key: 'cavetta',
      environment_key: 'production',
    };
    const malformed: Record<string, unknown>[] = [
      { ...baseRow, attempt_id: 'att-m1', idempotency_key: 'idem-m1', status: 'WIDGET' },
      { ...baseRow, attempt_id: 'att-m2', idempotency_key: 'idem-m2', result_code: 'BOGUS' },
      {
        ...baseRow,
        attempt_id: 'att-m3',
        idempotency_key: 'idem-m3',
        finished_at: new Date(FIXED_NOW_MS),
      },
      { ...baseRow, attempt_id: 'att-m4', idempotency_key: 'idem-m4', claimed_at: 'not-a-date' },
      { ...baseRow, attempt_id: 'att-m5', idempotency_key: 'idem-m5', claimed_at: null },
      { ...baseRow, attempt_id: 'att-m6', idempotency_key: 'idem-m6', summary: 'x'.repeat(201) },
      { ...baseRow, idempotency_key: 'idem-m7', attempt_id: undefined },
    ];
    const table = new FakeAttemptTable();
    table.seed(malformed);
    const { store } = makeStore(table);

    for (const row of malformed) {
      await expect(store.get(String(row.attempt_id ?? 'none'))).resolves.toBeNull();
      await expect(store.findByIdempotencyKey(String(row.idempotency_key))).resolves.toBeNull();
    }
  });

  it('returns null on a database error, never throws', async () => {
    const table = new FakeAttemptTable();
    const { store, client } = makeStore(table);
    client.failOnQuery = () => new Error('connection reset by peer');

    await expect(store.get('att-0001')).resolves.toBeNull();
    await expect(store.findByIdempotencyKey('idem-2026-11-02-wf-77')).resolves.toBeNull();
  });
});

function epochOf(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  throw new Error(`expected a Date, got ${typeof value}`);
}
