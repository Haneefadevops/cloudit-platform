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
