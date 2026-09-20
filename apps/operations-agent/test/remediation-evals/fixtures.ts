/**
 * Shared synthetic fixtures for the Phase G adversarial remediation-proposal
 * evaluation suite (Worker C). Everything here is obviously fake: synthetic
 * runbook keys, synthetic environment keys, synthetic issue codes and the
 * secret-canary values that mirror the contract fixtures in
 * `@cloudit/operations-agent-contracts`.
 *
 * This file is intentionally free of imports from the Phase G worker modules
 * (`src/remediation`) so it can be smoke-checked standalone while those
 * modules are being built in parallel. The option/builder shapes below
 * mirror the integration contract for `RemediationEngine` exactly;
 * TypeScript reconciles them structurally at integration time.
 *
 * The engine API is SYNCHRONOUS — every fake and assertion here is too.
 */

import type { HealthAssessment } from '@cloudit/operations-agent-contracts';

// --- synthetic environment / subject keys ---

export const ENV_A = 'env_synthetic_alpha';
export const ENV_B = 'env_synthetic_beta';

export const ISSUE_EVIDENCE_STALE = 'EVIDENCE_STALE';
export const ISSUE_ALERT_DELIVERY = 'ALERT_DELIVERY_FAILURE';
export const ISSUE_UNKNOWN = 'NO_SUCH_SYNTHETIC_ISSUE';

export const RB_RECHECK_KEY = 'RB-SYNTHETIC-RECHECK-001';
export const RB_ALERT_RETRY_KEY = 'RB-SYNTHETIC-ALERT-RETRY-001';

export const DEFAULT_TTL_MS = 15 * 60 * 1000;

/** Fixed synthetic instant: 2026-10-12T09:00:00.000Z. */
export const T0 = Date.UTC(2026, 9, 12, 9, 0, 0, 0);

// --- contract shape mirrors (structurally identical to src/remediation) ---

export type ProposalActionShape =
  | 'PROPOSED'
  | 'REPLAY_IGNORED'
  | 'EXPIRED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CIRCUIT_OPEN';

export interface RemediationRunbookShape {
  runbookKey: string;
  tier: 'A';
  issueCode: string;
  summary: string;
  preconditions: readonly string[];
  expectedImpact: string;
  verification: readonly string[];
  rollback: readonly string[];
  ttlMs: number;
}

export interface RemediationProposalShape {
  proposalId: string;
  environmentKey: string;
  subjectKey: string;
  runbookKey: string;
  status: 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  createdAt: string;
  expiresAt: string;
  preconditions: readonly string[];
  expectedImpact: string;
  verification: readonly string[];
  rollback: readonly string[];
}

export interface ProposalDecisionShape {
  action: ProposalActionShape;
  proposal?: RemediationProposalShape;
}

// --- runbook builders ---

/** Build a synthetic Tier A runbook; every value is obviously fake. */
export function makeRunbook(
  overrides: Partial<RemediationRunbookShape> = {},
): RemediationRunbookShape {
  return {
    runbookKey: RB_RECHECK_KEY,
    tier: 'A',
    issueCode: ISSUE_EVIDENCE_STALE,
    summary: 'synthetic read-only recheck runbook',
    preconditions: ['evidence fresh', 'read-only scope confirmed'],
    expectedImpact: 'no external side effect',
    verification: ['recheck result matches expectation'],
    rollback: ['nothing to roll back'],
    ttlMs: DEFAULT_TTL_MS,
    ...overrides,
  };
}

/** Default synthetic registry: two Tier A runbooks (mirrors the plan allowlist shape). */
export const DEFAULT_REGISTRY: readonly RemediationRunbookShape[] = [
  makeRunbook(),
  makeRunbook({
    runbookKey: RB_ALERT_RETRY_KEY,
    issueCode: ISSUE_ALERT_DELIVERY,
    summary: 'synthetic internal alert retry runbook',
    preconditions: ['alert channel healthy', 'dedup window open'],
    expectedImpact: 'at most one additional internal alert',
    verification: ['delivery receipt observed'],
    rollback: ['suppress further retries for the subject'],
  }),
];

/** Deep-freeze a value so any engine-side mutation throws in strict mode. */
export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}

// --- audit / clock stubs ---

/** Audit sink that records every event verbatim for structural assertions. */
export class RecordingAuditSink {
  readonly events: unknown[] = [];

  record(event: unknown): unknown {
    this.events.push(event);
    return event;
  }
}

/** Audit sink that throws on every record (must never propagate). */
export class ThrowingAuditSink {
  readonly attempts: unknown[] = [];

  record(event: unknown): unknown {
    this.attempts.push(event);
    throw new Error('synthetic audit sink outage');
  }
}

/** Deterministic injected clock so proposal TTL and breaker cooldown are exact. */
export class ManualClock {
  constructor(public current: number) {}

  now = (): number => this.current;

  set(current: number): void {
    this.current = current;
  }

  advance(ms: number): void {
    this.current += ms;
  }
}

// --- engine option builder (mirrors the integration contract) ---

export interface RemediationEngineOptionsShape {
  registry?: readonly RemediationRunbookShape[];
  audit?: { record(event: unknown): unknown };
  maxFailures?: number;
  cooldownMs?: number;
  now?: () => number;
}

export interface BuildEngineOptionsOverrides {
  registry?: readonly RemediationRunbookShape[];
  audit?: { record(event: unknown): unknown };
  maxFailures?: number;
  cooldownMs?: number;
  now?: () => number;
}

export function buildEngineOptions(
  overrides: BuildEngineOptionsOverrides = {},
): RemediationEngineOptionsShape {
  // Blind-integration rule: the engine's built-in default registry contents
  // are implementation-owned and unknowable from outside, so every eval that
  // asserts specific issueCodes injects the synthetic registry explicitly
  // (this default) instead of relying on the built-in one.
  const options: RemediationEngineOptionsShape = {
    registry: overrides.registry ?? DEFAULT_REGISTRY,
    ...(overrides.audit !== undefined ? { audit: overrides.audit } : {}),
    ...(overrides.maxFailures !== undefined ? { maxFailures: overrides.maxFailures } : {}),
    ...(overrides.cooldownMs !== undefined ? { cooldownMs: overrides.cooldownMs } : {}),
    ...(overrides.now !== undefined ? { now: overrides.now } : {}),
  };
  return options;
}

// --- structural helpers ---

/** Recursively collect every string value carried by an unknown event/object. */
export function collectStrings(value: unknown, into: string[] = []): string[] {
  if (typeof value === 'string') {
    into.push(value);
    return into;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, into);
    return into;
  }
  if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) collectStrings(item, into);
  }
  return into;
}

/**
 * Recursively find the value of the first matching property in an unknown
 * audit event (exact event shape is reconciled at integration).
 */
export function findProperty(value: unknown, key: string): unknown {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findProperty(item, key);
      if (found !== undefined) return found;
    }
  } else if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    if (key in record) return record[key];
    for (const item of Object.values(record)) {
      const found = findProperty(item, key);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** Minimal valid deterministic assessment (only needed where a verdict is referenced). */
export function makeVerdict(overrides: Partial<HealthAssessment> = {}): HealthAssessment {
  return {
    assessment: 'AMBER',
    summary: 'synthetic deterministic assessment',
    evidenceKeys: ['ev.synthetic.1'],
    confidence: 'MEDIUM',
    issueCode: ISSUE_EVIDENCE_STALE,
    recommendedRunbook: 'none',
    automationEligibility: 'OWNER_REQUIRED',
    ...overrides,
  };
}
