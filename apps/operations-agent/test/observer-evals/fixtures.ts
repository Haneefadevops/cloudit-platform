/**
 * Shared fixtures for the soak-driver adversarial evaluation suite (Worker C,
 * blind). Everything here is synthetic: fake environment/tenant keys, a fake
 * clock, a scriptable fake pg client, canary-laced evidence rows and the
 * secret-canary values.
 *
 * This file intentionally avoids static imports from `src/observer/*`: Worker
 * A (evidence-source) and Worker B (soak-driver) build those modules in
 * parallel against the integration contract, and this suite must compile and
 * smoke-check while they are absent. The shapes below mirror that contract
 * structurally; `loadObserverModules()` resolves the real modules at runtime
 * and every suite degrades to `describe.skip` (with a loud warning) when a
 * module has not landed yet. A present-but-differently-shaped module is a
 * FINDING: the suites assert the contract shape at runtime and fail on
 * mismatch.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { HealthAssessment } from '@cloudit/operations-agent-contracts';
import { AlertEngine } from '../../src/alerts';
import { resolveSupervisorOptions, SupervisorService } from '../../src/supervisor';

// --- synthetic tenant / environment keys (valid under both key patterns) ---

export const CLIENT_A = 'tenant-a';
export const CLIENT_B = 'tenant-b';
export const ENV_A = 'production';
export const ENV_B = 'staging';

/** Fixed synthetic instant: 2026-10-05T06:59:00.000Z (one minute before the
 * default digest hour), so digest-boundary tests start from a clean state. */
export const T0 = Date.UTC(2026, 9, 5, 6, 59, 0, 0);

/** Synthetic DB credential; must never appear in any error message. */
export const FAKE_DB_PASSWORD = 's0ak-fake-db-password-CANARY!';

// --- secret canaries planted into evidence rows (operator-plan 11.2/14) ---

/** AWS-access-key-id-shaped canary (obviously fake, public documentation value). */
export const CANARY_AWS = 'AKIAIOSFODNN7EXAMPLE';
/** Telegram-bot-token-shaped canary (id:35-char-secret form, obviously fake). */
export const CANARY_BOT_TOKEN =
  '1234567890:AAH9wFakeCanarySoakValue0123456789abcde';
export const CANARIES = [CANARY_AWS, CANARY_BOT_TOKEN];

// --- contract shape mirrors (structurally identical to src/observer) ---

export interface PgClientShape {
  connect(): Promise<void>;
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  end(): Promise<void>;
}

export type PgFactoryShape = (cfg: object) => PgClientShape;

export interface EvidenceSourceOptionsShape {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  queryTimeoutMs?: number;
  maxRowsPerFamily?: number;
  pgFactory?: PgFactoryShape;
  now?: () => number;
}

export interface EvidenceSourceShape {
  read(clientKey: string, environmentKey: string): Promise<unknown>;
}

export interface EvidenceSourceModuleShape {
  createEvidenceSource?: (options: EvidenceSourceOptionsShape) => EvidenceSourceShape;
}

export interface HealthAssessmentShape {
  assessment: string;
  summary: string;
  evidenceKeys: string[];
  confidence: string;
  issueCode: string;
  recommendedRunbook: string;
  automationEligibility: string;
}

export interface DigestEntryShape {
  subjectKey: string;
  category: 'RED' | 'AMBER' | 'GREEN' | 'NO_DATA' | 'UNKNOWN';
  summary: string;
  lastOccurredAt: string;
}

export type SupervisorRunShape =
  | { ok: true; assessment: HealthAssessmentShape; auditEvent?: unknown }
  | { ok: false; errors: string[]; auditEvent?: unknown };

export interface SoakDriverAlertsShape {
  handle(environmentKey: string, verdict: HealthAssessmentShape): Promise<unknown>;
  sendDigest(
    environmentKey: string,
    period: 'daily',
    entries: DigestEntryShape[],
  ): Promise<unknown>;
}

export interface SoakDriverOptionsShape {
  evidence: { read(clientKey: string, environmentKey: string): Promise<unknown> };
  supervisor: { assess(input: unknown): SupervisorRunShape };
  alerts: SoakDriverAlertsShape;
  audit?: { record(event: unknown): unknown };
  clientKey?: string;
  environmentKey?: string;
  intervalMs?: number;
  digestHourUtc?: number;
  now?: () => number;
  timers?: {
    setInterval(fn: () => void, ms: number): unknown;
    clearInterval(handle: unknown): void;
  };
}

export type TickOutcomeShape =
  | { status: 'ASSESSED'; red: boolean }
  | { status: 'DIGEST_SENT' }
  | { status: 'SUPPRESSED'; reason: 'TICK_IN_FLIGHT' };

export interface SoakDriverInstanceShape {
  onModuleInit(): void;
  onModuleDestroy(): Promise<void>;
  tick(): Promise<TickOutcomeShape>;
}

export interface SoakDriverModuleShape {
  SoakDriver?: new (options: SoakDriverOptionsShape) => SoakDriverInstanceShape;
}

export interface LoadedObserverModules {
  evidenceSource: EvidenceSourceModuleShape | undefined;
  soakDriver: SoakDriverModuleShape | undefined;
}

function tryRequire(modulePath: string): unknown {
  try {
    // Runtime-only resolution: the module is built by a sibling worker and may
    // not exist in this worktree yet.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(modulePath) as unknown;
  } catch {
    return undefined;
  }
}

export function loadObserverModules(): LoadedObserverModules {
  const evidenceSource = tryRequire('../../src/observer/evidence-source') as
    | EvidenceSourceModuleShape
    | undefined;
  const soakDriver = tryRequire('../../src/observer/soak-driver') as
    | SoakDriverModuleShape
    | undefined;
  if (!evidenceSource || !soakDriver) {
    const missing = [
      !evidenceSource ? 'src/observer/evidence-source' : undefined,
      !soakDriver ? 'src/observer/soak-driver' : undefined,
    ].filter(Boolean);
    // eslint-disable-next-line no-console
    console.warn(
      `observer-evals: ${missing.join(' and ')} not present in this worktree; ` +
        'observer-dependent suites will be SKIPPED. This is a FINDING until the ' +
        'sibling workers land their modules.',
    );
  }
  return { evidenceSource, soakDriver };
}

export const observerModules = loadObserverModules();

/** Runs only while the Worker A module is present. */
export const describeEvidenceSource =
  observerModules.evidenceSource &&
  typeof observerModules.evidenceSource.createEvidenceSource === 'function'
    ? describe
    : describe.skip;

/** Runs only while the Worker B module is present. */
export const describeSoakDriver =
  observerModules.soakDriver && typeof observerModules.soakDriver.SoakDriver === 'function'
    ? describe
    : describe.skip;

/** True when the full real chain (evidence source + soak driver) is drivable. */
export const CHAIN_AVAILABLE =
  describeEvidenceSource === describe && describeSoakDriver === describe;

// --- deterministic clock and fake timers ---

export class ManualClock {
  constructor(public current: number) {}

  now = (): number => this.current;

  set(current: number): void {
    this.current = current;
  }

  advance(ms: number): void {
    this.current += ms;
  }

  /** Advance to an exact UTC instant (Date.UTC arguments). */
  setUtc(
    year: number,
    monthIndex: number,
    day: number,
    hour = 0,
    minute = 0,
    second = 0,
  ): void {
    this.current = Date.UTC(year, monthIndex, day, hour, minute, second);
  }

  iso(): string {
    return new Date(this.current).toISOString();
  }

  /** UTC calendar day key 'YYYY-MM-DD'. */
  utcDay(): string {
    return this.iso().slice(0, 10);
  }
}

interface ScheduledInterval {
  fn: () => void;
  ms: number;
  handle: number;
  cleared: boolean;
  fireCount: number;
}

export class FakeTimerHub {
  readonly intervals: ScheduledInterval[] = [];
  private nextHandle = 1;

  setInterval = (fn: () => void, ms: number): number => {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.intervals.push({ fn, ms, handle, cleared: false, fireCount: 0 });
    return handle;
  };

  clearInterval = (handle: unknown): void => {
    const scheduled = this.intervals.find((entry) => entry.handle === handle);
    if (scheduled) scheduled.cleared = true;
  };

  get activeIntervals(): ScheduledInterval[] {
    return this.intervals.filter((entry) => !entry.cleared);
  }

  fire(handle: number, times = 1): void {
    const scheduled = this.intervals.find((entry) => entry.handle === handle);
    if (!scheduled || scheduled.cleared) {
      throw new Error(`fake timer: no active interval for handle ${handle}`);
    }
    for (let i = 0; i < times; i += 1) {
      scheduled.fireCount += 1;
      scheduled.fn();
    }
  }
}

// --- fake pg client (scriptable rows per query + error injection) ---

interface PgResponder {
  match: RegExp;
  respond: (text: string, values?: unknown[]) => Record<string, unknown>[];
}

export class FakePgClient implements PgClientShape {
  readonly queries: Array<{ text: string; values?: unknown[] }> = [];
  readonly methodCalls: string[] = [];
  readonly responders: PgResponder[] = [];
  connected = false;
  ended = false;
  /** When set, the next query() rejects with this error (consumed once). */
  oneShotError: Error | undefined;
  /** When set, every query() rejects until cleared. */
  persistentError: Error | undefined;
  /** Optional per-query hook (runs before responders; may throw). */
  onQuery: ((text: string, values?: unknown[]) => void) | undefined;

  when(match: RegExp, rows: Record<string, unknown>[]): void {
    this.responders.push({ match, respond: () => rows });
  }

  whenFn(match: RegExp, respond: PgResponder['respond']): void {
    this.responders.push({ match, respond });
  }

  async connect(): Promise<void> {
    this.methodCalls.push('connect');
    this.connected = true;
  }

  async query(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }> {
    this.methodCalls.push('query');
    this.queries.push({ text, values });
    if (this.oneShotError) {
      const error = this.oneShotError;
      this.oneShotError = undefined;
      throw error;
    }
    if (this.persistentError) throw this.persistentError;
    if (this.onQuery) this.onQuery(text, values);
    for (const responder of this.responders) {
      if (responder.match.test(text)) {
        return { rows: responder.respond(text, values) };
      }
    }
    return { rows: [] };
  }

  async end(): Promise<void> {
    this.methodCalls.push('end');
    this.ended = true;
  }

  /** Every SQL text seen so far. */
  get sqlTexts(): string[] {
    return this.queries.map((entry) => entry.text);
  }
}

/** pgFactory that hands out one scripted client and captures the pg config. */
export function makePgFactory(client: FakePgClient): {
  factory: PgFactoryShape;
  capturedConfigs: object[];
} {
  const capturedConfigs: object[] = [];
  const factory: PgFactoryShape = (cfg) => {
    capturedConfigs.push(cfg);
    return client;
  };
  return { factory, capturedConfigs };
}

// --- fake supervisor / alerts / audit ---

export function makeAssessment(
  assessment: string,
  overrides: Partial<HealthAssessmentShape> = {},
): HealthAssessmentShape {
  return {
    assessment,
    summary: 'synthetic deterministic assessment',
    evidenceKeys: ['ev.synthetic.1'],
    confidence: 'HIGH',
    issueCode: 'NO_ISSUE',
    recommendedRunbook: 'none',
    automationEligibility: 'OWNER_REQUIRED',
    ...overrides,
  };
}

export function makeSupervisorOk(
  assessment: string,
  overrides: Partial<HealthAssessmentShape> = {},
): SupervisorRunShape {
  return { ok: true, assessment: makeAssessment(assessment, overrides) };
}

export function makeSupervisorRejected(errors: string[]): SupervisorRunShape {
  return { ok: false, errors };
}

export class FakeSupervisor {
  readonly inputs: unknown[] = [];
  readonly results: SupervisorRunShape[] = [];
  throwOnAssess: Error | undefined;

  assess(input: unknown): SupervisorRunShape {
    if (this.throwOnAssess) throw this.throwOnAssess;
    this.inputs.push(input);
    return this.results.shift() ?? makeSupervisorOk('GREEN');
  }
}

export interface RecordedHandleCall {
  environmentKey: string;
  verdict: HealthAssessmentShape;
}

export interface RecordedDigestCall {
  environmentKey: string;
  period: string;
  entries: DigestEntryShape[];
}

export class FakeAlerts {
  readonly handleCalls: RecordedHandleCall[] = [];
  readonly digestCalls: RecordedDigestCall[] = [];
  handleError: Error | undefined;
  digestError: Error | undefined;

  async handle(environmentKey: string, verdict: HealthAssessmentShape): Promise<unknown> {
    if (this.handleError) throw this.handleError;
    this.handleCalls.push({ environmentKey, verdict });
    return { action: 'SENT' };
  }

  async sendDigest(
    environmentKey: string,
    period: 'daily',
    entries: DigestEntryShape[],
  ): Promise<unknown> {
    if (this.digestError) throw this.digestError;
    this.digestCalls.push({ environmentKey, period, entries });
    return { action: 'SENT' };
  }
}

export class RecordingAuditSink {
  readonly events: unknown[] = [];
  throwOnRecord = false;

  record(event: unknown): unknown {
    if (this.throwOnRecord) throw new Error('synthetic audit sink outage');
    this.events.push(event);
    return event;
  }
}

/** Recursively collect every string value carried by an unknown event/object. */
export function collectStrings(value: unknown, into: string[] = []): string[] {
  if (typeof value === 'string') {
    into.push(value);
    return into;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, into);
    return into;
  }
  if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) collectStrings(item, into);
  }
  return into;
}

/** First `reasonCode` (or legacy `reason`) property found in an unknown event. */
export function reasonOf(value: unknown): unknown {
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    if ('reasonCode' in record) return record.reasonCode;
    if ('reason' in record) return record.reason;
    for (const item of Object.values(record)) {
      const found = reasonOf(item);
      if (found !== undefined) return found;
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = reasonOf(item);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

export function eventTypeOf(value: unknown): unknown {
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    if ('eventType' in record) return record.eventType;
    for (const item of Object.values(record)) {
      const found = eventTypeOf(item);
      if (found !== undefined) return found;
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = eventTypeOf(item);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

// --- contract-shaped synthetic evidence rows (from infra migrations 0002) ---
//
// All values are synthetic. String fields are deliberately laced with the
// canary tokens: a compliant implementation never copies row values into
// summaries, alerts, digests, audit events or error messages.

let syntheticRowSeq = 0;

function nextRowId(): string {
  syntheticRowSeq += 1;
  return `00000000-0000-4000-8000-${String(syntheticRowSeq).padStart(12, '0')}`;
}

/**
 * Structured fields must stay parseable (ISO timestamps, closed enums, ids,
 * URLs used for classification); only free-text fields carry the canary.
 */
const KEEP_CLEAN_FIELDS = new Set([
  'id',
  'observed_at',
  'checked_at',
  'started_at',
  'finished_at',
  'backup_timestamp',
  'generated_at',
  'first_observed_at',
  'last_observed_at',
  'status',
  'severity',
  'status_color',
  'severity_echo',
  'state',
  'overall_status',
  'document_status',
  'result',
  'outcome',
  'reachable',
  'confirmation_state',
  'authorization_state',
  'endpoint_url',
  'freshness_seconds',
  'value_number',
  'unit',
  'coverage',
  'monitor_kind',
  'provider',
  'category',
  'response_time_ms',
]);

function laced(defaults: Record<string, unknown>): Record<string, unknown> {
  const row: Record<string, unknown> = { ...defaults };
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === 'string' && !KEEP_CLEAN_FIELDS.has(key)) {
      row[key] = `${value} ${CANARY_AWS} ${CANARY_BOT_TOKEN}`;
    }
  }
  return row;
}

export function endpointObservationRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return laced(
    {
      id: nextRowId(),
      endpoint_key: 'public-site',
      endpoint_url: 'https://example.test',
      monitor_kind: 'http',
      observed_at: '2026-10-05T06:45:00.000Z',
      status: 'GREEN',
      severity: 'none',
      confirmation_state: 'confirmed',
      response_time_ms: 120,
      correlation_key: 'corr-endpoint',
      source_system: 'uptime-kuma',
      ...overrides,
    },
  );
}

export function metricSampleRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return laced(
    {
      id: nextRowId(),
      metric_key: 'postgresql.connections',
      observed_at: '2026-10-05T06:50:00.000Z',
      status: 'GREEN',
      severity: 'none',
      freshness_seconds: 3600,
      value_number: 42,
      unit: 'count',
      correlation_key: 'corr-metric',
      source_system: 'postgresql',
      ...overrides,
    },
  );
}

export function incidentRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return laced(
    {
      id: nextRowId(),
      incident_key: 'inc-001',
      title: 'synthetic incident',
      state: 'open',
      severity: 'warning',
      started_at: '2026-10-05T06:40:00.000Z',
      observed_at: '2026-10-05T06:40:00.000Z',
      status: 'AMBER',
      correlation_key: 'corr-incident',
      source_system: 'portal',
      ...overrides,
    },
  );
}

export function backupEvidenceRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return laced(
    {
      id: nextRowId(),
      backup_key: 'daily-2026-10-05',
      backup_timestamp: '2026-10-05T02:00:00.000Z',
      observed_at: '2026-10-05T02:00:00.000Z',
      status: 'GREEN',
      severity: 'none',
      checksum_verified: true,
      encrypted_archive_present: true,
      correlation_key: 'corr-backup',
      source_system: 'github_actions',
      ...overrides,
    },
  );
}

export function restoreTestRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return laced(
    {
      id: nextRowId(),
      restore_test_key: 'restore-2026-10-05',
      result: 'passed',
      started_at: '2026-10-05T03:00:00.000Z',
      observed_at: '2026-10-05T03:30:00.000Z',
      status: 'GREEN',
      severity: 'none',
      correlation_key: 'corr-restore',
      source_system: 'github_actions',
      ...overrides,
    },
  );
}

export function workflowExecutionRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return laced(
    {
      id: nextRowId(),
      workflow_key: 'nightly-sync',
      execution_key: 'exec-001',
      outcome: 'success',
      started_at: '2026-10-05T05:00:00.000Z',
      finished_at: '2026-10-05T05:01:00.000Z',
      observed_at: '2026-10-05T05:01:00.000Z',
      status: 'GREEN',
      severity: 'none',
      correlation_key: 'corr-workflow',
      source_system: 'n8n',
      ...overrides,
    },
  );
}

export function reportRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return laced(
    {
      id: nextRowId(),
      report_key: 'monthly-2026-09',
      overall_status: 'GREEN',
      observed_at: '2026-10-01T08:00:00.000Z',
      status: 'GREEN',
      severity: 'none',
      correlation_key: 'corr-report',
      source_system: 'portal',
      ...overrides,
    },
  );
}

export function reportFindingRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return laced(
    {
      id: nextRowId(),
      finding_key: 'finding-001',
      category: 'database',
      severity: 'info',
      safe_title: 'synthetic finding title',
      safe_summary: 'synthetic finding summary',
      observed_at: '2026-10-01T08:00:00.000Z',
      status_color: 'GREEN',
      correlation_key: 'corr-finding',
      source_system: 'portal',
      ...overrides,
    },
  );
}

export function providerConnectionRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return laced(
    {
      id: nextRowId(),
      provider: 'supabase',
      connection_key: 'primary-db',
      reachable: true,
      authorization_state: 'ok',
      observed_at: '2026-10-05T06:55:00.000Z',
      status: 'GREEN',
      severity: 'none',
      correlation_key: 'corr-provider',
      source_system: 'portal',
      ...overrides,
    },
  );
}

/** Append a canary (or arbitrary marker) to every string leaf of a value. */
export function laceStrings<T>(value: T, marker: string): T {
  if (typeof value === 'string') return `${value} ${marker}` as unknown as T;
  if (Array.isArray(value)) return value.map((item) => laceStrings(item, marker)) as unknown as T;
  if (typeof value === 'object' && value !== null) {
    const record: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      record[key] = laceStrings(item, marker);
    }
    return record as unknown as T;
  }
  return value;
}

// --- the contract's fail-closed synthetic projection (soak-driver spec) ---

/** Core required sources named by the soak-driver contract for the blind path. */
export const CORE_REQUIRED_SOURCES = [
  'public-website',
  'public-api',
  'database',
  'incidents',
  'backups-daily',
  'restore-test',
  'n8n-workflows',
  'maintenance-report',
] as const;

export interface BlindProjectionRecord {
  sourceKey: string;
  status: 'UNKNOWN';
  severity: 'critical';
  observedAt: string;
  freshUntil: string;
  criticality: 'required';
  safeSummary: string;
  counts: { samples: number };
}

export interface BlindProjection {
  client: string;
  environment: string;
  records: BlindProjectionRecord[];
}

/**
 * The all-UNKNOWN synthetic projection the driver feeds the supervisor when
 * evidence.read fails: every core source UNKNOWN, severity critical,
 * criticality required, fixed safe summary. Semantics agreed at integration:
 * the projection is built ONCE at outage start (timestamps = first failure,
 * byte-stable across the outage) so it ages UNKNOWN -> AMBER -> RED with the
 * supervisor's stale-required escalation — one deduped alert, then recovery.
 * A blind observer has read zero samples.
 */
export function makeBlindProjection(
  clientKey: string,
  environmentKey: string,
  nowMs: number,
): BlindProjection {
  const iso = new Date(nowMs).toISOString();
  return {
    client: clientKey,
    environment: environmentKey,
    records: CORE_REQUIRED_SOURCES.map((sourceKey) => ({
      sourceKey,
      status: 'UNKNOWN',
      severity: 'critical',
      observedAt: iso,
      freshUntil: iso,
      criticality: 'required',
      safeSummary: 'observer blind: evidence read failed',
      counts: { samples: 0 },
    })),
  };
}

// --- real-chain composition helpers (real supervisor + real alert engine) ---

export class RecordingSender {
  readonly sent: Array<{ kind: string; environmentKey: string; subjectKey: string; text: string }> =
    [];

  async send(message: {
    kind: string;
    environmentKey: string;
    subjectKey: string;
    text: string;
  }): Promise<void> {
    this.sent.push({ ...message });
  }

  get sentTexts(): string[] {
    return this.sent.map((message) => message.text);
  }
}

export function makeRealSupervisor(
  clock: ManualClock,
  options: { requiredSourceKeys?: readonly string[] } = {},
): {
  supervisor: SupervisorService;
  audit: RecordingAuditSink;
} {
  const audit = new RecordingAuditSink();
  const supervisor = new SupervisorService(
    resolveSupervisorOptions({
      now: () => new Date(clock.now()),
      ...(options.requiredSourceKeys
        ? { requiredSourceKeys: [...options.requiredSourceKeys] }
        : {}),
    }),
    audit,
  );
  return { supervisor, audit };
}

export interface SenderMessageShape {
  kind: string;
  environmentKey: string;
  subjectKey: string;
  text: string;
  occurredAt: string;
}

export function makeRealAlertEngine(
  clock: ManualClock,
  sender: { send(message: SenderMessageShape): Promise<void> },
  audit?: { record(event: unknown): unknown },
): AlertEngine {
  return new AlertEngine({
    gate: { assertEnabled(): void {} },
    sender,
    ...(audit ? { audit } : {}),
    maxAlertsPerHour: 60,
    outageRetryMaxAttempts: 3,
    now: clock.now,
  });
}

/** Minimal valid verdict for driving the REAL AlertEngine directly. */
export function makeRealVerdict(assessment: string, issueCode = 'NO_ISSUE'): HealthAssessment {
  return {
    assessment: assessment as HealthAssessment['assessment'],
    summary: 'synthetic deterministic assessment',
    evidenceKeys: ['ev.synthetic.1'],
    confidence: 'HIGH',
    issueCode,
    recommendedRunbook: 'none',
    automationEligibility: 'OWNER_REQUIRED',
  };
}

// --- option builders ---

export interface SoakFakes {
  evidence: { read(clientKey: string, environmentKey: string): Promise<unknown> };
  supervisor: FakeSupervisor;
  alerts: FakeAlerts;
  audit: RecordingAuditSink;
}

export function makeSoakFakes(): SoakFakes {
  return {
    evidence: {
      async read(): Promise<unknown> {
        return { client: CLIENT_A, environment: ENV_A, records: [] };
      },
    },
    supervisor: new FakeSupervisor(),
    alerts: new FakeAlerts(),
    audit: new RecordingAuditSink(),
  };
}

export function makeSoakOptions(
  fakes: SoakFakes,
  clock: ManualClock,
  timers: FakeTimerHub,
  overrides: Partial<SoakDriverOptionsShape> = {},
): SoakDriverOptionsShape {
  return {
    evidence: fakes.evidence,
    supervisor: fakes.supervisor,
    alerts: fakes.alerts,
    audit: fakes.audit,
    clientKey: CLIENT_A,
    environmentKey: ENV_A,
    intervalMs: 900_000,
    digestHourUtc: 7,
    now: clock.now,
    timers: {
      setInterval: timers.setInterval,
      clearInterval: timers.clearInterval,
    },
    ...overrides,
  };
}

// --- source scanning (read-only guarantee) ---

/** Read a sibling worker's source file, or undefined while it is unbuilt. */
export function observerSourceText(moduleFile: 'evidence-source' | 'soak-driver'): string | undefined {
  const filePath = path.join(__dirname, '..', '..', 'src', 'observer', `${moduleFile}.ts`);
  if (!fs.existsSync(filePath)) return undefined;
  return fs.readFileSync(filePath, 'utf8');
}

const DML_KEYWORD = /^(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|GRANT|REVOKE|CREATE|MERGE|UPSERT|REPLACE)$/i;

/**
 * Tokenize TypeScript source and return every SQL-keyword identifier that
 * appears OUTSIDE string literals and comments. A compliant evidence source
 * has no DML/DDL anywhere but inside its (SELECT-only) SQL strings; anything
 * this scan flags is a finding.
 */
export function keywordsOutsideStrings(source: string): string[] {
  const found: string[] = [];
  let i = 0;
  let state: 'normal' | 'single' | 'double' | 'template' | 'lineComment' | 'blockComment' =
    'normal';
  let word = '';
  let wordPrefix = '';
  const flushWord = (): void => {
    // Method calls like `.replace(` are JavaScript, not SQL — a word
    // immediately preceded by a dot can never be a statement keyword.
    if (word && wordPrefix !== '.' && DML_KEYWORD.test(word)) found.push(word.toUpperCase());
    word = '';
    wordPrefix = '';
  };
  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];
    if (state === 'lineComment') {
      if (ch === '\n') state = 'normal';
      i += 1;
      continue;
    }
    if (state === 'blockComment') {
      if (ch === '*' && next === '/') {
        state = 'normal';
        i += 2;
      } else i += 1;
      continue;
    }
    if (state === 'single' || state === 'double' || state === 'template') {
      const quote = state === 'single' ? "'" : state === 'double' ? '"' : '`';
      if (ch === '\\') {
        i += 2;
        continue;
      }
      if (ch === quote) state = 'normal';
      i += 1;
      continue;
    }
    // normal state
    if (ch === '/' && next === '/') {
      flushWord();
      state = 'lineComment';
      i += 2;
      continue;
    }
    if (ch === '/' && next === '*') {
      flushWord();
      state = 'blockComment';
      i += 2;
      continue;
    }
    if (ch === "'") {
      flushWord();
      state = 'single';
      i += 1;
      continue;
    }
    if (ch === '"') {
      flushWord();
      state = 'double';
      i += 1;
      continue;
    }
    if (ch === '`') {
      flushWord();
      state = 'template';
      i += 1;
      continue;
    }
    if (/[A-Za-z]/.test(ch)) {
      if (word === '') wordPrefix = i > 0 ? source[i - 1] : '';
      word += ch;
    } else {
      flushWord();
    }
    i += 1;
  }
  flushWord();
  return found;
}
