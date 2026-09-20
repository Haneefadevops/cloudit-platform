// Simulated remediation engine — public API (Worker A, Phase G).
// Exported shapes are contractual: Worker C writes evals against them blind.
export {
  ProposalAction,
  ProposalStatus,
  RemediationProposal,
  ProposalDecision,
  RemediationEngineOptions,
  RemediationEngine,
} from './remediation-engine';
export {
  RemediationRunbook,
  DEFAULT_TIER_A_RUNBOOKS,
} from './runbooks';
export {
  RemediationProposalAuditEvent,
  RemediationAuditResultCode,
  REMEDIATION_AUDIT_SUMMARY_MAX_CHARS,
  buildRemediationAuditEvent,
  resultCodeOf,
} from './proposal-audit';
