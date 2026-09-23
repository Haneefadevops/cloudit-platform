import type {
  AuditEvent,
  HealthAssessment,
  HealthStatus,
} from '@cloudit/operations-agent-contracts';
import { AlertEngine, AlertMessage, DigestEntry } from '../../src/alerts';
import { resolveSupervisorOptions, DEFAULT_SOURCE_KEYS, SupervisorRunResult, SupervisorService } from '../../src/supervisor';
import {
  ObserverAuditEvent,
  SoakDriver,
  SoakDriverOptions,
  TickOutcome,
} from '../../src/observer/soak-driver';

const CORE_SOURCE_KEYS = [
  'public-website',
  'public-api',
  'database',
  'incidents',
  'backups-daily',
  'restore-test',
  'n8n-workflows',
  'maintenance-report',
] as const;

const T0 = Date.UTC(2025, 0, 15, 6, 0, 0);

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function verdict(assessment: HealthStatus, issueCode = 'SOURCE_FAILED'): HealthAssessment {
  return {
    assessment,
    summary: 'synthetic verdict',
    evidenceKeys: ['public-website'],
    confidence: 'HIGH',
    issueCode,
    recommendedRunbook: 'none',
    automationEligibility: 'PROHIBITED',
  };
}

const SUPERVISOR_AUDIT_EVENT: AuditEvent = {
  eventId: 'evt-test-1',
  environmentKey: 'production',
  eventType: 'supervisor_assessment',
  actor: 'agent:supervisor',
  occurredAt: '2025-01-15T00:00:00.000Z',
  reasonCode: 'ASSESSMENT_RUN',
  resultCode: 'GREEN',
  summary: 'synthetic',
  evidenceKeys: [],
};

function okRun(assessment: HealthStatus, issueCode = 'SOURCE_FAILED'): SupervisorRunResult {
  return {
    ok: true,
    assessment: verdict(assessment, issueCode),
    findings: [],
    recommendations: [],
    auditEvent: SUPERVISOR_AUDIT_EVENT,
  };
}

function rejectedRun(errors: string[]): SupervisorRunResult {
  return { ok: false, errors, auditEvent: SUPERVISOR_AUDIT_EVENT };
}

class FakeEvidence {
  readCalls: Array<[string, string]> = [];
  projection: unknown = { client: 'cavetta', environment: 'production', records: [] };
  error: unknown = null;
  gate: Promise<unknown> | null = null;

  async read(clientKey: string, environmentKey: string): Promise<unknown> {
    this.readCalls.push([clientKey, environmentKey]);
    if (this.gate) await this.gate;
    if (this.error !== null) throw this.error;
    return this.projection;
  }
}

class FakeSupervisor {
  assessInputs: unknown[] = [];
  result: SupervisorRunResult = okRun('GREEN');

  assess(input: unknown): SupervisorRunResult {
    this.assessInputs.push(input);
    return this.result;
  }
}

class FakeAlerts {
  handled: Array<{ environmentKey: string; verdict: HealthAssessment }> = [];
  digests: Array<{ environmentKey: string; period: string; entries: DigestEntry[] }> = [];
  handleError: Error | null = null;
  digestError: Error | null = null;

  async handle(environmentKey: string, v: HealthAssessment) {
    if (this.handleError) throw this.handleError;
    this.handled.push({ environmentKey, verdict: v });
  }

  async sendDigest(environmentKey: string, period: 'daily', entries: DigestEntry[]) {
    if (this.digestError) throw this.digestError;
    this.digests.push({ environmentKey, period, entries });
  }
}

class FakeTimers {
  fn: (() => void) | null = null;
  registeredMs = 0;
  cleared = false;
  private readonly handle = {};

  setInterval(fn: () => void, ms: number): unknown {
    this.fn = fn;
    this.registeredMs = ms;
    return this.handle;
  }

  clearInterval(handle: unknown): void {
    expect(handle).toBe(this.handle);
    this.cleared = true;
  }

  fire(): void {
    this.fn?.();
  }
}

interface HarnessOptions {
  clientKey?: string;
  environmentKey?: string;
  intervalMs?: number;
  digestHourUtc?: number;
  clockMs?: number;
  auditThrows?: boolean;
  evidence?: FakeEvidence;
  supervisor?: FakeSupervisor;
  alerts?: FakeAlerts;
}

function makeHarness(options: HarnessOptions = {}) {
  let clockMs = options.clockMs ?? T0;
  const evidence = options.evidence ?? new FakeEvidence();
  const supervisor = options.supervisor ?? new FakeSupervisor();
  const alerts = options.alerts ?? new FakeAlerts();
  const timers = new FakeTimers();
  const auditEvents: ObserverAuditEvent[] = [];
  const audit = options.auditThrows
    ? {
        record: () => {
          throw new Error('audit sink down');
        },
      }
    : {
        record: (event: ObserverAuditEvent) => {
          auditEvents.push(event);
        },
      };
  const driver = new SoakDriver({
    evidence,
    supervisor,
    alerts,
    audit,
    clientKey: options.clientKey,
    environmentKey: options.environmentKey,
    intervalMs: options.intervalMs,
    digestHourUtc: options.digestHourUtc,
    now: () => clockMs,
    timers,
  });
  return {
    driver,
    evidence,
    supervisor,
    alerts,
    timers,
    auditEvents,
    setClock: (ms: number) => {
      clockMs = ms;
    },
  };
}

function record(
  sourceKey: string,
  status: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    sourceKey,
    status,
    severity: 'none',
    observedAt: '2025-01-15T00:00:00.000Z',
    freshUntil: '2025-01-16T00:00:00.000Z',
    criticality: 'required',
    safeSummary: `${sourceKey} ${status}`,
    counts: { samples: 1 },
    ...overrides,
  };
}

function projectionWith(records: Array<Record<string, unknown>>): unknown {
  return { client: 'cavetta', environment: 'production', records };
}

describe('SoakDriver', () => {
  it('reads evidence and dispatches the supervisor verdict to the alert engine', async () => {
    const h = makeHarness();
    h.supervisor.result = okRun('RED');

    const outcome: TickOutcome = await h.driver.tick();

    expect(outcome).toEqual({ status: 'ASSESSED', red: true });
    expect(h.evidence.readCalls).toEqual([['cavetta', 'production']]);
    expect(h.supervisor.assessInputs).toHaveLength(1);
    expect(h.alerts.handled).toHaveLength(1);
    expect(h.alerts.handled[0].environmentKey).toBe('production');
    expect(h.alerts.handled[0].verdict.assessment).toBe('RED');
    expect(h.auditEvents).toHaveLength(0);

    h.supervisor.result = okRun('GREEN');
    expect(await h.driver.tick()).toEqual({ status: 'ASSESSED', red: false });
  });

  it('reads with the configured tenant/environment keys', async () => {
    const h = makeHarness({ clientKey: 'acme', environmentKey: 'staging' });
    await h.driver.tick();
    expect(h.evidence.readCalls).toEqual([['acme', 'staging']]);
    expect(h.alerts.handled[0].environmentKey).toBe('staging');
  });

  it('starts the interval on init with the configured interval and clears it on destroy', async () => {
    const h = makeHarness({ intervalMs: 60_000 });
    h.driver.onModuleInit();
    expect(h.timers.registeredMs).toBe(60_000);

    h.timers.fire();
    await flush();
    expect(h.evidence.readCalls).toHaveLength(1);

    await h.driver.onModuleDestroy();
    expect(h.timers.cleared).toBe(true);
  });

  it('suppresses overlapping ticks while a previous tick is in flight', async () => {
    const h = makeHarness();
    let release!: () => void;
    h.evidence.gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = h.driver.tick();
    const second = await h.driver.tick();
    expect(second).toEqual({ status: 'SUPPRESSED', reason: 'TICK_IN_FLIGHT' });
    expect(h.supervisor.assessInputs).toHaveLength(0);

    release();
    expect(await first).toEqual({ status: 'ASSESSED', red: false });
    expect(h.supervisor.assessInputs).toHaveLength(1);
  });

  it('engages a fail-closed all-UNKNOWN projection when the read fails', async () => {
    const h = makeHarness();
    h.evidence.error = new Error('connection refused');

    const outcome = await h.driver.tick();

    expect(outcome).toEqual({ status: 'ASSESSED', red: false });
    expect(h.supervisor.assessInputs).toHaveLength(1);
    const projection = h.supervisor.assessInputs[0] as {
      client: string;
      environment: string;
      records: Array<Record<string, unknown>>;
    };
    expect(projection.client).toBe('cavetta');
    expect(projection.environment).toBe('production');
    expect(projection.records).toHaveLength(CORE_SOURCE_KEYS.length);
    const nowIso = iso(T0);
    for (const key of CORE_SOURCE_KEYS) {
      const found = projection.records.find((r) => r.sourceKey === key);
      expect(found).toMatchObject({
        status: 'UNKNOWN',
        severity: 'critical',
        criticality: 'required',
        safeSummary: 'observer blind: evidence read failed',
        observedAt: nowIso,
        freshUntil: nowIso,
        counts: { samples: 0 },
      });
    }
    expect(h.alerts.handled).toHaveLength(1);
    expect(h.auditEvents).toHaveLength(1);
    expect(h.auditEvents[0]).toMatchObject({
      eventType: 'observer_read',
      reasonCode: 'EVIDENCE_READ_FAILED',
      evidenceKeys: [],
    });
    expect(h.auditEvents[0].summary.length).toBeLessThanOrEqual(200);
  });

  it('keeps the blind projection byte-stable across an outage', async () => {
    const h = makeHarness();
    h.evidence.error = new Error('down');
    await h.driver.tick();
    h.setClock(T0 + 15 * 60_000);
    await h.driver.tick();
    h.setClock(T0 + 30 * 60_000);
    await h.driver.tick();
    expect(h.supervisor.assessInputs[1]).toEqual(h.supervisor.assessInputs[0]);
    expect(h.supervisor.assessInputs[2]).toEqual(h.supervisor.assessInputs[0]);
    expect(h.alerts.handled).toHaveLength(3);
    expect(h.auditEvents.map((e) => e.reasonCode)).toEqual([
      'EVIDENCE_READ_FAILED',
      'EVIDENCE_READ_FAILED',
      'EVIDENCE_READ_FAILED',
    ]);
  });

  it('end-to-end: sustained outage yields ONE deduped RED alert, then a recovery message', async () => {
    let clockMs = Date.UTC(2025, 0, 15, 0, 0, 0);
    const auditLog: unknown[] = [];
    const sink = {
      record: (event: unknown) => {
        auditLog.push(event);
      },
    };
    const supervisor = new SupervisorService(
      resolveSupervisorOptions({
        requiredSourceKeys: [...CORE_SOURCE_KEYS],
        criticalOverdueMs: 5 * 60_000,
        now: () => new Date(clockMs),
      }),
      sink,
    );
    const sent: AlertMessage[] = [];
    const sender = {
      send: async (message: AlertMessage) => {
        sent.push(message);
      },
    };
    const alerts = new AlertEngine({
      gate: { assertEnabled: () => undefined },
      sender,
      maxAlertsPerHour: 60,
      outageRetryMaxAttempts: 3,
      now: () => clockMs,
      audit: sink,
    });
    const evidence = new FakeEvidence();
    evidence.error = new Error('db unreachable');
    const driver = new SoakDriver({
      evidence,
      supervisor,
      alerts,
      audit: sink,
      clientKey: 'cavetta',
      environmentKey: 'production',
      digestHourUtc: 23,
      now: () => clockMs,
    });

    // Outage start: blind records are fresh UNKNOWN -> verdict UNKNOWN, no alert.
    expect(await driver.tick()).toEqual({ status: 'ASSESSED', red: false });
    expect(sent).toHaveLength(0);

    // The blind projection ages: required sources overdue past the critical
    // window -> ONE red alert through the real supervisor and alert engine.
    clockMs += 15 * 60_000;
    expect(await driver.tick()).toEqual({ status: 'ASSESSED', red: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].kind).toBe('red_alert');
    expect(sent[0].subjectKey).toBe('EVIDENCE_STALE');

    // Sustained outage: deduped by the alert engine, no repeat alert.
    clockMs += 15 * 60_000;
    expect(await driver.tick()).toEqual({ status: 'ASSESSED', red: true });
    expect(sent).toHaveLength(1);

    // Restore: evidence flows again, slightly stale -> non-RED verdict with
    // the alerted issue code -> exactly one recovery message.
    evidence.error = null;
    clockMs += 15 * 60_000;
    const assessIso = iso(clockMs);
    evidence.projection = projectionWith([
      record('database', 'OK', {
        observedAt: iso(clockMs - 10 * 60_000),
        freshUntil: iso(clockMs - 60_000),
      }),
      ...CORE_SOURCE_KEYS.filter((key) => key !== 'database').map((key) =>
        record(key, 'OK', { observedAt: assessIso, freshUntil: iso(clockMs + 60_000) }),
      ),
    ]);
    expect(await driver.tick()).toEqual({ status: 'ASSESSED', red: false });
    expect(sent).toHaveLength(2);
    expect(sent[1].kind).toBe('recovery');
    expect(sent[1].subjectKey).toBe('EVIDENCE_STALE');
  });

  it('audits exactly one closed event and skips alerts when the supervisor rejects', async () => {
    const h = makeHarness();
    h.supervisor.result = rejectedRun(['records[0].sourceKey: not a known evidence source']);

    const outcome = await h.driver.tick();

    expect(outcome).toEqual({ status: 'ASSESSED', red: false });
    expect(h.alerts.handled).toHaveLength(0);
    expect(h.auditEvents).toHaveLength(1);
    const event = h.auditEvents[0];
    expect(Object.keys(event).sort()).toEqual([
      'eventType',
      'evidenceKeys',
      'reasonCode',
      'summary',
    ]);
    expect(event).toMatchObject({
      eventType: 'observer_internal',
      reasonCode: 'ASSESSMENT_REJECTED',
      evidenceKeys: [],
    });
    expect(event.summary).toMatch(/1 issue\(s\)/);
    expect(event.summary.length).toBeLessThanOrEqual(200);
    expect(event.summary).not.toContain('records[0]');
  });

  it('sends the daily digest once per UTC day at/after the configured hour', async () => {
    const h = makeHarness({ clockMs: Date.UTC(2025, 0, 15, 6, 59, 0), digestHourUtc: 7 });
    h.evidence.projection = projectionWith([
      record('public-website', 'OK'),
      record('database', 'FAILED'),
      record('incidents', 'DEGRADED'),
      record('backups-daily', 'UNKNOWN'),
    ]);

    // Before the hour: no digest.
    expect(await h.driver.tick()).toEqual({ status: 'ASSESSED', red: false });
    expect(h.alerts.digests).toHaveLength(0);

    // At the hour: digest with per-source categories from the latest records.
    h.setClock(Date.UTC(2025, 0, 15, 7, 0, 0));
    expect(await h.driver.tick()).toEqual({ status: 'DIGEST_SENT' });
    expect(h.alerts.digests).toHaveLength(1);
    expect(h.alerts.digests[0].environmentKey).toBe('production');
    expect(h.alerts.digests[0].period).toBe('daily');
    const entries = h.alerts.digests[0].entries;
    // Reconciliation decision: the digest is the full source board — every
    // known source key appears, unobserved sources as UNKNOWN — so a missing
    // row is visible rather than silently absent.
    expect(entries.map((e) => e.subjectKey)).toEqual([...DEFAULT_SOURCE_KEYS]);
    const expectedCategory = new Map([
      ['public-website', 'GREEN'],
      ['database', 'RED'],
      ['incidents', 'AMBER'],
      ['backups-daily', 'UNKNOWN'],
    ]);
    expect(entries.map((e) => e.category)).toEqual(
      DEFAULT_SOURCE_KEYS.map((key) => expectedCategory.get(key) ?? 'UNKNOWN'),
    );
    for (const entry of entries) {
      if (expectedCategory.has(entry.subjectKey)) {
        expect(entry.summary.length).toBeLessThanOrEqual(200);
        expect(entry.lastOccurredAt).toBe(iso(Date.UTC(2025, 0, 15, 7, 0, 0)));
      } else {
        expect(entry.summary).toBe('no recent observation');
      }
    }

    // Same UTC day, even later: no second digest.
    h.setClock(Date.UTC(2025, 0, 15, 12, 0, 0));
    expect(await h.driver.tick()).toEqual({ status: 'ASSESSED', red: false });
    expect(h.alerts.digests).toHaveLength(1);

    // 23:59 is still the same UTC day.
    h.setClock(Date.UTC(2025, 0, 15, 23, 59, 0));
    expect(await h.driver.tick()).toEqual({ status: 'ASSESSED', red: false });
    expect(h.alerts.digests).toHaveLength(1);

    // Next UTC day at/after the hour: digest again.
    h.setClock(Date.UTC(2025, 0, 16, 7, 30, 0));
    expect(await h.driver.tick()).toEqual({ status: 'DIGEST_SENT' });
    expect(h.alerts.digests).toHaveLength(2);
  });

  it('bounds digest entries to 13 even when more sources were observed', async () => {
    const h = makeHarness({ clockMs: Date.UTC(2025, 0, 15, 8, 0, 0), digestHourUtc: 7 });
    h.evidence.projection = projectionWith(
      Array.from({ length: 20 }, (_, i) => record(`source-${i}`, 'OK')),
    );
    expect(await h.driver.tick()).toEqual({ status: 'DIGEST_SENT' });
    expect(h.alerts.digests[0].entries).toHaveLength(13);
  });

  it('audits a bounded event and retries on a later tick when the digest fails', async () => {
    const h = makeHarness({ clockMs: Date.UTC(2025, 0, 15, 8, 0, 0), digestHourUtc: 7 });
    h.alerts.digestError = new Error('telegram down');

    expect(await h.driver.tick()).toEqual({ status: 'ASSESSED', red: false });
    expect(h.alerts.digests).toHaveLength(0);
    expect(h.auditEvents).toHaveLength(1);
    expect(h.auditEvents[0]).toMatchObject({
      eventType: 'observer_internal',
      reasonCode: 'DIGEST_FAILED',
    });
    expect(h.auditEvents[0].summary).not.toContain('telegram down');

    h.alerts.digestError = null;
    h.setClock(Date.UTC(2025, 0, 15, 8, 15, 0));
    expect(await h.driver.tick()).toEqual({ status: 'DIGEST_SENT' });
    expect(h.alerts.digests).toHaveLength(1);
  });

  it('onModuleDestroy stops the timer and awaits an in-flight tick', async () => {
    const h = makeHarness();
    h.driver.onModuleInit();
    let release!: () => void;
    h.evidence.gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const tickPromise = h.driver.tick();
    let destroyed = false;
    const destroyPromise = h.driver.onModuleDestroy().then(() => {
      destroyed = true;
    });
    await flush();
    expect(destroyed).toBe(false);
    expect(h.timers.cleared).toBe(true);

    release();
    await destroyPromise;
    expect(destroyed).toBe(true);
    await tickPromise;
    expect(h.supervisor.assessInputs).toHaveLength(1);
  });

  it('never throws: sync read failure, throwing assessor, rejecting handle, broken audit sink', async () => {
    // A synchronously throwing, non-Error read failure resolves via the
    // fail-closed path.
    const h1 = makeHarness();
    h1.evidence.read = () => {
      throw 'weird failure value';
    };
    await expect(h1.driver.tick()).resolves.toEqual({ status: 'ASSESSED', red: false });
    expect(h1.supervisor.assessInputs).toHaveLength(1);
    expect(h1.auditEvents.map((e) => e.reasonCode)).toEqual(['EVIDENCE_READ_FAILED']);

    // A throwing assessor degrades to one INTERNAL_ERROR audit, no alert.
    const h2 = makeHarness();
    h2.supervisor.assess = () => {
      throw new Error('assessor exploded');
    };
    await expect(h2.driver.tick()).resolves.toEqual({ status: 'ASSESSED', red: false });
    expect(h2.alerts.handled).toHaveLength(0);
    expect(h2.auditEvents).toHaveLength(1);
    expect(h2.auditEvents[0].reasonCode).toBe('INTERNAL_ERROR');
    expect(h2.auditEvents[0].summary).not.toContain('assessor exploded');

    // A rejecting alerts.handle resolves with one INTERNAL_ERROR audit.
    const h3 = makeHarness();
    h3.alerts.handleError = new Error('handle rejected');
    await expect(h3.driver.tick()).resolves.toEqual({ status: 'ASSESSED', red: false });
    expect(h3.auditEvents).toHaveLength(1);
    expect(h3.auditEvents[0].reasonCode).toBe('INTERNAL_ERROR');

    // A broken audit sink never breaks the tick.
    const h4 = makeHarness({ auditThrows: true });
    h4.evidence.error = new Error('down');
    await expect(h4.driver.tick()).resolves.toEqual({ status: 'ASSESSED', red: false });
    expect(h4.supervisor.assessInputs).toHaveLength(1);
  });

  it('validates construction and applies contract defaults', async () => {
    const evidence = new FakeEvidence();
    const supervisor = new FakeSupervisor();
    const alerts = new FakeAlerts();

    expect(() => new SoakDriver(undefined as unknown as SoakDriverOptions)).toThrow();
    expect(
      () => new SoakDriver({ evidence, supervisor, alerts, digestHourUtc: 24 }),
    ).toThrow(/digestHourUtc/);
    expect(() => new SoakDriver({ evidence, supervisor, alerts, intervalMs: 0 })).toThrow(
      /intervalMs/,
    );

    // Defaults: cavetta/production keys, 15-minute interval, digest hour 7.
    const h = makeHarness({ clockMs: Date.UTC(2025, 0, 15, 7, 30, 0) });
    h.driver.onModuleInit();
    expect(h.timers.registeredMs).toBe(900_000);
    expect(h.evidence.readCalls).toHaveLength(0);
    expect(await h.driver.tick()).toEqual({ status: 'DIGEST_SENT' });
    expect(h.evidence.readCalls).toEqual([['cavetta', 'production']]);
    expect(h.alerts.digests[0].period).toBe('daily');
  });

  it('exposes a read-only status snapshot for the Telegram evidence adapter', async () => {
    const h = makeHarness();
    // Before the first tick everything degrades to NO_DATA / unevidenced.
    expect(h.driver.getSnapshot()).toEqual({
      overall: 'NO_DATA',
      sourcesTotal: DEFAULT_SOURCE_KEYS.length,
      sourcesRed: 0,
      sourcesAmber: 0,
      openIncidents: 0,
      incidentsEvident: false,
      incidentsSeverity: 'UNKNOWN',
      incidentsObservedAt: '',
      generatedAt: '',
    });
    expect(h.driver.getFindings()).toEqual([]);

    h.supervisor.result = okRun('RED');
    h.evidence.projection = projectionWith([
      record('public-website', 'FAILED'),
      record('database', 'DEGRADED'),
      record('incidents', 'FAILED', { counts: { samples: 3 } }),
    ]);

    expect(await h.driver.tick()).toEqual({ status: 'ASSESSED', red: true });

    const snapshot = h.driver.getSnapshot();
    expect(snapshot.overall).toBe('RED');
    expect(snapshot.sourcesTotal).toBe(DEFAULT_SOURCE_KEYS.length);
    expect(snapshot.sourcesRed).toBe(2);
    expect(snapshot.sourcesAmber).toBe(1);
    expect(snapshot.openIncidents).toBe(3);
    expect(snapshot.incidentsEvident).toBe(true);
    expect(snapshot.incidentsSeverity).toBe('RED');
    expect(snapshot.incidentsObservedAt).toBe('2025-01-15T00:00:00.000Z');
    expect(snapshot.generatedAt).toBe(iso(T0));

    // A tick whose projection carries no incidents row resets the evidence
    // to unevidenced (never a stale "zero incidents").
    h.evidence.projection = projectionWith([record('public-website', 'OK')]);
    await h.driver.tick();
    const after = h.driver.getSnapshot();
    expect(after.overall).toBe('RED'); // FakeSupervisor still returns RED
    expect(after.openIncidents).toBe(0);
    expect(after.incidentsEvident).toBe(false);
  });

  it('keeps findings from the last accepted assessment only', async () => {
    const h = makeHarness();
    const withFinding: SupervisorRunResult = {
      ok: true,
      assessment: verdict('AMBER'),
      findings: [
        {
          findingId: 'FND-1',
          environmentKey: 'production',
          issueCode: 'SOURCE_STALE',
          severity: 'warning',
          state: 'open',
          summary: 'synthetic bounded summary',
          evidenceKeys: [],
          firstSeenAt: iso(T0),
          lastSeenAt: iso(T0),
        },
      ],
      recommendations: [],
      auditEvent: SUPERVISOR_AUDIT_EVENT,
    };
    h.supervisor.result = withFinding;
    await h.driver.tick();
    expect(h.driver.getFindings().map((finding) => finding.findingId)).toEqual(['FND-1']);

    // A rejected assessment never replaces the published state.
    h.supervisor.result = rejectedRun(['bad projection']);
    await h.driver.tick();
    expect(h.driver.getFindings().map((finding) => finding.findingId)).toEqual(['FND-1']);
  });
});
