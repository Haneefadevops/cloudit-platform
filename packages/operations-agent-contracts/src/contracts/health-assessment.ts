/**
 * HealthAssessment - the strict structured AI output validated server-side
 * before acceptance (operator-plan section 8.1).
 *
 * The AI provider is required to return exactly this shape. The server
 * validates the schema, every enum, summary length and control characters;
 * evidence-key membership against the sanitized evidence store and
 * runbook/issue compatibility are checked by the Phase C runtime, which
 * owns the catalogues. Invalid output is discarded and replaced by a
 * deterministic template.
 */

import {
  AUTOMATION_ELIGIBILITIES,
  AutomationEligibility,
  CONFIDENCE_LEVELS,
  Confidence,
  HEALTH_STATUSES,
  HealthStatus,
} from './enums';
import { ISSUE_CODE_FIELD, RUNBOOK_REFERENCE_FIELD } from './fields';
import {
  buildValidator,
  EVIDENCE_KEYS_FIELD,
  requiredEnum,
  SUMMARY_FIELD,
  ValidationResult,
} from './validation';

export interface HealthAssessment {
  /** Deterministic health verdict; never inferred GREEN from absence. */
  assessment: HealthStatus;
  /** Bounded internal summary (policy-sanitized upstream, max 1000 chars). */
  summary: string;
  /** Safe references into the sanitized evidence store; max 50 items. */
  evidenceKeys: string[];
  confidence: Confidence;
  /** Closed issue code (shape-validated; membership checked at runtime). */
  issueCode: string;
  /** Approved runbook key or 'none'. */
  recommendedRunbook: string;
  automationEligibility: AutomationEligibility;
}

export const HEALTH_ASSESSMENT_FIELDS = {
  assessment: requiredEnum(HEALTH_STATUSES),
  summary: SUMMARY_FIELD,
  evidenceKeys: EVIDENCE_KEYS_FIELD,
  confidence: requiredEnum(CONFIDENCE_LEVELS),
  issueCode: ISSUE_CODE_FIELD,
  recommendedRunbook: RUNBOOK_REFERENCE_FIELD,
  automationEligibility: requiredEnum(AUTOMATION_ELIGIBILITIES),
} as const;

export function validateHealthAssessment(input: unknown): ValidationResult<HealthAssessment> {
  return buildValidator<HealthAssessment>('HealthAssessment', HEALTH_ASSESSMENT_FIELDS)(input);
}
