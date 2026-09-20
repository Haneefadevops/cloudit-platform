import { HealthAssessment, detectCanaryLeak } from '@cloudit/operations-agent-contracts';

/**
 * Pure deterministic fallback builder (operator-plan sections 8.1 and 12).
 *
 * When the AI path is unavailable, over budget, invalid or contradicts the
 * deterministic verdict, the supervisor's verdict is retained unchanged,
 * including the supervisor-written summary (the summary in a deterministic
 * HealthAssessment is supervisor-owned, not model-owned). The only exception
 * is a secret-canary hit on the deterministic text: defense in depth replaces
 * the summary with a fixed safe template in that case so no secret-shaped
 * content can leave the adapter even if upstream sanitisation was bypassed.
 * Confidence collapses to LOW, the runbook recommendation is 'none' and
 * automation always requires the owner. Deterministic status is always
 * authoritative over model wording.
 */
export function buildDeterministicFallback(deterministic: HealthAssessment): HealthAssessment {
  const leaked = detectCanaryLeak(
    JSON.stringify({ summary: deterministic.summary, evidenceKeys: deterministic.evidenceKeys }),
  ).leaked;
  return {
    assessment: deterministic.assessment,
    summary: leaked
      ? `Deterministic assessment retained. findings=${deterministic.evidenceKeys.length}`
      : deterministic.summary,
    evidenceKeys: [...deterministic.evidenceKeys],
    confidence: 'LOW',
    issueCode: deterministic.issueCode,
    recommendedRunbook: 'none',
    automationEligibility: 'OWNER_REQUIRED',
  };
}
