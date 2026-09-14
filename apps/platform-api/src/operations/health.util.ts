/**
 * Environment health rollup per the Phase 0 rules:
 *   RED     — the latest execution of any critical/high workflow has
 *             outcome 'failure' or status 'RED';
 *   AMBER   — evidence is stale (no execution observed within the watchdog
 *             freshness window) or the latest execution of a non-critical
 *             workflow failed;
 *   NO_DATA — no executions at all for the environment;
 *   GREEN   — everything else.
 */

export type EnvironmentHealthLevel = 'GREEN' | 'AMBER' | 'RED' | 'NO_DATA';

export interface WorkflowLatestExecution {
  criticality: string;
  outcome: string | null;
  status: string | null;
}

export interface EnvironmentHealth {
  level: EnvironmentHealthLevel;
  reasons: string[];
}

const CRITICALITIES = new Set(['critical', 'high']);
const FAILURE_OUTCOMES = new Set(['failure']);

export function computeEnvironmentHealth(
  latestExecutions: WorkflowLatestExecution[],
  latestObservedAtMs: number | null,
  nowMs: number,
  staleEvidenceMs: number,
): EnvironmentHealth {
  if (latestExecutions.length === 0) {
    return { level: 'NO_DATA', reasons: [] };
  }

  const criticalFailures: string[] = [];
  const nonCriticalFailures: string[] = [];
  for (const execution of latestExecutions) {
    const failed =
      FAILURE_OUTCOMES.has(execution.outcome ?? '') ||
      execution.status === 'RED';
    if (!failed) {
      continue;
    }
    if (CRITICALITIES.has(execution.criticality)) {
      criticalFailures.push(execution.criticality);
    } else {
      nonCriticalFailures.push(execution.criticality);
    }
  }

  if (criticalFailures.length > 0) {
    return {
      level: 'RED',
      reasons: [
        'Latest execution of a critical/high workflow failed (outcome failure or status RED)',
      ],
    };
  }

  const reasons: string[] = [];
  let level: EnvironmentHealthLevel = 'GREEN';

  const stale =
    latestObservedAtMs === null || nowMs - latestObservedAtMs > staleEvidenceMs;
  if (stale) {
    level = 'AMBER';
    reasons.push(
      'Stale evidence: no workflow execution observed within the freshness window',
    );
  }

  if (nonCriticalFailures.length > 0) {
    level = 'AMBER';
    reasons.push(
      'Latest execution of a non-critical workflow failed (outcome failure or status RED)',
    );
  }

  return { level, reasons };
}

export type InfrastructureStatus = 'GREEN' | 'AMBER' | 'RED';

/** Slow-response threshold for endpoint cards (Phase 0 watchdog rules). */
const SLOW_RESPONSE_MS = 3000;

/**
 * Derive the card status for an endpoint observation: down is RED, a 5xx
 * status or a slow response is AMBER, everything else is GREEN.
 */
export function deriveEndpointStatus(
  available: boolean,
  httpStatus: number | null,
  responseTimeMs: number | null,
): InfrastructureStatus {
  if (!available) {
    return 'RED';
  }
  if (
    (httpStatus !== null && httpStatus >= 500) ||
    (responseTimeMs !== null && responseTimeMs > SLOW_RESPONSE_MS)
  ) {
    return 'AMBER';
  }
  return 'GREEN';
}

/**
 * Recompute the database card status from the latest postgresql.* rollup
 * metrics (Phase 0 thresholds): up=false, filesystem read-only or OOM kills
 * are RED; disk/memory at or above 85 percent, PgBouncer utilization at or
 * above 80 percent, or any restart is AMBER; otherwise GREEN.
 */
export function computeDatabaseRollupStatus(
  metrics: Record<string, number | boolean | null>,
): InfrastructureStatus {
  const numberValue = (key: string): number | null => {
    const value = metrics[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  };
  const booleanValue = (key: string): boolean | null =>
    typeof metrics[key] === 'boolean' ? metrics[key] : null;

  if (
    booleanValue('postgresql.up') === false ||
    booleanValue('postgresql.filesystem_read_only') === true ||
    (numberValue('postgresql.oom_kill_count') ?? 0) > 0
  ) {
    return 'RED';
  }
  const disk = numberValue('postgresql.disk_usage_percent');
  const memory = numberValue('postgresql.memory_usage_percent');
  const pgbouncer = numberValue('postgresql.pgbouncer_utilization_percent');
  const restarts = numberValue('postgresql.restart_count');
  if (
    (disk !== null && disk >= 85) ||
    (memory !== null && memory >= 85) ||
    (pgbouncer !== null && pgbouncer >= 80) ||
    (restarts !== null && restarts >= 1)
  ) {
    return 'AMBER';
  }
  return 'GREEN';
}
