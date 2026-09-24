/**
 * Remediation trigger (Programme Phase H, coordinator glue).
 *
 * Bridges the deterministic supervisor's accepted findings to the Tier A
 * executor: after every observation interval it scans the soak driver's
 * last-accepted findings and requests one read-only recheck execution for
 * each non-critical analytics source reported UNKNOWN or stale. The executor
 * itself re-checks the full policy/runbook contract on every call, so this
 * trigger is a pure read-and-request loop: it performs no gating decisions,
 * never throws, and overlaps with its own previous scan are suppressed.
 *
 * The composition is inert unless the observer, the attempt store and the
 * executor are all live; the executor additionally stays silent until the
 * per-runbook flag and the 'auto-remediation' kill switch are enabled on
 * the server (separate owner approvals).
 */

import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { Finding } from '@cloudit/operations-agent-contracts';
import type { AttemptStore } from './attempt-contract';
import type { RemediationExecutor } from './executor/executor-contract';
import {
  READONLY_RECHECK_ACCEPTED_ISSUE_CODES,
  READONLY_RECHECK_ALLOWED_TARGETS,
  READONLY_RECHECK_RUNBOOK_KEY,
  READONLY_RECHECK_RUNBOOK_VERSION,
  READONLY_RECHECK_TIMEOUT_MS,
} from './executor/readonly-recheck-runbook';

/** Minimal timer surface, mirroring the soak driver's TimerLike. */
export interface RemediationTriggerTimers {
  setInterval(handler: () => void, intervalMs: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface RemediationTriggerOptions {
  /** Read-only findings view of the soak driver; null disables the trigger. */
  readonly driver: { getFindings(): readonly Finding[] } | null;
  readonly executor: RemediationExecutor | null;
  /** Boot recovery finalizes stale RUNNING attempts once at startup. */
  readonly attemptStore: AttemptStore | null;
  readonly intervalMs: number;
  readonly clientKey: string;
  readonly environmentKey: string;
  readonly now?: () => number;
  readonly timers?: RemediationTriggerTimers;
}

const DEFAULT_TIMERS: RemediationTriggerTimers = {
  setInterval: (handler, ms) => setInterval(handler, ms),
  clearInterval: (handle) => clearInterval(handle as Parameters<typeof clearInterval>[0]),
};

function dayUtcOf(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export class RemediationTrigger implements OnModuleInit, OnModuleDestroy {
  private readonly timers: RemediationTriggerTimers;
  private readonly now: () => number;
  private timerHandle: unknown = null;
  private inFlight = false;

  constructor(private readonly options: RemediationTriggerOptions) {
    this.timers = options.timers ?? DEFAULT_TIMERS;
    this.now = options.now ?? Date.now;
  }

  onModuleInit(): void {
    if (!this.options.driver || !this.options.executor || !this.options.attemptStore) return;
    // Boot recovery: a crash mid-attempt must never be resumed or re-executed.
    void this.options.attemptStore.finalizeStaleRunning(READONLY_RECHECK_TIMEOUT_MS, this.now());
    this.timerHandle = this.timers.setInterval(() => {
      void this.scan();
    }, this.options.intervalMs);
  }

  onModuleDestroy(): void {
    if (this.timerHandle !== null) {
      this.timers.clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  /** One scan cycle. Never throws; overlaps are suppressed. */
  private async scan(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      const driver = this.options.driver;
      const executor = this.options.executor;
      if (!driver || !executor) return;
      const findings = driver.getFindings();
      const nowMs = this.now();
      const idempotencyDayUtc = dayUtcOf(nowMs);
      for (const finding of findings) {
        const acceptedIssueCodes: readonly string[] = READONLY_RECHECK_ACCEPTED_ISSUE_CODES;
        if (!acceptedIssueCodes.includes(finding.issueCode)) {
          continue;
        }
        const targetKey = finding.evidenceKeys[0];
        const allowedTargets: readonly string[] = READONLY_RECHECK_ALLOWED_TARGETS;
        if (!targetKey || !allowedTargets.includes(targetKey)) {
          continue;
        }
        await executor.execute({
          proposalId: finding.findingId,
          runbookKey: READONLY_RECHECK_RUNBOOK_KEY,
          runbookVersion: READONLY_RECHECK_RUNBOOK_VERSION,
          issueCode: finding.issueCode,
          targetKey,
          clientKey: this.options.clientKey,
          environmentKey: this.options.environmentKey,
          idempotencyDayUtc,
          nowMs,
        });
      }
    } catch {
      // The trigger never throws and never widens repair: the next interval
      // retries; the executor remains the only authority on execution.
    } finally {
      this.inFlight = false;
    }
  }
}
