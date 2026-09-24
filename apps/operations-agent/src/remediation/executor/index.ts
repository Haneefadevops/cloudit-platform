/**
 * Tier A remediation executor module — public API (Worker B, Phase H).
 * Exported shapes are contractual: the coordinator wires them in
 * app.module.ts and Worker C writes evals against them blind.
 */
export {
  REMEDIATION_EXECUTION_OUTCOMES,
  RemediationExecutionOutcome,
  RemediationExecutionRequest,
  RemediationExecutionResult,
  RemediationExecutor,
  REMEDIATION_EXECUTOR,
} from './executor-contract';
export {
  READONLY_RECHECK_RUNBOOK_KEY,
  READONLY_RECHECK_RUNBOOK_VERSION,
  READONLY_RECHECK_RUNBOOK_TIER,
  READONLY_RECHECK_ACCEPTED_ISSUE_CODES,
  ReadonlyRecheckIssueCode,
  READONLY_RECHECK_ALLOWED_TARGETS,
  ReadonlyRecheckTargetKey,
  READONLY_RECHECK_EXPECTED_RESULT_CODES,
  ReadonlyRecheckResultCode,
  READONLY_RECHECK_MAX_AUTOMATIC_ATTEMPTS,
  READONLY_RECHECK_TIMEOUT_MS,
  READONLY_RECHECK_PRECONDITIONS,
  READONLY_RECHECK_EXPECTED_IMPACT,
  READONLY_RECHECK_VERIFICATION,
  READONLY_RECHECK_ROLLBACK,
  READONLY_RECHECK_SUMMARY_MAX_CHARS,
  READONLY_RECHECK_RUNBOOK,
  buildReadonlyRecheckSummary,
  buildReadonlyRecheckGateSummary,
} from './readonly-recheck-runbook';
export {
  TierARemediationExecutor,
  TierARemediationExecutorOptions,
  RemediationCircuit,
} from './tier-a-executor';
export {
  RemediationAttemptAuditEvent,
  REMEDIATION_ATTEMPT_AUDIT_SUMMARY_MAX_CHARS,
  buildAttemptAuditEvent,
} from './attempt-audit';
