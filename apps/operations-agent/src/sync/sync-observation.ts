import type { DriftCode, DriftState } from '@cloudit/operations-agent-contracts';

/**
 * Sanitized sync output. These records are the only scan artifact: no
 * credential identifiers, no raw node parameters, no execution URLs, no
 * raw workflow JSON (operator plan section 5.3/14).
 */
export interface SyncObservation {
  /** Stable approved workflow key (unexpected live workflows use their live key). */
  workflowKey: string;
  /** MATCH, DRIFT or UNKNOWN_STALE. */
  state: DriftState;
  /** Closed drift codes in canonical catalogue order; empty on MATCH. */
  driftCodes: DriftCode[];
  /** When the underlying observation was taken (ISO-8601, snapshot time). */
  observedAt: string;
  /** Deterministic scan identifier, derived from the injected clock. */
  scanId: string;
}

/** Result of one complete scan cycle. */
export interface SyncScanResult {
  scanId: string;
  startedAt: string;
  completedAt: string;
  observations: SyncObservation[];
}

/** Per-scan options. All scan timing flows through `now` or the injected clock. */
export interface SyncScanOptions {
  /**
   * Injectable clock value for this scan (ISO string or epoch ms).
   * Defaults to the clock injected at construction.
   */
  now?: string | number | Date;
  /** Maximum trusted observation age in ms (default 15 minutes). */
  maxObservationAgeMs?: number;
  /** Explicit scan id (default `sync-<epochMs of now>`). */
  scanId?: string;
  /** Safe environment key for the audit event (default 'cavetta-synthetic'). */
  environmentKey?: string;
}
