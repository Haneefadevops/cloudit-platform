/**
 * Injectable time source for the deterministic Phase C runtime.
 *
 * All platform controls (budget boundaries, scheduler timeouts, circuit
 * breaker cooldowns) read time exclusively through a Clock so tests can
 * advance time manually without real timers.
 */

export interface Clock {
  now(): Date;
}

/** Production clock backed by the system time. */
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** Deterministic clock for offline tests: time only moves via advance(). */
export class ManualClock implements Clock {
  private current: Date;

  constructor(start: Date) {
    this.current = new Date(start.getTime());
  }

  now(): Date {
    return new Date(this.current.getTime());
  }

  advance(milliseconds: number): void {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) {
      throw new Error('ManualClock.advance requires a non-negative finite duration');
    }
    this.current = new Date(this.current.getTime() + milliseconds);
  }
}

/** UTC calendar-day key, e.g. '2026-09-21'. */
export function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** UTC calendar-month key, e.g. '2026-09'. */
export function utcMonthKey(date: Date): string {
  return date.toISOString().slice(0, 7);
}
