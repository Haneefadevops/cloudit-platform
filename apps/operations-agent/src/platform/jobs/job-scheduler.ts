/**
 * JobScheduler port (operator-plan section 9: PostgreSQL-backed durable jobs
 * with a lightweight in-agent scheduler).
 *
 * Contract guarantees every implementation must provide:
 *
 * - idempotent job keys: re-scheduling an existing key REPLACES the pending
 *   schedule; a key is never duplicated and never runs twice concurrently;
 * - a concurrency limit per scheduler instance;
 * - a per-job timeout: a job whose execution exceeds its timeout is failed
 *   safely (outcome JOB_TIMEOUT), never left half-accounted;
 * - a circuit breaker: opens after N consecutive job failures and rejects new
 *   runs until a cooldown elapses (half-open trial run, then closed on
 *   success or re-opened on failure);
 * - an injectable clock and explicit tick()/dispose() so no real timers are
 *   required in tests.
 */

import { Clock } from '../clock';

export type JobOutcome =
  | { readonly status: 'SUCCESS' }
  | { readonly status: 'FAILED'; readonly errorCode: string };

export interface JobRunContext {
  readonly key: string;
  readonly attempt: number;
  readonly startedAt: Date;
}

export type JobHandler = (context: JobRunContext) => Promise<JobOutcome>;

export interface JobDefinition {
  /** Idempotent job key. Re-scheduling the same key replaces the pending run. */
  readonly key: string;
  readonly runAt: Date;
  readonly handler: JobHandler;
  /** Per-job timeout; falls back to the scheduler default. */
  readonly timeoutMs?: number;
}

export type JobRunStatus =
  | 'COMPLETED'
  | 'FAILED'
  | 'JOB_TIMEOUT'
  | 'REJECTED_BREAKER_OPEN'
  | 'DEFERRED_CONCURRENCY'
  | 'REJECTED_DISPOSED';

export interface JobRunResult {
  readonly key: string;
  readonly status: JobRunStatus;
  /** Safe machine-readable code only; never a raw error message. */
  readonly errorCode?: string;
  readonly startedAt?: Date;
  readonly finishedAt?: Date;
}

export interface CircuitBreakerOptions {
  /** Consecutive failures that open the breaker. */
  readonly failureThreshold: number;
  /** How long the breaker rejects runs before allowing a half-open trial. */
  readonly cooldownMs: number;
}

export interface JobSchedulerOptions {
  readonly clock?: Clock;
  /** Maximum jobs executing at once within one scheduler. Default 1. */
  readonly concurrency?: number;
  readonly defaultTimeoutMs?: number;
  readonly circuitBreaker?: CircuitBreakerOptions;
}

export interface ScheduleResult {
  /** True when an earlier pending schedule with the same key was replaced. */
  readonly replaced: boolean;
}

export interface JobScheduler {
  readonly disposed: boolean;
  schedule(definition: JobDefinition): ScheduleResult;
  cancel(key: string): boolean;
  /**
   * Runs due jobs (up to the concurrency limit), awaiting their completion.
   * With an injected manual clock this is the only way time-dependent state
   * (timeouts, breaker cooldowns) advances - call it explicitly in tests.
   */
  tick(): Promise<JobRunResult[]>;
  /** Stops the scheduler and clears pending work. Idempotent. */
  dispose(): Promise<void>;
}

export const JOB_SCHEDULER = Symbol('JOB_SCHEDULER');
