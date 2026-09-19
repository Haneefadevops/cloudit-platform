/**
 * In-memory JobScheduler implementation for the offline Phase C runtime.
 *
 * Timer-free by default: jobs only run when tick() is called. Production use
 * may call start(intervalMs) to drive tick() from a real interval; dispose()
 * always clears it so no timer survives shutdown or tests.
 */

import { Clock, SystemClock } from '../clock';
import {
  CircuitBreakerOptions,
  JobDefinition,
  JobRunResult,
  JobRunStatus,
  JobScheduler,
  JobSchedulerOptions,
  ScheduleResult,
} from './job-scheduler';

const DEFAULT_CONCURRENCY = 1;
const DEFAULT_TIMEOUT_MS = 30_000;

type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface PendingJob {
  readonly definition: JobDefinition;
  readonly runAtMs: number;
  readonly attempt: number;
}

export class InMemoryJobScheduler implements JobScheduler {
  private readonly clock: Clock;
  private readonly concurrency: number;
  private readonly defaultTimeoutMs: number;
  private readonly breaker: CircuitBreakerOptions | null;

  private readonly pending = new Map<string, PendingJob>();
  private readonly running = new Set<string>();
  private disposedFlag = false;
  private interval: ReturnType<typeof setInterval> | null = null;

  private consecutiveFailures = 0;
  private breakerState: BreakerState = 'CLOSED';
  private openedAtMs: number | null = null;

  constructor(options: JobSchedulerOptions = {}) {
    this.clock = options.clock ?? new SystemClock();
    this.concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.breaker = options.circuitBreaker ?? null;
  }

  get disposed(): boolean {
    return this.disposedFlag;
  }

  /** Optional real-time drive; tests must not call this (use tick()). */
  start(intervalMs: number): void {
    if (this.disposedFlag) throw new Error('job scheduler is disposed');
    if (this.interval !== null) throw new Error('job scheduler already started');
    this.interval = setInterval(() => {
      void this.tick();
    }, intervalMs);
    if (typeof this.interval.unref === 'function') this.interval.unref();
  }

  schedule(definition: JobDefinition): ScheduleResult {
    if (this.disposedFlag) throw new Error('job scheduler is disposed');
    if (!definition.key || definition.key.length > 128) {
      throw new Error('job definition requires a non-empty key (max 128 chars)');
    }
    const replaced = this.pending.delete(definition.key);
    // Phase C runs each job at most once per schedule; a reschedule replaces
    // the pending run instead of queueing a duplicate attempt.
    this.pending.set(definition.key, {
      definition,
      runAtMs: definition.runAt.getTime(),
      attempt: 1,
    });
    return { replaced };
  }

  cancel(key: string): boolean {
    return this.pending.delete(key);
  }

  async tick(): Promise<JobRunResult[]> {
    if (this.disposedFlag) return [];
    const nowMs = this.clock.now().getTime();
    const due = [...this.pending.values()]
      .filter((job) => job.runAtMs <= nowMs)
      .sort((a, b) => a.runAtMs - b.runAtMs);

    const started: PendingJob[] = [];
    const outcomes: Array<JobRunResult | PendingJob> = [];
    for (const job of due) {
      if (this.disposedFlag) {
        outcomes.push({ key: job.definition.key, status: 'REJECTED_DISPOSED' });
        continue;
      }
      if (this.breakerState === 'OPEN') {
        if (this.breaker !== null && nowMs - (this.openedAtMs ?? nowMs) >= this.breaker.cooldownMs) {
          this.breakerState = 'HALF_OPEN';
        } else {
          outcomes.push({ key: job.definition.key, status: 'REJECTED_BREAKER_OPEN' });
          continue;
        }
      }
      if (this.breakerState === 'HALF_OPEN' && started.length > 0) {
        // A half-open tick admits exactly one trial run.
        outcomes.push({ key: job.definition.key, status: 'DEFERRED_CONCURRENCY' });
        continue;
      }
      if (this.running.size + started.length >= this.concurrency) {
        outcomes.push({ key: job.definition.key, status: 'DEFERRED_CONCURRENCY' });
        continue;
      }
      if (this.running.has(job.definition.key)) {
        // Never run the same key twice concurrently; leave it pending.
        outcomes.push({ key: job.definition.key, status: 'DEFERRED_CONCURRENCY' });
        continue;
      }
      this.pending.delete(job.definition.key);
      started.push(job);
      outcomes.push(job);
    }

    const finished = new Map<string, JobRunResult>();
    await Promise.all(
      started.map(async (job) => {
        finished.set(job.definition.key, await this.execute(job));
      }),
    );

    return outcomes.map((entry) =>
      'status' in entry ? entry : (finished.get(entry.definition.key) as JobRunResult),
    );
  }

  async dispose(): Promise<void> {
    this.disposedFlag = true;
    this.pending.clear();
    if (this.interval !== null) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async execute(job: PendingJob): Promise<JobRunResult> {
    const { definition } = job;
    const key = definition.key;
    this.running.add(key);
    const startedMs = this.clock.now().getTime();
    const timeoutMs = definition.timeoutMs ?? this.defaultTimeoutMs;
    let status: JobRunStatus = 'COMPLETED';
    let errorCode: string | undefined;

    try {
      const outcome = await definition.handler({
        key,
        attempt: job.attempt,
        startedAt: new Date(startedMs),
      });
      const elapsedMs = this.clock.now().getTime() - startedMs;
      if (elapsedMs > timeoutMs) {
        status = 'JOB_TIMEOUT';
        errorCode = 'JOB_TIMEOUT';
      } else if (outcome.status === 'FAILED') {
        status = 'FAILED';
        errorCode = outcome.errorCode;
      }
    } catch {
      status = 'FAILED';
      errorCode = 'JOB_HANDLER_THREW';
    } finally {
      this.running.delete(key);
    }

    const finishedAt = new Date(this.clock.now().getTime());
    this.onOutcome(status);
    const result: JobRunResult = { key, status, startedAt: new Date(startedMs), finishedAt };
    return errorCode !== undefined ? { ...result, errorCode } : result;
  }

  private onOutcome(status: JobRunStatus): void {
    if (status === 'COMPLETED') {
      this.consecutiveFailures = 0;
      if (this.breakerState === 'HALF_OPEN') this.breakerState = 'CLOSED';
      return;
    }
    this.consecutiveFailures += 1;
    if (this.breaker !== null && this.consecutiveFailures >= this.breaker.failureThreshold) {
      if (this.breakerState !== 'OPEN') {
        this.breakerState = 'OPEN';
        this.openedAtMs = this.clock.now().getTime();
      }
    }
  }
}
