import { HealthAssessment } from '@cloudit/operations-agent-contracts';

export const DETERMINISTIC_RED: HealthAssessment = {
  assessment: 'RED',
  summary: 'Deterministic scan found a stale workflow snapshot.',
  evidenceKeys: ['ev:workflow:backup-stale', 'ev:portal:stale'],
  confidence: 'MEDIUM',
  issueCode: 'WF_STALE_SNAPSHOT',
  recommendedRunbook: 'none',
  automationEligibility: 'OWNER_REQUIRED',
};

export const EVIDENCE_HASH = 'sha256:synthetic-evidence-hash';

export function aiExplanation(overrides: Partial<HealthAssessment> = {}): HealthAssessment {
  return {
    assessment: 'RED',
    summary: 'Both evidence keys confirm the stale snapshot.',
    evidenceKeys: ['ev:workflow:backup-stale'],
    confidence: 'HIGH',
    issueCode: 'WF_STALE_SNAPSHOT',
    recommendedRunbook: 'none',
    automationEligibility: 'OWNER_REQUIRED',
    ...overrides,
  };
}

/** Fixed UTC instant: 2026-09-28T12:00:00Z. */
export const FIXED_NOW_MS = Date.UTC(2026, 8, 28, 12, 0, 0);
export const FIXED_NOW = () => FIXED_NOW_MS;
export const MS_PER_DAY = 86_400_000;
