/**
 * RepairRequest - the immutable request/attempt record linking a
 * remediation proposal to a fixed, versioned, allowlisted runbook.
 *
 * Authority tiers follow operator-plan section 7.1 (A automatic safe,
 * B owner-confirmed, C step-up - disabled until separately accepted,
 * D human-only/prohibited). The execution state tracks the attempt
 * lifecycle; proposals and attempts are append-only.
 */

import {
  AUTHORITY_TIERS,
  AuthorityTier,
  REPAIR_ATTEMPT_STATES,
  REPAIR_PROPOSAL_STATES,
  RepairAttemptState,
  RepairProposalState,
} from './enums';
import {
  ENVIRONMENT_KEY_FIELD,
  ISSUE_CODE_FIELD,
  KEY_ID_FIELD,
  RUNBOOK_KEY_FIELD,
  RUNBOOK_VERSION_FIELD,
} from './fields';
import {
  buildValidator,
  requiredEnum,
  requiredTimestamp,
  ValidationResult,
} from './validation';

export interface RepairRequest {
  repairRequestId: string;
  proposalId: string;
  environmentKey: string;
  issueCode: string;
  /** Concrete allowlisted runbook key; 'none' is not permitted here. */
  runbookKey: string;
  /** Immutable runbook version, semver-shaped (e.g. '1.0.0'). */
  runbookVersion: string;
  authorityTier: AuthorityTier;
  proposalState: RepairProposalState;
  attemptState: RepairAttemptState;
  /** Idempotency key; duplicate keys must never create a second attempt. */
  idempotencyKey: string;
  requestedAt: string;
}

export const REPAIR_REQUEST_FIELDS = {
  repairRequestId: KEY_ID_FIELD,
  proposalId: KEY_ID_FIELD,
  environmentKey: ENVIRONMENT_KEY_FIELD,
  issueCode: ISSUE_CODE_FIELD,
  runbookKey: RUNBOOK_KEY_FIELD,
  runbookVersion: RUNBOOK_VERSION_FIELD,
  authorityTier: requiredEnum(AUTHORITY_TIERS),
  proposalState: requiredEnum(REPAIR_PROPOSAL_STATES),
  attemptState: requiredEnum(REPAIR_ATTEMPT_STATES),
  idempotencyKey: KEY_ID_FIELD,
  requestedAt: requiredTimestamp(),
} as const;

export function validateRepairRequest(input: unknown): ValidationResult<RepairRequest> {
  return buildValidator<RepairRequest>('RepairRequest', REPAIR_REQUEST_FIELDS)(input);
}
