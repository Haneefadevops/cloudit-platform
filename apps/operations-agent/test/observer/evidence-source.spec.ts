/**
 * Acceptance tests for the observer evidence source (Worker A, soak driver).
 * All database access goes through an injected fake PgClientLike; no real
 * connection is ever attempted. All fixture values are obviously synthetic.
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import {
  DEFAULT_SOURCE_KEYS,
  InMemoryAuditSink,
  SupervisorRunResult,
  SupervisorService,
  resolveSupervisorOptions,
  validateEvidenceProjection,
} from '../../src/supervisor';
import {
  EvidenceSource,
  EvidenceSourceOptions,
  PgClientLike,
  createEvidenceSource,
} from '../../src/observer/evidence-source';

const OBSERVED_AT = '2025-09-22T12:00:00.000Z';
const OBSERVED_AT_2 = '2025-09-22T11:30:00.000Z';
const PASSWORD = 'fake-reader-password';
const CLIENT = 'cavetta';
const ENVIRONMENT = 'production';

const KNOWN_SOURCE_KEYS = new Set<string>(DEFAULT_SOURCE_KEYS);

class FakePgClient implements PgClientLike {
  readonly queries: string[] = [];
  readonly boundValues: unknown[][] = [];
  connected = false;
  ended = false;
  failOnQuery: ((text: string) => Error | undefined) | undefined;

  constructor(private readonly scriptFn: (text: string) => Record<string, unknown>[]) {}

  async connect(): Promise<void> {
    this.connected = true;
  }

  async query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> {
    this.queries.push(text);
    this.boundValues.push(values ?? []);
    const failure = this.failOnQuery?.(text);
    if (failure) throw failure;
    return { rows: this.scriptFn(text) };
  }

  async end(): Promise<void> {
    this.ended = true;
  }
}

function script(
  rowsByMarker: Record<string, Record<string, unknown>[]>,
): (text: string) => Record<string, unknown>[] {
  return (text: string) => {
    for (const [marker, rows] of Object.entries(rowsByMarker)) {
      if (text.includes(marker)) return rows;
    }
    return [];
  };
}

function makeSource(
  rowsByMarker: Record<string, Record<string, unknown>[]>,
  overrides: Partial<EvidenceSourceOptions> = {},
): { source: EvidenceSource; client: FakePgClient; capturedConfig: () => Record<string, unknown> } {
  const client = new FakePgClient(script(rowsByMarker));
  let captured: Record<string, unknown> = {};
  const source = createEvidenceSource({
    host: 'db.internal',
    port: 5432,
    database: 'operations',
    user: 'operations_reader',
    password: PASSWORD,
    pgFactory: (cfg: object) => {
      captured = cfg as Record<string, unknown>;
      return client;
    },
    ...overrides,
  });
  return { source, client, capturedConfig: () => captured };
}

interface ProjectionShape {
  client: string;
  environment: string;
  records: Array<{
    sourceKey: string;
    status: string;
    severity: string;
    observedAt: string;
    freshUntil: string;
    criticality: string;
    safeSummary: string;
    counts: Record<string, number>;
  }>;
}

async function readProjection(
  source: EvidenceSource,
  clientKey = CLIENT,
  environmentKey = ENVIRONMENT,
): Promise<ProjectionShape> {
  return (await source.read(clientKey, environmentKey)) as ProjectionShape;
}

function recordOf(projection: ProjectionShape, sourceKey: string) {
  const record = projection.records.find((r) => r.sourceKey === sourceKey);
  if (!record) throw new Error(`expected a record for ${sourceKey}`);
  return record;
}

function expectNoRecord(projection: ProjectionShape, sourceKey: string) {
  expect(projection.records.find((r) => r.sourceKey === sourceKey)).toBeUndefined();
}

const FULL_FIXTURE: Record<string, Record<string, unknown>[]> = {
  endpoint_observations: [
    {
      status: 'GREEN',
      severity: 'none',
      observed_at: OBSERVED_AT,
      endpoint_key: 'cavetta.website',
      display_name: 'Cavetta Website',
      registered_path: '/',
    },
    {
      status: 'RED',
      severity: null,
      observed_at: OBSERVED_AT,
      endpoint_key: 'cavetta.public_api',
      display_name: 'Cavetta Public API',
      registered_path: null,
    },
  ],
  metric_samples: [
    {
      status: 'GREEN',
      severity: 'none',
      observed_at: OBSERVED_AT,
      metric_key: 'postgresql.up',
      freshness_seconds: 1800,
    },
    {
      status: 'AMBER',
      severity: 'warning',
      observed_at: OBSERVED_AT_2,
      metric_key: 'vercel.visitors',
      freshness_seconds: 86400,
    },
    {
      status: 'NO_DATA',
      severity: null,
      observed_at: OBSERVED_AT,
      metric_key: 'imagekit.cache_hit_ratio',
      freshness_seconds: 21600,
    },
    {
      status: 'GREEN',
      severity: 'none',
      observed_at: OBSERVED_AT,
      metric_key: 'workflow.success_count',
      freshness_seconds: 3600,
    },
  ],
  'FROM operations.incidents': [
    { status_color: 'AMBER', severity_echo: 'warning', observed_at: OBSERVED_AT },
  ],
  backup_evidence: [
    { status: 'GREEN', severity: 'none', observed_at: OBSERVED_AT_2 },
    { status: 'GREEN', severity: 'none', observed_at: OBSERVED_AT },
  ],
  restore_tests: [{ status: 'RED', severity: 'critical', observed_at: OBSERVED_AT }],
  workflow_executions: [{ status: 'AMBER', severity: 'bogus-value', observed_at: OBSERVED_AT }],
  'FROM operations.reports': [
    {
      status: 'RED',
      severity: 'warning',
      observed_at: OBSERVED_AT,
      finding_status: 'AMBER',
      finding_severity: 'warning',
    },
    {
      status: 'GREEN',
      severity: 'none',
      observed_at: OBSERVED_AT_2,
      finding_status: null,
      finding_severity: null,
    },
  ],
  provider_connections: [
    { provider: 'supabase', status: 'GREEN', severity: 'none', observed_at: OBSERVED_AT },
    { provider: 'github', status: 'RED', severity: 'critical', observed_at: OBSERVED_AT },
    { provider: 'vercel', status: 'RED', severity: 'critical', observed_at: OBSERVED_AT },
  ],
};

describe('createEvidenceSource option validation', () => {
  const base = {
    host: 'db.internal',
    port: 5432,
    database: 'operations',
    user: 'operations_reader',
    password: PASSWORD,
  };

  it('rejects a missing password (fail closed)', () => {
    expect(() =>
      createEvidenceSource({ ...base, password: undefined as unknown as string }),
    ).toThrow('password must be configured');
  });

  it('rejects malformed host, port, database and user', () => {
    expect(() => createEvidenceSource({ ...base, host: '' })).toThrow('host');
    expect(() => createEvidenceSource({ ...base, port: 0 })).toThrow('port');
    expect(() => createEvidenceSource({ ...base, port: 70000 })).toThrow('port');
    expect(() => createEvidenceSource({ ...base, database: '' })).toThrow('database');
    expect(() => createEvidenceSource({ ...base, user: '' })).toThrow('user');
  });

  it('rejects non-positive timeouts and row bounds', () => {
    expect(() => createEvidenceSource({ ...base, queryTimeoutMs: 0 })).toThrow('queryTimeoutMs');
    expect(() => createEvidenceSource({ ...base, maxRowsPerFamily: 0 })).toThrow(
      'maxRowsPerFamily',
    );
    expect(() => createEvidenceSource({ ...base, maxRowsPerFamily: 1.5 })).toThrow(
      'maxRowsPerFamily',
    );
  });
});

describe('EvidenceSource.read family mapping', () => {
  it('maps every family to the contracted source keys, statuses and severities', async () => {
    const { source, client } = makeSource(FULL_FIXTURE);
    const projection = await readProjection(source);

    expect(projection.client).toBe(CLIENT);
    expect(projection.environment).toBe(ENVIRONMENT);

    const website = recordOf(projection, 'public-website');
    expect(website.status).toBe('OK');
    expect(website.severity).toBe('none');
    expect(website.criticality).toBe('required');
    expect(website.counts).toEqual({ samples: 1 });

    // 'public_api' in the endpoint key classifies as the API; null severity
    // on a RED row falls back to 'critical'.
    const api = recordOf(projection, 'public-api');
    expect(api.status).toBe('FAILED');
    expect(api.severity).toBe('critical');

    // postgresql.* metric and the supabase provider connection merge into one
    // 'database' record; github connections are omitted entirely.
    const database = recordOf(projection, 'database');
    expect(database.status).toBe('OK');
    expect(database.counts).toEqual({ samples: 2 });
    expectNoRecord(projection, 'github');

    // vercel.* metric and the vercel provider_connection merge into
    // 'vercel-analytics' (worst-of: the RED connection outranks the AMBER
    // metric sample).
    const vercel = recordOf(projection, 'vercel-analytics');
    expect(vercel.status).toBe('FAILED');
    expect(vercel.severity).toBe('critical');
    expect(vercel.criticality).toBe('analytics');
    expect(vercel.counts).toEqual({ samples: 2 });

    // imagekit.* -> imagekit-delivery; NO_DATA row maps to UNKNOWN.
    const imagekit = recordOf(projection, 'imagekit-delivery');
    expect(imagekit.status).toBe('UNKNOWN');
    expect(imagekit.severity).toBe('none');

    // workflow.* metric keys are not part of the contracted catalogue mapping.
    expect(projection.records.filter((r) => r.sourceKey === 'n8n-workflows')).toHaveLength(1);

    const incidents = recordOf(projection, 'incidents');
    expect(incidents.status).toBe('DEGRADED');
    expect(incidents.severity).toBe('warning');

    const backups = recordOf(projection, 'backups-daily');
    expect(backups.status).toBe('OK');
    expect(backups.counts).toEqual({ samples: 2 });

    const restore = recordOf(projection, 'restore-test');
    expect(restore.status).toBe('FAILED');
    expect(restore.severity).toBe('critical');

    // Invalid severity on an AMBER row falls back to 'warning'.
    const workflows = recordOf(projection, 'n8n-workflows');
    expect(workflows.status).toBe('DEGRADED');
    expect(workflows.severity).toBe('warning');

    // The worst report row (RED) plus its AMBER finding drive the verdict;
    // the GREEN report without findings does not add a phantom UNKNOWN.
    const reports = recordOf(projection, 'maintenance-report');
    expect(reports.status).toBe('FAILED');
    expect(reports.counts).toEqual({ samples: 3 });

    for (const record of projection.records) {
      expect(KNOWN_SOURCE_KEYS.has(record.sourceKey)).toBe(true);
      expect(record.safeSummary.length).toBeLessThanOrEqual(200);
      expect(record.safeSummary).toContain(record.sourceKey);
      expect(Number.isInteger(record.counts.samples)).toBe(true);
      expect(record.counts.samples).toBeGreaterThan(0);
    }

    expect(client.connected).toBe(true);
    expect(client.ended).toBe(true);
  });

  it('maps vercel/imagekit provider_connections into their digest sources', async () => {
    const rows = {
      provider_connections: [
        { provider: 'vercel', status: 'GREEN', severity: 'none', observed_at: OBSERVED_AT },
        { provider: 'imagekit', status: 'AMBER', severity: 'warning', observed_at: OBSERVED_AT },
        { provider: 'github', status: 'RED', severity: 'critical', observed_at: OBSERVED_AT },
      ],
    };
    const { source } = makeSource(rows);
    const projection = await readProjection(source);

    expect(recordOf(projection, 'vercel-analytics').status).toBe('OK');
    const imagekit = recordOf(projection, 'imagekit-delivery');
    expect(imagekit.status).toBe('DEGRADED');
    expect(imagekit.severity).toBe('warning');
    expectNoRecord(projection, 'github');
  });

  it('computes freshUntil from metric freshness_seconds when resolvable', async () => {
    const rows = {
      metric_samples: [
        {
          status: 'GREEN',
          severity: 'none',
          observed_at: OBSERVED_AT,
          metric_key: 'postgresql.up',
          freshness_seconds: 1800,
        },
        {
          status: 'AMBER',
          severity: 'warning',
          observed_at: OBSERVED_AT_2,
          metric_key: 'vercel.visitors',
          freshness_seconds: 86400,
        },
      ],
    };
    const { source } = makeSource(rows);
    const projection = await readProjection(source);

    const database = recordOf(projection, 'database');
    expect(database.observedAt).toBe(OBSERVED_AT);
    expect(database.freshUntil).toBe(
      new Date(Date.parse(OBSERVED_AT) + 1800 * 1000).toISOString(),
    );

    const vercel = recordOf(projection, 'vercel-analytics');
    expect(vercel.observedAt).toBe(OBSERVED_AT_2);
    expect(vercel.freshUntil).toBe(
      new Date(Date.parse(OBSERVED_AT_2) + 86400 * 1000).toISOString(),
    );
  });

  it('uses observed_at + 24h for non-metric families and for unresolvable freshness', async () => {
    const rows = {
      endpoint_observations: [
        {
          status: 'GREEN',
          severity: 'none',
          observed_at: OBSERVED_AT,
          endpoint_key: 'cavetta.website',
          display_name: 'Cavetta Website',
          registered_path: '/',
        },
      ],
      metric_samples: [
        {
          status: 'GREEN',
          severity: 'none',
          observed_at: OBSERVED_AT,
          metric_key: 'postgresql.up',
          freshness_seconds: null,
        },
      ],
      backup_evidence: [{ status: 'GREEN', severity: 'none', observed_at: OBSERVED_AT }],
    };
    const { source } = makeSource(rows);
    const projection = await readProjection(source);

    const day = 24 * 60 * 60 * 1000;
    expect(recordOf(projection, 'public-website').freshUntil).toBe(
      new Date(Date.parse(OBSERVED_AT) + day).toISOString(),
    );
    expect(recordOf(projection, 'backups-daily').freshUntil).toBe(
      new Date(Date.parse(OBSERVED_AT) + day).toISOString(),
    );
    expect(recordOf(projection, 'database').freshUntil).toBe(
      new Date(Date.parse(OBSERVED_AT) + day).toISOString(),
    );
  });

  it('gives the monthly maintenance report a 45-day freshness window (cadence-aware)', async () => {
    // Production finding: the report is a monthly artifact (generated ~a
    // week into the month, manually approved, then sent), so the 24h default
    // pinned the verdict at RED the day after every legitimate send.
    const rows = {
      reports: [{ status: 'AMBER', severity: 'warning', observed_at: OBSERVED_AT }],
    };
    const { source } = makeSource(rows);
    const projection = await readProjection(source);

    const fortyFiveDays = 45 * 24 * 60 * 60 * 1000;
    expect(recordOf(projection, 'maintenance-report').freshUntil).toBe(
      new Date(Date.parse(OBSERVED_AT) + fortyFiveDays).toISOString(),
    );
  });

  it('treats an endpoint with a bare host (null path, no api token) as the public API', async () => {
    const rows = {
      endpoint_observations: [
        {
          status: 'GREEN',
          severity: 'none',
          observed_at: OBSERVED_AT,
          endpoint_key: 'cavetta.public_api',
          display_name: 'Cavetta Public API',
          registered_path: null,
        },
      ],
    };
    const { source } = makeSource(rows);
    const projection = await readProjection(source);
    expectNoRecord(projection, 'public-website');
    expect(recordOf(projection, 'public-api').status).toBe('OK');
  });

  it('omits families with no rows and still produces a valid projection', async () => {
    const { source } = makeSource({});
    const projection = await readProjection(source);
    expect(projection.records).toEqual([]);

    const validated = validateEvidenceProjection(projection, KNOWN_SOURCE_KEYS);
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      expect(validated.value.records).toEqual([]);
    }
  });

  it('produces projections that pass the real supervisor end to end', async () => {
    const { source } = makeSource(FULL_FIXTURE);
    const projection = await source.read(CLIENT, ENVIRONMENT);

    const validated = validateEvidenceProjection(projection, KNOWN_SOURCE_KEYS);
    expect(validated.ok).toBe(true);

    const sink = new InMemoryAuditSink();
    const service = new SupervisorService(resolveSupervisorOptions({}), sink);
    const result: SupervisorRunResult = service.assess(projection);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(['RED', 'AMBER', 'NO_DATA', 'UNKNOWN', 'GREEN']).toContain(result.assessment.assessment);
    }
  });
});

describe('EvidenceSource.read SELECT-only and bounded queries', () => {
  it('passes statement_timeout and connectionTimeoutMillis to the pg factory', async () => {
    const { source, capturedConfig } = makeSource({}, { queryTimeoutMs: 4321 });
    await readProjection(source);
    const captured = capturedConfig();
    expect(captured.statement_timeout).toBe(4321);
    expect(captured.connectionTimeoutMillis).toBe(4321);
    expect(captured.host).toBe('db.internal');
    expect(captured.port).toBe(5432);
    expect(captured.database).toBe('operations');
    expect(captured.user).toBe('operations_reader');
    expect(captured.password).toBe(PASSWORD);
  });

  it('applies the documented defaults', async () => {
    const client = new FakePgClient(() => []);
    let captured: Record<string, unknown> = {};
    const source = createEvidenceSource({
      host: 'db.internal',
      port: 5432,
      database: 'operations',
      user: 'operations_reader',
      password: PASSWORD,
      pgFactory: (cfg: object) => {
        captured = cfg as Record<string, unknown>;
        return client;
      },
    });
    await readProjection(source);
    expect(captured.statement_timeout).toBe(10_000);
    expect(captured.connectionTimeoutMillis).toBe(10_000);
  });

  it('sends every query as SELECT with the tenant bound and a LIMIT', async () => {
    const { source, client } = makeSource({});
    await readProjection(source);

    expect(client.queries).toHaveLength(8);
    for (let i = 0; i < client.queries.length; i += 1) {
      expect(client.queries[i]).toMatch(/^\s*select/i);
      expect(client.queries[i]).toContain('LIMIT');
      expect(client.queries[i]).not.toMatch(/;|;/);
      expect(client.boundValues[i]).toEqual([CLIENT, ENVIRONMENT, 5]);
    }
  });

  it('respects a custom maxRowsPerFamily bound', async () => {
    const { source, client } = makeSource({}, { maxRowsPerFamily: 2 });
    await readProjection(source);
    for (const values of client.boundValues) {
      expect(values).toEqual([CLIENT, ENVIRONMENT, 2]);
    }
  });

  it('keeps the source file free of data-modification keywords', () => {
    const sourceText = readFileSync(
      join(__dirname, '../../src/observer/evidence-source.ts'),
      'utf8',
    );
    expect(sourceText).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|GRANT)\b/i);
  });
});

describe('EvidenceSource.read fail-closed behavior', () => {
  it('rejects on a database error and still disconnects', async () => {
    const { source, client } = makeSource({});
    client.failOnQuery = () => new Error('connection reset by peer');

    await expect(readProjection(source)).rejects.toThrow('evidence read failed');
    expect(client.ended).toBe(true);
  });

  it('rejects on a mid-query failure (partial family results never surface)', async () => {
    const { source } = makeSource(FULL_FIXTURE);
    const client = new FakePgClient(script(FULL_FIXTURE));
    let calls = 0;
    client.failOnQuery = () => {
      calls += 1;
      return calls === 3 ? new Error('statement timeout') : undefined;
    };
    const sourceWithFailingClient = createEvidenceSource({
      host: 'db.internal',
      port: 5432,
      database: 'operations',
      user: 'operations_reader',
      password: PASSWORD,
      pgFactory: () => client,
    });

    await expect(readProjection(sourceWithFailingClient)).rejects.toThrow(
      'evidence read failed: statement timeout',
    );
  });

  it('never leaks the password into rejection messages', async () => {
    const { source } = makeSource({});
    const client = new FakePgClient(() => []);
    client.failOnQuery = () => new Error(`auth failed for user operations_reader ${PASSWORD}`);
    const sourceWithFailingClient = createEvidenceSource({
      host: 'db.internal',
      port: 5432,
      database: 'operations',
      user: 'operations_reader',
      password: PASSWORD,
      pgFactory: () => client,
    });

    let caught: unknown;
    try {
      await sourceWithFailingClient.read(CLIENT, ENVIRONMENT);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect(String((caught as Error).message)).not.toContain(PASSWORD);
    expect(String((caught as Error).message).length).toBeLessThanOrEqual(200);
  });

  it('fails closed when a row carries an unparseable observed_at', async () => {
    const { source } = makeSource({
      incidents: [{ status_color: 'GREEN', severity_echo: 'none', observed_at: 'not-a-date' }],
    });
    await expect(readProjection(source)).rejects.toThrow('evidence read failed');
  });

  it('fails closed when the disconnect itself fails after a successful read', async () => {
    const { source } = makeSource({});
    const client = new FakePgClient(() => []);
    const originalEnd = client.end.bind(client);
    client.end = async () => {
      await originalEnd();
      throw new Error('socket teardown failed');
    };
    const sourceWithFlakyEnd = createEvidenceSource({
      host: 'db.internal',
      port: 5432,
      database: 'operations',
      user: 'operations_reader',
      password: PASSWORD,
      pgFactory: () => client,
    });

    await expect(readProjection(sourceWithFlakyEnd)).rejects.toThrow('evidence read failed');
  });

  it('rejects invalid tenant or environment keys before touching the database', async () => {
    const { source, client } = makeSource({});
    await expect(source.read('', ENVIRONMENT)).rejects.toThrow('evidence read failed');
    await expect(source.read(CLIENT, 'not a valid key!')).rejects.toThrow(
      'evidence read failed',
    );
    await expect(source.read('cavetta!', ENVIRONMENT)).rejects.toThrow('evidence read failed');
    expect(client.queries).toHaveLength(0);
  });
});
