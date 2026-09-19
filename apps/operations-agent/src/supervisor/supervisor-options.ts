/**
 * Constructor-injectable supervisor options. Every threshold and freshness
 * window used by the deterministic rule engine lives here - nothing is
 * hard-coded in rule logic. Defaults are safe and conservative.
 */

/** Nest injection token for ResolvedSupervisorOptions. */
export const SUPERVISOR_OPTIONS = Symbol('SUPERVISOR_OPTIONS');

export interface SupervisorOptions {
  /** Known evidence source-key catalogue (projection validator is fail-closed on it). */
  knownSourceKeys?: readonly string[];
  /** Sources whose absence downgrades a verdict to NO_DATA (never GREEN). */
  requiredSourceKeys?: readonly string[];
  /** A stale 'required' source overdue by more than this becomes RED. */
  criticalOverdueMs?: number;
  /** Same-source fresh failures within the window that escalate AMBER to RED. */
  repeatedFailureThreshold?: number;
  /** Rolling window for the repeated-failure escalation rule. */
  escalationWindowMs?: number;
  /** Clock injection; defaults to the wall clock. Tests inject a fixed clock. */
  now?: () => Date;
}

export interface ResolvedSupervisorOptions {
  knownSourceKeys: ReadonlySet<string>;
  requiredSourceKeys: ReadonlySet<string>;
  criticalOverdueMs: number;
  repeatedFailureThreshold: number;
  escalationWindowMs: number;
  now: () => Date;
}

/** Default evidence-source catalogue (synthetic shape of operator-plan 4.1). */
export const DEFAULT_SOURCE_KEYS = [
  'public-website',
  'public-api',
  'database',
  'incidents',
  'backups-daily',
  'restore-test',
  'n8n-workflows',
  'snapshot-coverage',
  'maintenance-report',
  'sync-drift',
  'vercel-analytics',
  'imagekit-delivery',
  'ai-budget',
] as const;

/** Sources that must be present and fresh for a trustworthy verdict. */
export const DEFAULT_REQUIRED_SOURCE_KEYS = [
  'public-website',
  'public-api',
  'database',
  'incidents',
  'backups-daily',
  'restore-test',
  'n8n-workflows',
  'sync-drift',
] as const;

export const DEFAULT_CRITICAL_OVERDUE_MS = 30 * 60 * 1000;
export const DEFAULT_REPEATED_FAILURE_THRESHOLD = 3;
export const DEFAULT_ESCALATION_WINDOW_MS = 60 * 60 * 1000;

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, received ${value}`);
  }
}

export function resolveSupervisorOptions(options: SupervisorOptions = {}): ResolvedSupervisorOptions {
  const knownSourceKeys = options.knownSourceKeys ?? DEFAULT_SOURCE_KEYS;
  const knownSet = new Set(knownSourceKeys);
  if (knownSet.size !== knownSourceKeys.length) {
    throw new Error('knownSourceKeys must not contain duplicates');
  }
  const requiredSourceKeys = options.requiredSourceKeys ?? DEFAULT_REQUIRED_SOURCE_KEYS;
  for (const key of requiredSourceKeys) {
    if (!knownSet.has(key)) {
      throw new Error(`requiredSourceKeys entry "${key}" is not in the known source catalogue`);
    }
  }
  const criticalOverdueMs = options.criticalOverdueMs ?? DEFAULT_CRITICAL_OVERDUE_MS;
  const repeatedFailureThreshold =
    options.repeatedFailureThreshold ?? DEFAULT_REPEATED_FAILURE_THRESHOLD;
  const escalationWindowMs = options.escalationWindowMs ?? DEFAULT_ESCALATION_WINDOW_MS;
  assertPositiveInteger('criticalOverdueMs', criticalOverdueMs);
  assertPositiveInteger('repeatedFailureThreshold', repeatedFailureThreshold);
  assertPositiveInteger('escalationWindowMs', escalationWindowMs);
  return {
    knownSourceKeys: knownSet,
    requiredSourceKeys: new Set(requiredSourceKeys),
    criticalOverdueMs,
    repeatedFailureThreshold,
    escalationWindowMs,
    now: options.now ?? (() => new Date()),
  };
}
