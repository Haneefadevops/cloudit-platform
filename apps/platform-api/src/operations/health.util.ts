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

/**
 * Phase 7 analytics rollups (Vercel/ImageKit cards). UNKNOWN is part of the
 * contract enum but never produced by these rules; NO_DATA means the
 * provider has published no evidence at all.
 */
export type AnalyticsRollupStatus =
  'GREEN' | 'AMBER' | 'RED' | 'NO_DATA' | 'UNKNOWN';

export interface VercelAnalyticsEvidence {
  connectivityReachable: boolean | null;
  /** False when no provider_connections row exists for 'vercel' at all. */
  hasConnectivity: boolean;
  currentDeploymentState: string | null;
  hasUnverifiedDomain: boolean;
  hasTraffic: boolean;
  lastTrafficAtMs: number | null;
  hasDeployments: boolean;
  anyRecentDeploymentFailed: boolean;
}

/**
 * Phase 7 Vercel rollup:
 *   RED     — connectivity unreachable, or the current production
 *             deployment failed;
 *   AMBER   — an unverified domain exists, traffic evidence is older than
 *             staleTrafficMs while traffic exists, or any recent deployment
 *             failed;
 *   NO_DATA — no traffic, no deployments and no connectivity evidence;
 *   GREEN   — everything else.
 */
export function computeVercelRollupStatus(
  evidence: VercelAnalyticsEvidence,
  nowMs: number,
  staleTrafficMs: number,
): AnalyticsRollupStatus {
  if (
    evidence.connectivityReachable === false ||
    evidence.currentDeploymentState === 'failed'
  ) {
    return 'RED';
  }
  if (evidence.hasUnverifiedDomain) {
    return 'AMBER';
  }
  if (evidence.hasTraffic) {
    const stale =
      evidence.lastTrafficAtMs === null ||
      nowMs - evidence.lastTrafficAtMs > staleTrafficMs;
    if (stale) {
      return 'AMBER';
    }
  }
  if (evidence.anyRecentDeploymentFailed) {
    return 'AMBER';
  }
  if (
    !evidence.hasTraffic &&
    !evidence.hasDeployments &&
    !evidence.hasConnectivity
  ) {
    return 'NO_DATA';
  }
  return 'GREEN';
}

export interface ImagekitAnalyticsEvidence {
  connectivityReachable: boolean | null;
  utilizationPercent: number | null;
  /** True when at least one of the five usage keys has any sample. */
  hasSamples: boolean;
  newestSampleAtMs: number | null;
}

/**
 * Phase 7 ImageKit rollup:
 *   RED     — connectivity unreachable;
 *   AMBER   — quota utilization at or above 80 percent, or the newest
 *             sample across the five usage keys is older than
 *             staleEvidenceMs while some evidence exists;
 *   NO_DATA — no samples at all across the five usage keys;
 *   GREEN   — everything else.
 */
export function computeImagekitRollupStatus(
  evidence: ImagekitAnalyticsEvidence,
  nowMs: number,
  staleEvidenceMs: number,
): AnalyticsRollupStatus {
  if (evidence.connectivityReachable === false) {
    return 'RED';
  }
  if (
    evidence.utilizationPercent !== null &&
    evidence.utilizationPercent >= 80
  ) {
    return 'AMBER';
  }
  if (!evidence.hasSamples) {
    return 'NO_DATA';
  }
  const stale =
    evidence.newestSampleAtMs === null ||
    nowMs - evidence.newestSampleAtMs > staleEvidenceMs;
  if (stale) {
    return 'AMBER';
  }
  return 'GREEN';
}
