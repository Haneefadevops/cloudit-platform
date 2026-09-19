import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  canonicalHash,
  canonicalizeWorkflow,
  compareDesiredState,
  type AuditEvent,
  type DriftState,
  type ManifestEntry,
  type Observation,
} from '@cloudit/operations-agent-contracts';
import { InMemoryAuditSink, type AuditSink } from './audit-sink';
import type {
  LiveN8nObservationSource,
  LiveN8nSnapshot,
  LiveN8nWorkflowRecord,
  ManifestSource,
  PortalCatalogueSource,
} from './ports';
import type { SyncObservation, SyncScanOptions, SyncScanResult } from './sync-observation';
import {
  SYNC_AUDIT_SINK,
  SYNC_CLOCK,
  SYNC_LIVE_OBSERVATION_SOURCE,
  SYNC_MANIFEST_SOURCE,
  SYNC_PORTAL_CATALOGUE_SOURCE,
} from './tokens';

export const DEFAULT_MAX_OBSERVATION_AGE_MS = 15 * 60 * 1000;
export const DEFAULT_ENVIRONMENT_KEY = 'cavetta-synthetic';
export const SYNC_AUDIT_ACTOR = 'agent:sync-auditor';
export const SYNC_AUDIT_EVENT_TYPE = 'workflow_sync_scan';

function toEpochMs(value: string | number | Date): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return Date.parse(value);
}

/**
 * Workflow-portal sync auditor (operator plan section 5). Fully offline,
 * deterministic, read-only: no AI, no alerts, no actions. For each approved
 * manifest entry it gathers the live read-only observation, canonicalizes
 * and hashes the live definition in memory, and compares desired state
 * with `compareDesiredState`. Unknown live workflows and missing ones are
 * reported with the closed drift codes. An n8n outage while the observer
 * stays up yields UNKNOWN_STALE for every in-scope entry — never MATCH,
 * never a silent GREEN (plan section 12).
 */
@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @Optional()
    @Inject(SYNC_MANIFEST_SOURCE)
    private readonly manifestSource?: ManifestSource,
    @Optional()
    @Inject(SYNC_LIVE_OBSERVATION_SOURCE)
    private readonly liveSource?: LiveN8nObservationSource,
    @Optional()
    @Inject(SYNC_PORTAL_CATALOGUE_SOURCE)
    private readonly catalogueSource?: PortalCatalogueSource,
    @Optional()
    @Inject(SYNC_AUDIT_SINK)
    auditSink?: AuditSink,
    @Optional()
    @Inject(SYNC_CLOCK)
    clock?: () => number,
  ) {
    this.auditSink = auditSink ?? new InMemoryAuditSink();
    this.clock = clock ?? (() => Date.now());
  }

  private readonly auditSink: AuditSink;
  private readonly clock: () => number;

  async scan(options: SyncScanOptions = {}): Promise<SyncScanResult> {
    const epochMs = toEpochMs(options.now ?? this.clock());
    const nowIso = new Date(epochMs).toISOString();
    const scanId = options.scanId ?? `sync-${epochMs}`;
    const maxAgeMs = options.maxObservationAgeMs ?? DEFAULT_MAX_OBSERVATION_AGE_MS;
    const environmentKey = options.environmentKey ?? DEFAULT_ENVIRONMENT_KEY;

    const entries = await this.requireManifest().listEntries();
    const snapshot = await this.requireLiveSource().observe();
    const catalogue = await this.requireCatalogue().listListedKeys();

    const observations: SyncObservation[] = [];
    const liveByKey = new Map(snapshot.workflows.map((w) => [w.workflowKey, w]));
    const manifestKeys = new Set(entries.map((e) => e.workflowKey));
    const observerAvailable = snapshot.observerAvailable !== false;
    const observedAtIso = new Date(toEpochMs(snapshot.observedAt)).toISOString();

    for (const entry of entries) {
      if (!observerAvailable) {
        // n8n unreachable while the observer runs: report UNKNOWN_STALE
        // with observer_unavailable; never MATCH, never silent GREEN.
        observations.push({
          workflowKey: entry.workflowKey,
          state: 'UNKNOWN_STALE',
          driftCodes: ['observer_unavailable'],
          observedAt: observedAtIso,
          scanId,
        });
        continue;
      }
      const record = liveByKey.get(entry.workflowKey);
      const comparison = compareDesiredState(
        entry,
        this.toObservation(snapshot, record, catalogue),
        { maxAgeMs, now: epochMs },
      );
      observations.push({
        workflowKey: entry.workflowKey,
        state: comparison.state,
        driftCodes: comparison.driftCodes,
        observedAt: observedAtIso,
        scanId,
      });
    }

    if (observerAvailable) {
      // Live workflows not in the approved manifest: only an unexpectedly
      // active one is drift; sorted for deterministic output order.
      const unexpected = snapshot.workflows
        .filter((w) => !manifestKeys.has(w.workflowKey) && w.found !== false)
        .sort((a, b) => a.workflowKey.localeCompare(b.workflowKey));
      for (const record of unexpected) {
        const comparison = compareDesiredState(
          null,
          this.toObservation(snapshot, record, catalogue),
          { maxAgeMs, now: epochMs },
        );
        observations.push({
          workflowKey: record.workflowKey,
          state: comparison.state,
          driftCodes: comparison.driftCodes,
          observedAt: observedAtIso,
          scanId,
        });
      }
    }

    const result: SyncScanResult = {
      scanId,
      startedAt: nowIso,
      completedAt: nowIso,
      observations,
    };

    this.recordAudit(result, environmentKey, nowIso);
    return result;
  }

  /** Events recorded in the in-memory sink (empty when a platform sink is bound). */
  get auditEvents(): readonly AuditEvent[] {
    return this.auditSink instanceof InMemoryAuditSink ? this.auditSink.events : [];
  }

  private toObservation(
    snapshot: LiveN8nSnapshot,
    record: LiveN8nWorkflowRecord | undefined,
    catalogue: ReadonlySet<string>,
  ): Observation {
    if (!record || record.found === false) {
      return { observedAt: snapshot.observedAt, observerAvailable: true, found: false };
    }
    return {
      observedAt: snapshot.observedAt,
      observerAvailable: true,
      found: true,
      active: record.active,
      trigger: record.trigger ?? null,
      timezone: record.timezone ?? null,
      errorWorkflow: record.errorWorkflow ?? null,
      canonicalHash: record.canonicalHash ?? this.hashRawWorkflow(record.rawWorkflow),
      revisionId: record.revisionId ?? null,
      catalogueListed: catalogue.has(record.workflowKey),
      lastExecutionAt: record.lastExecutionAt ?? null,
    };
  }

  /**
   * Canonicalize and hash a raw live export in memory. The raw export is
   * never retained or emitted; when it cannot be canonicalized no semantic
   * hash is produced (and the semantic-hash check is skipped by the
   * comparator rather than crashing the scan).
   */
  private hashRawWorkflow(rawWorkflow: unknown): string | null {
    if (rawWorkflow === null || typeof rawWorkflow !== 'object') return null;
    return canonicalHash(canonicalizeWorkflow(rawWorkflow));
  }

  private recordAudit(result: SyncScanResult, environmentKey: string, occurredAt: string): void {
    const counts = { MATCH: 0, DRIFT: 0, UNKNOWN_STALE: 0 };
    for (const o of result.observations) counts[o.state] += 1;
    const states = new Set(result.observations.map((o) => o.state));
    let resultCode: string;
    if (result.observations.length === 0) resultCode = 'MATCH';
    else if (states.size === 1) resultCode = [...states][0];
    else resultCode = 'MIXED';

    const evidenceKeys = result.observations
      .filter((o) => o.state !== 'MATCH')
      .map((o) => o.workflowKey)
      .slice(0, 50);

    const event: AuditEvent = {
      eventId: `audit-${result.scanId}`,
      environmentKey,
      eventType: SYNC_AUDIT_EVENT_TYPE,
      actor: SYNC_AUDIT_ACTOR,
      occurredAt,
      reasonCode: 'SCAN_COMPLETED',
      resultCode,
      summary:
        `sync scan ${result.scanId}: total=${result.observations.length} ` +
        `match=${counts.MATCH} drift=${counts.DRIFT} unknown_stale=${counts.UNKNOWN_STALE}`,
      evidenceKeys,
    };
    this.auditSink.record(event);
    this.logger.log(`sync scan ${result.scanId}: result=${resultCode}`);
  }

  private requireManifest(): ManifestSource {
    if (!this.manifestSource) throw new Error('SyncService: manifest source is not bound');
    return this.manifestSource;
  }

  private requireLiveSource(): LiveN8nObservationSource {
    if (!this.liveSource) throw new Error('SyncService: live n8n observation source is not bound');
    return this.liveSource;
  }

  private requireCatalogue(): PortalCatalogueSource {
    if (!this.catalogueSource) throw new Error('SyncService: portal catalogue source is not bound');
    return this.catalogueSource;
  }
}

// Re-exported for consumers that want the observation type alongside the service.
export type { SyncObservation, SyncScanResult, SyncScanOptions };
export type { DriftState };
