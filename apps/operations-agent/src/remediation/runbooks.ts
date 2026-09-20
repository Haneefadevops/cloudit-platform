/**
 * Tier-A remediation runbook registry (Phase G, simulation only).
 *
 * Fixed, synthetic, canary-free text. The engine proposes from this mapping
 * and executes NOTHING: preconditions, expected impact, verification and
 * rollback are displayed verbatim from the registry. `environmentKey` and
 * `issueCode` appear only in `proposalId`/`subjectKey` fields — never
 * interpolated into runbook text.
 */

export interface RemediationRunbook {
  runbookKey: string;
  tier: 'A';
  issueCode: string;
  summary: string;
  preconditions: readonly string[];
  expectedImpact: string;
  verification: readonly string[];
  rollback: readonly string[];
  /** Proposal time-to-live in milliseconds. */
  ttlMs: number;
}

const HOUR_MS = 3_600_000;

export const DEFAULT_TIER_A_RUNBOOKS: readonly RemediationRunbook[] = Object.freeze([
  Object.freeze({
    runbookKey: 'rb-wf-stale-snapshot',
    tier: 'A' as const,
    issueCode: 'WF_STALE_SNAPSHOT',
    summary: 'Review the stale workflow snapshot and re-run the read-only collector check.',
    preconditions: Object.freeze([
      'Workflow-portal drift detector reports a stale snapshot.',
      'Kill switch repairMasterEnabled and autoRemediationEnabled are both on.',
    ]),
    expectedImpact: 'Snapshot freshness is re-verified; no workflow or portal state is changed.',
    verification: Object.freeze([
      'Re-run the deterministic freshness check and confirm a current snapshot.',
      'Confirm zero n8n workflow activations or publications occurred.',
    ]),
    rollback: Object.freeze([
      'No mutation was performed; rollback is a no-op.',
      'If verification fails, keep the finding open and alert the owner.',
    ]),
    ttlMs: 24 * HOUR_MS,
  }),
  Object.freeze({
    runbookKey: 'rb-wf-drift-mismatch',
    tier: 'A' as const,
    issueCode: 'WF_DRIFT_MISMATCH',
    summary: 'Investigate manifest versus live n8n drift without converging automatically.',
    preconditions: Object.freeze([
      'Sync auditor reports a manifest/live mismatch.',
      'The mismatch is classified read-only (no activation state difference).',
    ]),
    expectedImpact: 'Owner reviews the drift report; runtime state remains untouched.',
    verification: Object.freeze([
      'Confirm the drift report matches the Git-approved manifest intent.',
      'Confirm no n8n mutation endpoints were called.',
    ]),
    rollback: Object.freeze([
      'No mutation was performed; rollback is a no-op.',
      'Escalate to the owner if drift persists past one review cycle.',
    ]),
    ttlMs: 12 * HOUR_MS,
  }),
  Object.freeze({
    runbookKey: 'rb-ingestion-gap',
    tier: 'A' as const,
    issueCode: 'INGESTION_GAP',
    summary: 'Review an evidence ingestion gap flagged by the deterministic supervisor.',
    preconditions: Object.freeze([
      'Supervisor reports missing evidence for a canonical source key.',
      'No provider or n8n credential rotation is in progress.',
    ]),
    expectedImpact: 'The gap is triaged for the next scheduled collection cycle.',
    verification: Object.freeze([
      'Confirm evidence reappears at the next scheduled collection.',
      'Confirm the audit log contains only safe reason codes.',
    ]),
    rollback: Object.freeze([
      'No mutation was performed; rollback is a no-op.',
      'If the gap repeats, raise a deterministic RED alert.',
    ]),
    ttlMs: 6 * HOUR_MS,
  }),
  Object.freeze({
    runbookKey: 'rb-portal-projection-stale',
    tier: 'A' as const,
    issueCode: 'PORTAL_PROJECTION_STALE',
    summary: 'Review a stale portal projection entry reported by the sync auditor.',
    preconditions: Object.freeze([
      'Portal catalogue entry is older than its freshness window.',
      'The underlying workflow evidence is itself fresh.',
    ]),
    expectedImpact: 'Presentation staleness is flagged for the portal owner.',
    verification: Object.freeze([
      'Confirm the portal entry refreshes on the next sync observation.',
      'Confirm no direct database writes occurred.',
    ]),
    rollback: Object.freeze([
      'No mutation was performed; rollback is a no-op.',
    ]),
    ttlMs: 6 * HOUR_MS,
  }),
]);
