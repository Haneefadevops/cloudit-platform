/**
 * Recommendation - a bounded proposal to act on a finding by selecting an
 * already-approved runbook. The AI may recommend; it may never approve,
 * and the deterministic policy engine always overrides AI wording.
 */

import {
  AUTOMATION_ELIGIBILITIES,
  AutomationEligibility,
  SEVERITIES,
  Severity,
} from './enums';
import { ENVIRONMENT_KEY_FIELD, KEY_ID_FIELD, RUNBOOK_REFERENCE_FIELD } from './fields';
import {
  buildValidator,
  EVIDENCE_KEYS_FIELD,
  requiredEnum,
  requiredTimestamp,
  SUMMARY_FIELD,
  ValidationResult,
} from './validation';

export interface Recommendation {
  recommendationId: string;
  findingId: string;
  environmentKey: string;
  /** Approved runbook key or 'none'. */
  recommendedRunbook: string;
  automationEligibility: AutomationEligibility;
  severity: Severity;
  /** Bounded internal summary (policy-sanitized upstream, max 1000 chars). */
  summary: string;
  /** Safe evidence references; max 50 items. */
  evidenceKeys: string[];
  createdAt: string;
}

export const RECOMMENDATION_FIELDS = {
  recommendationId: KEY_ID_FIELD,
  findingId: KEY_ID_FIELD,
  environmentKey: ENVIRONMENT_KEY_FIELD,
  recommendedRunbook: RUNBOOK_REFERENCE_FIELD,
  automationEligibility: requiredEnum(AUTOMATION_ELIGIBILITIES),
  severity: requiredEnum(SEVERITIES),
  summary: SUMMARY_FIELD,
  evidenceKeys: EVIDENCE_KEYS_FIELD,
  createdAt: requiredTimestamp(),
} as const;

export function validateRecommendation(input: unknown): ValidationResult<Recommendation> {
  return buildValidator<Recommendation>('Recommendation', RECOMMENDATION_FIELDS)(input);
}
