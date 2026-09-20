/**
 * Shared synthetic fixtures for the Phase F adversarial alert-engine
 * evaluation suite (Worker C). Everything here is obviously fake: synthetic
 * environment keys, synthetic subject (issue-code) keys, synthetic hashes
 * and the secret-canary values that mirror the contract fixtures in
 * `@cloudit/operations-agent-contracts`.
 *
 * This file is intentionally free of imports from the Phase F worker modules
 * (`src/alerts`) so it can be smoke-checked standalone while those modules
 * are being built in parallel. The option/builder shapes below mirror the
 * integration contract for `AlertEngine` exactly; TypeScript reconciles them
 * structurally at integration time.
 */

import type { HealthAssessment, HealthStatus } from '@cloudit/operations-agent-contracts';

// --- synthetic environment / subject keys ---

export const ENV_KEY = 'env_synthetic_main';
export const OTHER_ENV_KEY = 'env_synthetic_other';

export const SUBJECT_NO_ISSUE = 'NO_ISSUE';
export const SUBJECT_BACKUP_STALE = 'BACKUP_STALE';
export const SUBJECT_SYNC_DRIFT = 'SYNC_DRIFT';

export const DEFAULT_MAX_ALERTS_PER_HOUR = 3;
export const DEFAULT_OUTAGE_RETRY_MAX_ATTEMPTS = 2;

/** Fixed synthetic instant: 2026-10-05T12:00:00.000Z. */
export const T0 = Date.UTC(2026, 9, 5, 12, 0, 0, 0);

// --- contract shape mirrors (structurally identical to src/alerts) ---

export interface AlertMessageShape {
  kind: 'red_alert' | 'recovery' | 'digest';
  environmentKey: string;
  subjectKey: string;
  text: string;
  occurredAt: string;
}

export interface DigestEntryShape {
  subjectKey: string;
  category: 'RED' | 'AMBER' | 'GREEN' | 'NO_DATA' | 'UNKNOWN';
  summary: string;
  lastOccurredAt: string;
}

export type AlertActionShape =
  | 'SENT'
  | 'SUPPRESSED_DUPLICATE'
  | 'SUPPRESSED_RATE_LIMITED'
  | 'SUPPRESSED_OUTAGE_BOUND'
  | 'QUEUED_OUTAGE'
  | 'SKIPPED_NOT_RED'
  | 'BLOCKED_KILL_SWITCH';

export interface AlertDecisionShape {
  action: AlertActionShape;
  message?: AlertMessageShape;
}

// --- verdict builder ---

/**
 * Build a valid deterministic {@link HealthAssessment}; override individual
 * fields to plant adversarial content (canaries, raw markers) in specific
 * channels.
 */
export function makeVerdict(
  verdict: HealthStatus,
  overrides: Partial<HealthAssessment> = {},
): HealthAssessment {
  return {
    assessment: verdict,
    summary: 'synthetic deterministic assessment',
    evidenceKeys: ['ev.synthetic.1'],
    confidence: 'MEDIUM',
    issueCode: SUBJECT_NO_ISSUE,
    recommendedRunbook: 'none',
    automationEligibility: 'AUTO_SAFE',
    ...overrides,
  };
}

/** Deep-freeze a value so any engine-side mutation throws in strict mode. */
export function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}

// --- sender fakes ---

/** Sender stub that records every message it is asked to send. */
export class RecordingSender {
  readonly sent: AlertMessageShape[] = [];

  async send(message: AlertMessageShape): Promise<void> {
    this.sent.push({ ...message });
  }
}

/** Sender stub that rejects every send with a fixed synthetic error. */
export class ThrowingSender {
  readonly attempted: AlertMessageShape[] = [];

  constructor(private readonly error: Error) {}

  async send(message: AlertMessageShape): Promise<void> {
    this.attempted.push({ ...message });
    throw this.error;
  }
}

// --- gate / outbox / audit stubs ---

/** Kill-switch gate stub; assertEnabled() throws only when configured to. */
export class StubGate {
  constructor(private disabledError?: Error) {}

  assertEnabled(): void {
    if (this.disabledError) throw this.disabledError;
  }

  /** Re-open the switch (synthetic control for eval flows). */
  enable(): void {
    this.disabledError = undefined;
  }
}

/** Outbox stub that records every appended entry verbatim. */
export class RecordingOutbox {
  readonly entries: Array<{ entryId: string; type: string; payload: unknown }> = [];

  append(entry: { entryId: string; type: string; payload: unknown }): unknown {
    this.entries.push(entry);
    return entry;
  }
}

/** Audit sink that records every event verbatim for structural assertions. */
export class RecordingAuditSink {
  readonly events: unknown[] = [];

  record(event: unknown): unknown {
    this.events.push(event);
    return event;
  }
}

/** Deterministic injected clock so rate-limit windows are exact. */
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

export interface AlertEngineOptionsShape {
  gate: { assertEnabled(): void };
  sender: { send(message: AlertMessageShape): Promise<void> };
  outbox?: { append(entry: { entryId: string; type: string; payload: unknown }): unknown };
  audit?: { record(event: unknown): unknown };
  maxAlertsPerHour: number;
  outageRetryMaxAttempts: number;
  now?: () => number;
}

export interface BuildEngineOptionsOverrides {
  gate?: StubGate;
  sender?: { send(message: AlertMessageShape): Promise<void> };
  outbox?: RecordingOutbox;
  audit?: RecordingAuditSink;
  maxAlertsPerHour?: number;
  outageRetryMaxAttempts?: number;
  now?: () => number;
}

export function buildEngineOptions(
  overrides: BuildEngineOptionsOverrides = {},
): AlertEngineOptionsShape {
  const options: AlertEngineOptionsShape = {
    gate: overrides.gate ?? new StubGate(),
    sender: overrides.sender ?? new RecordingSender(),
    maxAlertsPerHour: overrides.maxAlertsPerHour ?? DEFAULT_MAX_ALERTS_PER_HOUR,
    outageRetryMaxAttempts:
      overrides.outageRetryMaxAttempts ?? DEFAULT_OUTAGE_RETRY_MAX_ATTEMPTS,
    ...(overrides.outbox !== undefined ? { outbox: overrides.outbox } : {}),
    ...(overrides.audit !== undefined ? { audit: overrides.audit } : {}),
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
 * Recursively find the value of the first `reasonCode` property in an
 * unknown audit event (the event's exact shape is reconciled at integration).
 */
export function findReasonCode(value: unknown): unknown {
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    if ('reasonCode' in record) return record.reasonCode;
    for (const item of Object.values(record)) {
      const found = findReasonCode(item);
      if (found !== undefined) return found;
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findReasonCode(item);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

/** Build a digest entry with synthetic safe values. */
export function makeDigestEntry(
  overrides: Partial<DigestEntryShape> = {},
): DigestEntryShape {
  return {
    subjectKey: SUBJECT_BACKUP_STALE,
    category: 'AMBER',
    summary: 'synthetic digest entry summary',
    lastOccurredAt: new Date(T0).toISOString(),
    ...overrides,
  };
}
