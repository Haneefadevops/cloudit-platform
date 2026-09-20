import { HealthAssessment } from '@cloudit/operations-agent-contracts';

/**
 * Pure deterministic fallback builder (operator-plan sections 8.1 and 12).
 *
 * When the AI path is unavailable, over budget, invalid or contradicts the
 * deterministic verdict, the supervisor's verdict is retained unchanged
 * (assessment/evidenceKeys/issueCode) and only the AI-owned fields collapse
 * to a fixed safe template. The summary is a FIXED template string with no
 * model output; confidence is LOW, the runbook recommendation is 'none' and
 * automation always requires the owner. Deterministic status is always
 * authoritative over model wording.
 */
export function buildDeterministicFallback(deterministic: HealthAssessment): HealthAssessment {
  return {
    assessment: deterministic.assessment,
    summary: `Deterministic assessment retained. findings=${deterministic.evidenceKeys.length}`,
    evidenceKeys: [...deterministic.evidenceKeys],
    confidence: 'LOW',
    issueCode: deterministic.issueCode,
    recommendedRunbook: 'none',
    automationEligibility: 'OWNER_REQUIRED',
  };
}
