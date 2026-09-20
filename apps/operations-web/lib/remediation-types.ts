/**
 * Remediation proposal mirror types (coordinator-owned, server-only).
 *
 * Phase G is execute-nothing: these types describe PROPOSALS only — a fixed
 * issue-to-runbook mapping with preconditions, expected impact, verification
 * and rollback. No execution surface exists. The canonical validated contract
 * moves into @cloudit/operations-agent-contracts when the agent exposes the
 * read endpoint under a later gate; until then the portal view is fail-closed
 * and renders its unavailable state.
 */

export type RemediationProposalStatus =
  | "PROPOSED"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED";

export interface RemediationProposalView {
  proposalId: string;
  environmentKey: string;
  subjectKey: string;
  runbookKey: string;
  status: RemediationProposalStatus;
  createdAt: string;
  expiresAt: string;
  preconditions: readonly string[];
  expectedImpact: string;
  verification: readonly string[];
  rollback: readonly string[];
}

export interface RemediationProjection {
  generatedAt: string;
  environmentKey: string;
  proposals: readonly RemediationProposalView[];
}
