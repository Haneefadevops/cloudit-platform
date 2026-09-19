import type { ManifestEntry, TriggerKind } from '@cloudit/operations-agent-contracts';

/**
 * Read-only ports for the workflow-portal sync auditor (operator plan
 * section 5.1). Every source is observation-only: no method mutates n8n,
 * the portal, or any external system. Coordinator binds these to real
 * adapters at integration; tests bind the in-memory mocks under
 * `test/sync/mocks`.
 */

/** Git-approved desired-state manifest (operator plan section 5.2). */
export interface ManifestSource {
  /** All in-scope approved manifest entries. */
  listEntries(): Promise<ManifestEntry[]> | ManifestEntry[];
}

/**
 * One live workflow record as observed read-only from n8n. `rawWorkflow`
 * is the sanitized live export used only to compute the canonical semantic
 * hash in memory; it is discarded after comparison and never emitted.
 */
export interface LiveN8nWorkflowRecord {
  workflowKey: string;
  /** false when the workflow no longer exists on the instance. */
  found?: boolean;
  /** Observed active flag. */
  active?: boolean;
  /** Observed trigger. */
  trigger?: { kind?: TriggerKind; cron?: string } | null;
  /** Observed workflow timezone. */
  timezone?: string | null;
  /** Observed attached error workflow (identity checked by the comparator). */
  errorWorkflow?: { id?: string | null; name?: string | null } | null;
  /** Pre-computed canonical semantic hash (alternative to rawWorkflow). */
  canonicalHash?: string | null;
  /** Sanitized raw export; hashed in memory then discarded. */
  rawWorkflow?: unknown;
  /** Observed published revision identifier. */
  revisionId?: string | null;
  /** When the workflow last produced an execution (ISO string or ms). */
  lastExecutionAt?: string | number | Date | null;
}

/**
 * Snapshot returned by one observer pass. Runs outside n8n so an n8n
 * outage remains observable: `observerAvailable` is false and no workflow
 * data is trusted beyond the fact the observer could not reach n8n
 * (operator plan section 12).
 */
export interface LiveN8nSnapshot {
  /** false when the observer could not reach n8n at all. */
  observerAvailable: boolean;
  /** When the snapshot was taken (ISO string or epoch ms). */
  observedAt: string | number | Date;
  /** Observed live workflows. Empty when the observer is unavailable. */
  workflows: LiveN8nWorkflowRecord[];
}

/** Read-only live n8n metadata source (fixed GET paths only, per plan 5.3). */
export interface LiveN8nObservationSource {
  observe(): Promise<LiveN8nSnapshot> | LiveN8nSnapshot;
}

/** Operations Portal workflow catalogue, read-only. */
export interface PortalCatalogueSource {
  /** Keys currently listed in the approved portal catalogue. */
  listListedKeys(): Promise<ReadonlySet<string>> | ReadonlySet<string>;
}
