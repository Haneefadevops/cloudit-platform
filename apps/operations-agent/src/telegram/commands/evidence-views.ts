/**
 * Read-only evidence views the Telegram commands may render.
 *
 * Every value here is synthetic-safe by contract: the port owner (the
 * coordinator, binding adapters at integration) guarantees these views contain
 * status, counts, timestamps, evidence/audit keys and bounded summaries only
 * — never credentials, raw errors, customer payloads or PII. The command
 * service still runs the final assembled text through `sanitizeSafeText` as
 * defense in depth.
 */

/** Overall deterministic verdict plus source and incident counts. */
export interface StatusSnapshotView {
  overall: string;
  sourcesTotal: number;
  sourcesRed: number;
  sourcesAmber: number;
  openIncidents: number;
  generatedAt: string;
}

/** One open incident, identifiers and severity only — no summary bodies. */
export interface SafeIncidentView {
  incidentKey: string;
  severity: string;
  serviceKey: string;
  state: string;
  startedAt: string;
}

/** Workflow-portal sync observation summary. */
export interface SyncSummaryView {
  state: string;
  driftCount: number;
  staleCount: number;
  scannedAt: string;
}

/** Budget usage for AI calls and monthly spend. */
export interface BudgetSummaryView {
  dayCallsUsed: number;
  dayCallsMax: number;
  monthEurUsed: string;
  monthEurCeiling: number;
}

/** One sanitized finding for `/explain`, safe title and bounded summary only. */
export interface SafeFindingView {
  findingKey: string;
  severity: string;
  safeTitle: string;
  safeSummary: string;
  recommendedRunbook: string;
}

/**
 * Port the command service reads from. Purely synchronous and read-only:
 * no network, no mutation, no AI calls.
 */
export interface ReadOnlyEvidencePort {
  getStatus(): StatusSnapshotView;
  listIncidents(): SafeIncidentView[];
  getSyncSummary(): SyncSummaryView;
  getBudgetSummary(): BudgetSummaryView;
  getFinding(findingKey: string): SafeFindingView | undefined;
}
