import { RemediationEngine, RemediationEngineOptions } from '../../src/remediation';

export const ENV = 'env-test';
export const ISSUE = 'WF_STALE_SNAPSHOT';
export const FIXED_NOW_MS = Date.UTC(2026, 10, 2, 12, 0, 0);

export interface EngineHarness {
  engine: RemediationEngine;
  auditEvents: unknown[];
  clock: { now: () => number; set: (ms: number) => void; advance: (ms: number) => void };
}

export function makeEngine(overrides: Partial<RemediationEngineOptions> = {}): EngineHarness {
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
  const auditEvents: unknown[] = [];
  const engine = new RemediationEngine({
    audit: { record: (event: unknown) => auditEvents.push(event) },
    now: clock.now,
    ...overrides,
  });
  return { engine, auditEvents, clock };
}
