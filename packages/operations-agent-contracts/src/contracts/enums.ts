/**
 * Closed enums for the CloudIT AI Maintenance contracts.
 *
 * Each enum is a TypeScript union type backed by a runtime const array.
 * The arrays are the single source of truth for membership: validators
 * reject any value not present in the array (fail closed), and the
 * acceptance tests assert the arrays contain exactly the spec'd members.
 *
 * Spec sources:
 * - operator-plan section 8.1 (assessment, confidence, automationEligibility)
 * - operator-plan section 14 (GREEN, AMBER, RED, NO_DATA, UNKNOWN)
 * - KIMI-AI-MAINTENANCE-EXECUTION-PLAN Phase B (severity, confidence,
 *   approval and execution-state enums)
 */

export const HEALTH_STATUSES = ['GREEN', 'AMBER', 'RED', 'NO_DATA', 'UNKNOWN'] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];

export const SEVERITIES = ['none', 'info', 'warning', 'critical'] as const;
export type Severity = (typeof SEVERITIES)[number];

export const CONFIDENCE_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const FINDING_STATES = ['open', 'acknowledged', 'resolved', 'dismissed'] as const;
export type FindingState = (typeof FINDING_STATES)[number];

export const REPAIR_PROPOSAL_STATES = [
  'proposed',
  'approved',
  'expired',
  'rejected',
] as const;
export type RepairProposalState = (typeof REPAIR_PROPOSAL_STATES)[number];

export const REPAIR_ATTEMPT_STATES = [
  'pending',
  'running',
  'succeeded',
  'failed',
  'rolled_back',
] as const;
export type RepairAttemptState = (typeof REPAIR_ATTEMPT_STATES)[number];

export const AUTOMATION_ELIGIBILITIES = [
  'AUTO_SAFE',
  'OWNER_REQUIRED',
  'PROHIBITED',
] as const;
export type AutomationEligibility = (typeof AUTOMATION_ELIGIBILITIES)[number];

export const AUTHORITY_TIERS = ['A', 'B', 'C', 'D'] as const;
export type AuthorityTier = (typeof AUTHORITY_TIERS)[number];

export function isMember<T extends string>(
  value: unknown,
  members: readonly T[],
): value is T {
  return typeof value === 'string' && (members as readonly string[]).includes(value);
}
