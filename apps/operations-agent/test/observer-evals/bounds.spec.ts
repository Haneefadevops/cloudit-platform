/**
 * Eval suite 4: bounds (operator-plan 11.2 / projection contract).
 *
 * Adversarial inputs: rows with multi-kilobyte string fields, huge counts,
 * many rows per family. The implementation must stay inside the closed
 * bounds at every boundary:
 *   - every produced projection passes the REAL validateEvidenceProjection
 *     (<= 50 records, safeSummary <= 1000 chars, non-negative int counts,
 *      valid ISO timestamps, known source keys only),
 *   - every SQL query is bounded (LIMIT clause, maxRowsPerFamily respected),
 *   - the query count per read() is bounded,
 *   - digest entries <= 13 with bounded summaries,
 *   - no unbounded row value is interpolated into a summary.
 */

import {
  DEFAULT_SOURCE_KEYS,
  validateEvidenceProjection,
} from '../../src/supervisor';
import {
  CANARIES,
  describeEvidenceSource,
  describeSoakDriver,
  endpointObservationRow,
  FakePgClient,
  makePgFactory,
  ManualClock,
  observerModules,
} from './fixtures';

const LONG_MARKER = 'X'.repeat(5000);
const QUERY_COUNT_BOUND = 15;

function hostileClient(): FakePgClient {
  const client = new FakePgClient();
  const huge = {
    ...endpointObservationRow(),
    endpoint_key: `endpoint-${LONG_MARKER}`,
    monitor_key: `monitor-${LONG_MARKER}`,
    correlation_key: `correlation-${LONG_MARKER}`,
    source_system: `source-${LONG_MARKER}`,
  };
  // Many rows per family, each with multi-kilobyte string fields.
  client.when(/endpoint/i, Array.from({ length: 40 }, () => ({ ...huge })));
  client.whenFn(/metric/i, () =>
    Array.from({ length: 40 }, (_, i) => ({
      metric_key: `postgresql.metric-${i}-${LONG_MARKER}`,
      observed_at: '2026-10-05T06:50:00.000Z',
      status: 'GREEN',
      severity: 'none',
      freshness_seconds: 3600,
      value_number: Number.MAX_SAFE_INTEGER,
      correlation_key: `corr-${LONG_MARKER}`,
    })),
  );
  client.when(/incident|backup|restore|workflow|report|provider/i, [
    endpointObservationRow(),
  ]);
  return client;
}

describeEvidenceSource('EvidenceSource — bounds under hostile rows', () => {
  const read = async (
    client: FakePgClient,
    overrides: Record<string, unknown> = {},
  ): Promise<unknown> => {
    const { factory } = makePgFactory(client);
    const source = observerModules.evidenceSource!.createEvidenceSource!({
      host: 'db.internal.test',
      port: 5432,
      database: 'operations',
      user: 'operations_reader',
      password: 'fake-password-value',
      pgFactory: factory,
      ...overrides,
    });
    return source.read('tenant-a', 'production');
  };

  it('produces a projection that passes the REAL fail-closed validator', async () => {
    const client = hostileClient();
    const projection = await read(client);
    const validated = validateEvidenceProjection(projection, new Set(DEFAULT_SOURCE_KEYS));
    if (!validated.ok) {
      expect(validated.errors).toEqual([]);
    }
    expect(validated.ok).toBe(true);
  });

  it('never exceeds 50 records in the projection', async () => {
    const client = hostileClient();
    const projection = (await read(client)) as { records: unknown[] };
    expect(projection.records.length).toBeLessThanOrEqual(50);
  });

  it('keeps every safeSummary within the 1000-char validator maximum', async () => {
    const client = hostileClient();
    const projection = (await read(client)) as {
      records: Array<{ safeSummary: string }>;
    };
    expect(projection.records.length).toBeGreaterThan(0);
    for (const record of projection.records) {
      expect(record.safeSummary.length).toBeLessThanOrEqual(1000);
    }
  });

  it('never interpolates raw row values (hostile markers absent from summaries)', async () => {
    const client = hostileClient();
    const projection = (await read(client)) as {
      records: Array<{ safeSummary: string }>;
    };
    for (const record of projection.records) {
      expect(record.safeSummary).not.toContain(LONG_MARKER.slice(0, 100));
      for (const canary of CANARIES) {
        expect(record.safeSummary).not.toContain(canary);
      }
    }
  });

  it('emits only non-negative integer counts', async () => {
    const client = hostileClient();
    const projection = (await read(client)) as {
      records: Array<{ counts: Record<string, number> }>;
    };
    for (const record of projection.records) {
      for (const [key, value] of Object.entries(record.counts)) {
        expect(key).toMatch(/^[a-z][a-z0-9_]{0,31}$/);
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('bounds the query count per read', async () => {
    const client = hostileClient();
    await read(client);
    expect(client.queries.length).toBeGreaterThan(0);
    expect(client.queries.length).toBeLessThanOrEqual(QUERY_COUNT_BOUND);
  });

  it('puts a LIMIT clause in every bounded query and honours maxRowsPerFamily', async () => {
    const client = hostileClient();
    await read(client, { maxRowsPerFamily: 3 });
    for (const query of client.queries) {
      const limit = /\blimit\s+(\d+)/i.exec(query.text);
      expect(limit).not.toBeNull();
      expect(Number(limit![1])).toBeLessThanOrEqual(3);
    }
  });
});

describeSoakDriver('SoakDriver — digest bounds', () => {
  it('sends at most 13 digest entries with bounded, category-valid fields', async () => {
    const Driver = observerModules.soakDriver!.SoakDriver!;
    const clock = new ManualClock(Date.UTC(2026, 9, 5, 6, 59, 0));
    const digestCalls: Array<{ entries: Array<Record<string, unknown>> }> = [];
    const driver = new Driver({
      evidence: {
        async read(): Promise<unknown> {
          return { client: 'tenant-a', environment: 'production', records: [] };
        },
      },
      supervisor: {
        assess: () => ({
          ok: true,
          assessment: {
            assessment: 'RED',
            summary: 'synthetic',
            evidenceKeys: DEFAULT_SOURCE_KEYS.slice(),
            confidence: 'HIGH',
            issueCode: 'SOURCE_FAILED',
            recommendedRunbook: 'none',
            automationEligibility: 'OWNER_REQUIRED',
          },
        }),
      },
      alerts: {
        async handle(): Promise<unknown> {
          return { action: 'SENT' };
        },
        async sendDigest(_environmentKey: string, _period: 'daily', entries: never[]) {
          digestCalls.push({ entries });
          return { action: 'SENT' };
        },
      },
      clientKey: 'tenant-a',
      environmentKey: 'production',
      intervalMs: 900_000,
      digestHourUtc: 7,
      now: clock.now,
    });

    clock.setUtc(2026, 9, 5, 7, 0, 0);
    const outcome = await driver.tick();
    expect(outcome.status).toBe('DIGEST_SENT');
    expect(digestCalls).toHaveLength(1);

    const entries = digestCalls[0].entries;
    expect(entries.length).toBeLessThanOrEqual(13);
    expect(entries.length).toBeGreaterThan(0);
    const categories = new Set(['RED', 'AMBER', 'GREEN', 'NO_DATA', 'UNKNOWN']);
    for (const entry of entries) {
      expect(typeof entry.subjectKey).toBe('string');
      expect((entry.subjectKey as string).length).toBeGreaterThan(0);
      expect(categories.has(entry.category as string)).toBe(true);
      expect(typeof entry.summary).toBe('string');
      expect((entry.summary as string).length).toBeLessThanOrEqual(200);
      expect(Number.isNaN(Date.parse(entry.lastOccurredAt as string))).toBe(false);
    }
  });
});
