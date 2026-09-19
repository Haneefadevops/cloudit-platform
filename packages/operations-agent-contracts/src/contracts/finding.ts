/**
 * Finding - a deterministic or AI-correlated observation about the
 * monitored environment. Findings never mutate state; they feed the
 * explanation layer and the remediation proposal pipeline.
 */

import { FINDING_STATES, FindingState, SEVERITIES, Severity } from './enums';
import { ENVIRONMENT_KEY_FIELD, ISSUE_CODE_FIELD, KEY_ID_FIELD } from './fields';
import {
  buildValidator,
  EVIDENCE_KEYS_FIELD,
  requiredEnum,
  requiredTimestamp,
  SUMMARY_FIELD,
  ValidationResult,
} from './validation';

export interface Finding {
  findingId: string;
  environmentKey: string;
  /** Closed issue code (shape-validated; membership checked at runtime). */
  issueCode: string;
  severity: Severity;
  state: FindingState;
  /** Bounded internal summary (policy-sanitized upstream, max 1000 chars). */
  summary: string;
  /** Safe evidence references; max 50 items. */
  evidenceKeys: string[];
  firstSeenAt: string;
  lastSeenAt: string;
}

export const FINDING_FIELDS = {
  findingId: KEY_ID_FIELD,
  environmentKey: ENVIRONMENT_KEY_FIELD,
  issueCode: ISSUE_CODE_FIELD,
  severity: requiredEnum(SEVERITIES),
  state: requiredEnum(FINDING_STATES),
  summary: SUMMARY_FIELD,
  evidenceKeys: EVIDENCE_KEYS_FIELD,
  firstSeenAt: requiredTimestamp(),
  lastSeenAt: requiredTimestamp(),
} as const;

export function validateFinding(input: unknown): ValidationResult<Finding> {
  return buildValidator<Finding>('Finding', FINDING_FIELDS)(input);
}
