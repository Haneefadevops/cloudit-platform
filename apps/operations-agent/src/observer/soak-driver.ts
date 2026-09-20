/**
 * Soak driver - the read-only periodic observation job (operator-plan
 * section 11.2 "soak"): read evidence from the operations DB through the
 * SELECT-only operations_reader role, run the deterministic supervisor, and
 * feed the alert engine. One daily digest per environment.
 *
 * Hard rules enforced here:
 *  - READ-ONLY: the driver never writes anywhere; the evidence source is a
 *    pure read port.
 *  - Deterministic only: verdicts come from the supervisor; nothing here
 *    infers, improvises or touches AI.
 *  - Fail-closed: an evidence read failure degrades to a synthetic
 *    all-UNKNOWN projection so a sustained outage surfaces as ONE deduped
 *    alert (stale-required escalation in the supervisor) and a recovery
 *    message once evidence flows again. The blind projection is built ONCE
 *    at outage start and reused for every failed tick: its freshness must
 *    age for the supervisor's stale-required escalation to fire, and its
 *    byte-stability keeps the alert engine's dedup honest.
 *  - Ticks never overlap: an in-flight tick suppresses concurrent ticks.
 *  - Never throws: every failure path resolves with one bounded, closed
 *    audit event; raw errors never enter audit summaries or alerts.
 *  - Digest at most once per UTC day, on the first tick at/after the
 *    configured UTC hour.
 */

import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { HealthAssessment } from '@cloudit/operations-agent-contracts';
import type { DigestEntry } from '../alerts';
import { DEFAULT_SOURCE_KEYS } from '../supervisor';
import type { SupervisorRunResult } from '../supervisor';
import type { EvidenceSource } from './evidence-source';

export interface SoakDriverOptions {
  evidence: EvidenceSource;
  supervisor: { assess(input: unknown): SupervisorRunResult };
  alerts: {
    handle(environmentKey: string, verdict: HealthAssessment): Promise<unknown>;
    sendDigest(
      environmentKey: string,
      period: 'daily',
      entries: DigestEntry[],
    ): Promise<unknown>;
  };
  audit?: { record(event: unknown): unknown };
  /** Default 'cavetta'. */
  clientKey?: string;
  /** Default 'production'. */
  environmentKey?: string;
  /** Default 900_000 (15 minutes). */
  intervalMs?: number;
  /** UTC hour 0-23. Default 7. */
  digestHourUtc?: number;
  /** ms epoch; default Date.now. */
  now?: () => number;
  timers?: {
    setInterval(fn: () => void, ms: number): unknown;
    clearInterval(handle: unknown): void;
  };
}

export type TickOutcome =
  | { status: 'ASSESSED'; red: boolean }
  | { status: 'DIGEST_SENT' }
  | { status: 'SUPPRESSED'; reason: 'TICK_IN_FLIGHT' };

/** Closed audit record for observer-internal events; safe codes only. */
export interface ObserverAuditEvent {
  eventType: 'observer_read' | 'observer_internal';
  reasonCode: 'EVIDENCE_READ_FAILED' | 'ASSESSMENT_REJECTED' | 'DIGEST_FAILED' | 'INTERNAL_ERROR';
  summary: string;
  evidenceKeys: string[];
}

const DEFAULT_CLIENT_KEY = 'cavetta';
const DEFAULT_ENVIRONMENT_KEY = 'production';
const DEFAULT_INTERVAL_MS = 900_000;
const DEFAULT_DIGEST_HOUR_UTC = 7;
const OBSERVER_AUDIT_SUMMARY_MAX_CHARS = 200;
const DIGEST_MAX_ENTRIES = 13;
const DIGEST_ENTRY_SUMMARY_MAX_CHARS = 200;
const OBSERVER_BLIND_SUMMARY = 'observer blind: evidence read failed';

/**
 * Core required sources covered by the fail-closed projection. Kept in sync
 * with the supervisor's required catalogue minus sync/AI sources the DB
 * reader cannot evidence.
 */
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

const RECORD_STATUS_TO_CATEGORY: Record<string, DigestEntry['category']> = {
  OK: 'GREEN',
  DEGRADED: 'AMBER',
  FAILED: 'RED',
  UNKNOWN: 'UNKNOWN',
};

interface DigestStateEntry {
  category: DigestEntry['category'];
  summary: string;
  lastOccurredAt: string;
}

function utcDayOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Fail-closed projection for a blind observer, built ONCE at outage start.
 * Records are fresh UNKNOWN at construction and age from there, so the
 * supervisor's stale-required escalation turns a sustained outage into ONE
 * RED verdict (deduped by the alert engine); a successful read discards the
 * cache and returning evidence clears the alert. safeSummary is a fixed
 * constant so the projection stays byte-stable across the outage.
 */
function buildObserverBlindProjection(
  clientKey: string,
  environmentKey: string,
  nowIso: string,
): unknown {
  return {
    client: clientKey,
    environment: environmentKey,
    records: CORE_SOURCE_KEYS.map((sourceKey) => ({
      sourceKey,
      status: 'UNKNOWN',
      severity: 'critical',
      observedAt: nowIso,
      freshUntil: nowIso,
      criticality: 'required',
      safeSummary: OBSERVER_BLIND_SUMMARY,
      counts: { samples: 0 },
    })),
  };
}

interface ProjectionRecordLike {
  sourceKey?: unknown;
  status?: unknown;
  safeSummary?: unknown;
}

/** Extracts record-like entries from an (already validated) projection. */
function projectionRecordsOf(projection: unknown): ProjectionRecordLike[] {
  if (typeof projection !== 'object' || projection === null) return [];
  const records = (projection as { records?: unknown }).records;
  if (!Array.isArray(records)) return [];
  return records.filter(
    (record): record is ProjectionRecordLike =>
      typeof record === 'object' && record !== null,
  );
}

export class SoakDriver implements OnModuleInit, OnModuleDestroy {
  private readonly evidence: EvidenceSource;
  private readonly supervisor: SoakDriverOptions['supervisor'];
  private readonly alerts: SoakDriverOptions['alerts'];
  private readonly auditSink: SoakDriverOptions['audit'];
  private readonly clientKey: string;
  private readonly environmentKey: string;
  private readonly intervalMs: number;
  private readonly digestHourUtc: number;
  private readonly now: () => number;
  private readonly timers: NonNullable<SoakDriverOptions['timers']>;
  private timerHandle: unknown;
  private inFlight = false;
  private currentTick: Promise<void> | null = null;
  private lastDigestUtcDay: string | null = null;
  private blindProjection: unknown = null;
  private readonly digestState = new Map<string, DigestStateEntry>();

  constructor(options: SoakDriverOptions) {
    if (!options || typeof options !== 'object') {
      throw new Error('soak driver: options are required');
    }
    if (!options.evidence || typeof options.evidence.read !== 'function') {
      throw new Error('soak driver: evidence.read is required');
    }
    if (!options.supervisor || typeof options.supervisor.assess !== 'function') {
      throw new Error('soak driver: supervisor.assess is required');
    }
    if (
      !options.alerts ||
      typeof options.alerts.handle !== 'function' ||
      typeof options.alerts.sendDigest !== 'function'
    ) {
      throw new Error('soak driver: alerts.handle and alerts.sendDigest are required');
    }
    const clientKey = options.clientKey ?? DEFAULT_CLIENT_KEY;
    const environmentKey = options.environmentKey ?? DEFAULT_ENVIRONMENT_KEY;
    const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    const digestHourUtc = options.digestHourUtc ?? DEFAULT_DIGEST_HOUR_UTC;
    if (typeof clientKey !== 'string' || clientKey.length === 0) {
      throw new Error('soak driver: clientKey must be a non-empty string');
    }
    if (typeof environmentKey !== 'string' || environmentKey.length === 0) {
      throw new Error('soak driver: environmentKey must be a non-empty string');
    }
    if (!Number.isInteger(intervalMs) || intervalMs <= 0) {
      throw new Error('soak driver: intervalMs must be a positive integer');
    }
    if (!Number.isInteger(digestHourUtc) || digestHourUtc < 0 || digestHourUtc > 23) {
      throw new Error('soak driver: digestHourUtc must be an integer between 0 and 23');
    }
    this.evidence = options.evidence;
    this.supervisor = options.supervisor;
    this.alerts = options.alerts;
    this.auditSink = options.audit;
    this.clientKey = clientKey;
    this.environmentKey = environmentKey;
    this.intervalMs = intervalMs;
    this.digestHourUtc = digestHourUtc;
    this.now = options.now ?? (() => Date.now());
    this.timers = options.timers ?? {
      setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
      clearInterval: (handle: unknown) => clearInterval(handle as ReturnType<typeof setInterval>),
    };
  }

  onModuleInit(): void {
    if (this.timerHandle !== undefined) return;
    this.timerHandle = this.timers.setInterval(() => {
      void this.tick();
    }, this.intervalMs);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timerHandle !== undefined) {
      this.timers.clearInterval(this.timerHandle);
      this.timerHandle = undefined;
    }
    const pending = this.currentTick;
    if (pending) await pending;
  }

  /** One observation cycle. Never throws; bounded internal errors are audited. */
  async tick(): Promise<TickOutcome> {
    if (this.inFlight) return { status: 'SUPPRESSED', reason: 'TICK_IN_FLIGHT' };
    this.inFlight = true;
    const run = this.runTick();
    this.currentTick = run.then(
      () => undefined,
      () => undefined,
    );
    try {
      return await run;
    } finally {
      this.inFlight = false;
      this.currentTick = null;
    }
  }

  private async runTick(): Promise<TickOutcome> {
    try {
      return await this.observe();
    } catch {
      this.recordAudit(
        'observer_internal',
        'INTERNAL_ERROR',
        'observer internal error during tick; alerts skipped for this cycle',
        new Date(this.now()).toISOString(),
      );
      return { status: 'ASSESSED', red: false };
    }
  }

  private async observe(): Promise<TickOutcome> {
    const nowMs = this.now();
    const nowIso = new Date(nowMs).toISOString();

    let projection: unknown;
    try {
      projection = await this.evidence.read(this.clientKey, this.environmentKey);
      this.blindProjection = null;
    } catch {
      this.recordAudit(
        'observer_read',
        'EVIDENCE_READ_FAILED',
        'evidence read failed; fail-closed UNKNOWN projection engaged',
        nowIso,
      );
      if (this.blindProjection === null) {
        this.blindProjection = buildObserverBlindProjection(
          this.clientKey,
          this.environmentKey,
          nowIso,
        );
      }
      projection = this.blindProjection;
    }

    const result = this.supervisor.assess(projection);
    if (!result.ok) {
      this.recordAudit(
        'observer_internal',
        'ASSESSMENT_REJECTED',
        `supervisor rejected projection (${result.errors.length} issue(s)); alerts skipped`,
        nowIso,
      );
      return { status: 'ASSESSED', red: false };
    }

    this.updateDigestState(projection, nowIso);
    await this.alerts.handle(this.environmentKey, result.assessment);
    const red = result.assessment.assessment === 'RED';

    if (this.digestDue(nowMs)) {
      try {
        await this.alerts.sendDigest(this.environmentKey, 'daily', this.digestEntries());
        this.lastDigestUtcDay = utcDayOf(nowMs);
        return { status: 'DIGEST_SENT' };
      } catch {
        this.recordAudit(
          'observer_internal',
          'DIGEST_FAILED',
          'daily digest send failed; next eligible tick will retry',
          nowIso,
        );
      }
    }
    return { status: 'ASSESSED', red };
  }

  private digestDue(nowMs: number): boolean {
    if (new Date(nowMs).getUTCHours() < this.digestHourUtc) return false;
    return this.lastDigestUtcDay !== utcDayOf(nowMs);
  }

  private updateDigestState(projection: unknown, nowIso: string): void {
    for (const record of projectionRecordsOf(projection)) {
      const sourceKey = record.sourceKey;
      if (typeof sourceKey !== 'string' || sourceKey.length === 0) continue;
      const category = RECORD_STATUS_TO_CATEGORY[record.status as string];
      if (!category) continue;
      const rawSummary = typeof record.safeSummary === 'string' ? record.safeSummary : '';
      const summary =
        rawSummary.length <= DIGEST_ENTRY_SUMMARY_MAX_CHARS
          ? rawSummary
          : rawSummary.slice(0, DIGEST_ENTRY_SUMMARY_MAX_CHARS);
      this.digestState.set(sourceKey, { category, summary, lastOccurredAt: nowIso });
    }
    while (this.digestState.size > DIGEST_MAX_ENTRIES) {
      const oldest = this.digestState.keys().next();
      if (oldest.done) break;
      this.digestState.delete(oldest.value);
    }
  }

  private digestEntries(): DigestEntry[] {
    // The digest is the full source board: every known source key appears,
    // with UNKNOWN for sources that produced no observation yet — a missing
    // row must be visible, not silently absent.
    const entries: DigestEntry[] = [];
    for (const sourceKey of DEFAULT_SOURCE_KEYS) {
      const state = this.digestState.get(sourceKey);
      entries.push({
        subjectKey: sourceKey,
        category: state?.category ?? 'UNKNOWN',
        summary: state?.summary ?? 'no recent observation',
        lastOccurredAt: state?.lastOccurredAt ?? new Date(this.now()).toISOString(),
      });
      if (entries.length >= DIGEST_MAX_ENTRIES) break;
    }
    return entries;
  }

  private recordAudit(
    eventType: ObserverAuditEvent['eventType'],
    reasonCode: ObserverAuditEvent['reasonCode'],
    summary: string,
    occurredAtIso: string,
  ): void {
    if (!this.auditSink) return;
    const bounded =
      summary.length <= OBSERVER_AUDIT_SUMMARY_MAX_CHARS
        ? summary
        : summary.slice(0, OBSERVER_AUDIT_SUMMARY_MAX_CHARS);
    try {
      this.auditSink.record({
        eventType,
        reasonCode,
        summary: bounded,
        evidenceKeys: [],
      } satisfies ObserverAuditEvent);
    } catch {
      // Audit sinks must never break the observer.
    }
  }
}
