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
  /** Latest provider_connections row for connection_key 'rest-api'. */
  connectivityReachable: boolean | null;
  /** False when no 'rest-api' provider_connections row exists for 'vercel'. */
  hasConnectivity: boolean;
  /**
   * Latest provider_connections row for connection_key 'web-analytics'
   * (the traffic collector); null when that collector has never published.
   * Assessed separately from the REST API: a traffic-collection outage
   * must not mark the whole provider RED while deployments/domains stay
   * healthy.
   */
  webAnalyticsReachable: boolean | null;
  currentDeploymentState: string | null;
  hasUnverifiedDomain: boolean;
  hasTraffic: boolean;
  lastTrafficAtMs: number | null;
  hasDeployments: boolean;
  anyRecentDeploymentFailed: boolean;
}

/**
 * Phase 7 Vercel rollup:
 *   RED     — the 'rest-api' connectivity row is unreachable, or the current
 *             production deployment failed;
 *   AMBER   — the 'web-analytics' connectivity row is unreachable, an
 *             unverified domain exists, traffic evidence is older than
 *             staleTrafficMs while traffic exists, or any recent deployment
 *             failed;
 *   NO_DATA — no traffic, no deployments and no 'rest-api' connectivity
 *             evidence;
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
  if (evidence.webAnalyticsReachable === false) {
    return 'AMBER';
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

// Phase 8 backup-centre windows (Phase 0 §11.1/§11.2 thresholds).
const BACKUPS_NO_SUCCESS_MS = 28 * 60 * 60 * 1_000; // 28 hours
const BACKUPS_OVERDUE_GRACE_MS = 30 * 60 * 1_000; // 30 minutes
const BACKUPS_RESTORE_STALE_MS = 32 * 24 * 60 * 60 * 1_000; // 32 days
const BACKUPS_MONTHLY_GRACE_MS = 36 * 60 * 60 * 1_000; // 36 hours

export interface BackupsRollupEvidence {
  /** Any backup_evidence row at all. */
  hasEvidence: boolean;
  /** The newest daily backup record is a failure (failed run/verification/missing pair). */
  latestBackupFailed: boolean;
  /** Newest successful backup timestamp (any retention class), ms epoch; null when never. */
  lastSuccessAtMs: number | null;
  /** Expected next daily run = last successful daily backup + 24h, ms epoch; null when unknown. */
  expectedNextRunAtMs: number | null;
  /** Latest restore test has result 'failed'. */
  restoreTestFailed: boolean;
  /** Latest restore test start, ms epoch; null when never. */
  lastRestoreTestAtMs: number | null;
  /** A monthly-class backup exists for the current UTC month. */
  monthlyCopyPresent: boolean;
}

/**
 * Phase 8 backups rollup (backup centre card):
 *   RED     — the latest daily backup failed (failed run / failed
 *             verification / missing pair), the latest restore test failed,
 *             or no successful backup has been observed within the last
 *             28 hours (including never);
 *   AMBER   — the expected daily run is overdue more than 30 minutes, the
 *             latest restore test is older than 32 days (including never),
 *             or no monthly-class backup exists for the current UTC month
 *             once more than 36 hours have passed since its first day;
 *   NO_DATA — no backup evidence at all;
 *   GREEN   — everything else.
 */
export function computeBackupsRollupStatus(
  evidence: BackupsRollupEvidence,
  nowMs: number,
): { level: AnalyticsRollupStatus; reasons: string[] } {
  if (!evidence.hasEvidence) {
    return { level: 'NO_DATA', reasons: [] };
  }

  const redReasons: string[] = [];
  if (evidence.latestBackupFailed) {
    redReasons.push(
      'Latest daily backup failed (failed run, failed verification or missing pair)',
    );
  }
  if (evidence.restoreTestFailed) {
    redReasons.push('Latest restore test failed');
  }
  if (evidence.lastSuccessAtMs === null) {
    redReasons.push('No successful backup has ever been observed');
  } else if (nowMs - evidence.lastSuccessAtMs > BACKUPS_NO_SUCCESS_MS) {
    redReasons.push('No successful backup within the last 28 hours');
  }
  if (redReasons.length > 0) {
    return { level: 'RED', reasons: redReasons };
  }

  const amberReasons: string[] = [];
  if (
    evidence.expectedNextRunAtMs !== null &&
    nowMs > evidence.expectedNextRunAtMs + BACKUPS_OVERDUE_GRACE_MS
  ) {
    amberReasons.push(
      'Latest backup is overdue more than 30 minutes past the expected run time',
    );
  }
  if (evidence.lastRestoreTestAtMs === null) {
    amberReasons.push('No restore test evidence has ever been observed');
  } else if (nowMs - evidence.lastRestoreTestAtMs > BACKUPS_RESTORE_STALE_MS) {
    amberReasons.push('Latest restore test is older than 32 days');
  }
  const monthStartMs = Date.UTC(
    new Date(nowMs).getUTCFullYear(),
    new Date(nowMs).getUTCMonth(),
    1,
  );
  if (
    !evidence.monthlyCopyPresent &&
    nowMs > monthStartMs + BACKUPS_MONTHLY_GRACE_MS
  ) {
    amberReasons.push(
      'No monthly-class backup exists for the current UTC month',
    );
  }
  if (amberReasons.length > 0) {
    return { level: 'AMBER', reasons: amberReasons };
  }

  return { level: 'GREEN', reasons: [] };
}
