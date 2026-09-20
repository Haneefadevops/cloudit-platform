import { HealthAssessment } from '@cloudit/operations-agent-contracts';
import { AlertEngine, AlertMessage, AlertEngineOptions } from '../../src/alerts';

export const ENV = 'env-test';
export const FIXED_NOW_MS = Date.UTC(2026, 9, 5, 12, 0, 0);
export const MS_PER_HOUR = 3_600_000;

export function verdict(overrides: Partial<HealthAssessment> = {}): HealthAssessment {
  return {
    assessment: 'RED',
    summary: 'Deterministic scan found a stale workflow snapshot.',
    evidenceKeys: ['ev:one', 'ev:two'],
    confidence: 'HIGH',
    issueCode: 'WF_STALE',
    recommendedRunbook: 'none',
    automationEligibility: 'OWNER_REQUIRED',
    ...overrides,
  };
}

export class RecordingSender {
  readonly sent: AlertMessage[] = [];
  constructor(private readonly fail = false) {}
  async send(message: AlertMessage): Promise<void> {
    if (this.fail) throw new Error('telegram transport unavailable');
    this.sent.push(message);
  }
}

export class RecordingOutbox {
  readonly entries: Array<{ entryId: string; type: string; payload: unknown }> = [];
  constructor(private readonly fail = false) {}
  append(entry: { entryId: string; type: string; payload: unknown }): unknown {
    if (this.fail) throw new Error('outbox unavailable');
    this.entries.push(entry);
    return entry.entryId;
  }
}

export class StubGate {
  constructor(private readonly enabled = true) {}
  assertEnabled(): void {
    if (!this.enabled) throw new Error('capability "telegram" is disabled by kill switch');
  }
}

export interface EngineHarness {
  engine: AlertEngine;
  sender: RecordingSender;
  outbox: RecordingOutbox;
  auditEvents: unknown[];
  clock: { now: () => number; set: (ms: number) => void; advance: (ms: number) => void };
}

export function makeEngine(overrides: Partial<AlertEngineOptions> = {}): EngineHarness {
  let current = FIXED_NOW_MS;
  const clock = {
    now: () => current,
    set: (ms: number) => {
      current = ms;
    },
    advance: (ms: number) => {
      current += ms;
    },
  };
  const sender = (overrides.sender as RecordingSender | undefined) ?? new RecordingSender();
  const outbox = (overrides.outbox as RecordingOutbox | undefined) ?? new RecordingOutbox();
  const auditEvents: unknown[] = [];
  const { gate, maxAlertsPerHour, outageRetryMaxAttempts, ...rest } = overrides;
  const engine = new AlertEngine({
    gate: gate ?? new StubGate(),
    sender,
    outbox,
    audit: { record: (event: unknown) => auditEvents.push(event) },
    maxAlertsPerHour: maxAlertsPerHour ?? 6,
    outageRetryMaxAttempts: outageRetryMaxAttempts ?? 3,
    now: clock.now,
    ...rest,
  });
  return { engine, sender, outbox, auditEvents, clock };
}
