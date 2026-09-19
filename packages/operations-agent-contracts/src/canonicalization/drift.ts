/**
 * Desired-state vs live-observation drift comparison for the CloudIT AI
 * maintenance agent. Purely offline: both inputs are plain data (an
 * approved manifest entry and an observation record). See the operator
 * plan section 5.4 for the closed drift-code catalogue reproduced as
 * `DriftCode` below.
 */

export type DriftCode =
  | 'workflow_missing'
  | 'unexpected_active_workflow'
  | 'active_state_mismatch'
  | 'published_revision_mismatch'
  | 'semantic_hash_mismatch'
  | 'schedule_mismatch'
  | 'timezone_mismatch'
  | 'error_workflow_detached'
  | 'catalogue_mismatch'
  | 'expected_execution_missing'
  | 'portal_evidence_missing'
  | 'observer_unavailable'
  | 'observation_stale';

/** Closed catalogue in canonical emission order. */
export const DRIFT_CODE_ORDER: readonly DriftCode[] = [
  'workflow_missing',
  'unexpected_active_workflow',
  'active_state_mismatch',
  'published_revision_mismatch',
  'semantic_hash_mismatch',
  'schedule_mismatch',
  'timezone_mismatch',
  'error_workflow_detached',
  'catalogue_mismatch',
  'expected_execution_missing',
  'portal_evidence_missing',
  'observer_unavailable',
  'observation_stale',
];

export type DriftState = 'MATCH' | 'DRIFT' | 'UNKNOWN_STALE';

export interface DriftComparison {
  state: DriftState;
  driftCodes: DriftCode[];
}

export type TriggerKind = 'cron' | 'webhook' | 'manual' | 'form' | 'unknown';

/** Approved intent for one workflow. `null` means "not in the manifest". */
export interface ManifestEntry {
  workflowKey: string;
  /** Whether the workflow is expected to be active. */
  expectedActive: boolean;
  /** Expected trigger kind; 'cron' requires `cron`. */
  triggerKind: TriggerKind;
  /** Expected cron expression (when triggerKind is 'cron'). */
  cron?: string;
  /** Expected workflow timezone (e.g. 'Asia/Colombo'). */
  timezone?: string;
  /** An error workflow must be attached. */
  errorWorkflowRequired?: boolean;
  /** Approved canonical semantic hash (from canonicalHash). */
  canonicalHash?: string;
  /** Expected published revision identifier (when the portal tracks one). */
  revisionId?: string;
  /** Workflow must be listed in the approved catalogue (default true). */
  inCatalogue?: boolean;
  /** Workflow must have produced at least one observed execution. */
  expectsExecutions?: boolean;
  /** A portal evidence record must be linked to the observation. */
  requiresPortalEvidence?: boolean;
}

export interface Observation {
  /** When the observation was taken (ISO string or epoch ms). Required. */
  observedAt: string | number | Date;
  /** Set false when the observer/collector could not reach n8n. */
  observerAvailable?: boolean;
  /** Whether the workflow exists on the instance at all. */
  found?: boolean;
  /** Observed active flag. */
  active?: boolean;
  /** Observed trigger. */
  trigger?: { kind?: TriggerKind; cron?: string } | null;
  /** Observed workflow timezone. */
  timezone?: string | null;
  /** Observed attached error workflow (identity checked separately). */
  errorWorkflow?: { id?: string | null; name?: string | null } | null;
  /** Observed canonical semantic hash. */
  canonicalHash?: string | null;
  /** Observed published revision identifier. */
  revisionId?: string | null;
  /** Whether the workflow is listed in the approved catalogue. */
  catalogueListed?: boolean;
  /** When the workflow last produced an execution (ISO string or ms). */
  lastExecutionAt?: string | number | Date | null;
  /** Linked portal evidence record, if any. */
  portalEvidence?: unknown;
}

export interface CompareOptions {
  /** Maximum observation age before it is considered stale (ms). Required. */
  maxAgeMs: number;
  /** Reference clock, injectable for deterministic tests. Defaults to Date.now(). */
  now?: string | number | Date;
}

function toEpochMs(value: string | number | Date): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return Date.parse(value);
}

function result(codes: DriftCode[]): DriftComparison {
  // Emit codes in closed-catalogue order, deduplicated.
  const unique = new Set(codes);
  const driftCodes = DRIFT_CODE_ORDER.filter((code) => unique.has(code));
  return { state: driftCodes.length > 0 ? 'DRIFT' : 'MATCH', driftCodes };
}

/**
 * Compare an approved manifest entry against a live observation.
 *
 * Precedence:
 *   1. `observer_unavailable` → DRIFT (the observation itself is untrusted
 *      beyond the fact the observer is down).
 *   2. Stale observation (age > maxAgeMs, or unparseable observedAt) →
 *      UNKNOWN_STALE with `observation_stale` only. A stale observation
 *      NEVER yields MATCH or DRIFT.
 *   3. Otherwise evaluate every applicable drift code; any hits → DRIFT
 *      with the codes in catalogue order, else MATCH with [].
 */
export function compareDesiredState(
  manifestEntry: ManifestEntry | null,
  observation: Observation,
  options: CompareOptions,
): DriftComparison {
  if (observation.observerAvailable === false) {
    return result(['observer_unavailable']);
  }

  const observedAtMs = toEpochMs(observation.observedAt);
  const nowMs = options.now !== undefined ? toEpochMs(options.now) : Date.now();
  const ageMs = nowMs - observedAtMs;
  if (!Number.isFinite(observedAtMs) || ageMs > options.maxAgeMs) {
    return { state: 'UNKNOWN_STALE', driftCodes: ['observation_stale'] };
  }

  const codes: DriftCode[] = [];

  if (observation.found === false) {
    codes.push('workflow_missing');
  }

  if (manifestEntry === null) {
    // Workflow not in the approved manifest: only presence-while-active is drift.
    if (observation.active === true) {
      codes.push('unexpected_active_workflow');
    }
    return result(codes);
  }

  if (typeof observation.active === 'boolean' && observation.active !== manifestEntry.expectedActive) {
    codes.push('active_state_mismatch');
  }

  if (
    manifestEntry.revisionId !== undefined &&
    observation.revisionId != null &&
    observation.revisionId !== manifestEntry.revisionId
  ) {
    codes.push('published_revision_mismatch');
  }

  if (
    manifestEntry.canonicalHash !== undefined &&
    observation.canonicalHash != null &&
    observation.canonicalHash !== manifestEntry.canonicalHash
  ) {
    codes.push('semantic_hash_mismatch');
  }

  if (manifestEntry.triggerKind === 'cron') {
    const observedCron = observation.trigger?.cron;
    if (observedCron !== undefined && observedCron !== manifestEntry.cron) {
      codes.push('schedule_mismatch');
    }
  }
  if (
    manifestEntry.triggerKind !== undefined &&
    observation.trigger?.kind !== undefined &&
    observation.trigger.kind !== manifestEntry.triggerKind
  ) {
    codes.push('schedule_mismatch');
  }

  if (
    manifestEntry.timezone !== undefined &&
    observation.timezone != null &&
    observation.timezone !== manifestEntry.timezone
  ) {
    codes.push('timezone_mismatch');
  }

  if (manifestEntry.errorWorkflowRequired === true && !observation.errorWorkflow?.id) {
    codes.push('error_workflow_detached');
  }

  if (manifestEntry.inCatalogue !== false && observation.catalogueListed === false) {
    codes.push('catalogue_mismatch');
  }

  if (manifestEntry.expectsExecutions === true && observation.lastExecutionAt == null) {
    codes.push('expected_execution_missing');
  }

  if (manifestEntry.requiresPortalEvidence === true && observation.portalEvidence == null) {
    codes.push('portal_evidence_missing');
  }

  return result(codes);
}
