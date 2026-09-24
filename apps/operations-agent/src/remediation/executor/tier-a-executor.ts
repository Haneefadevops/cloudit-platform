/**
 * Tier A remediation executor (Phase H) — the only path by which the
 * allowlisted runbook RB-READONLY-RECHECK-001 performs its fixed,
 * non-destructive action: ONE bounded read-only freshness re-check for a
 * non-critical evidence source, independently verified by a second bounded
 * read, recorded as an append-only attempt. Zero external side effects by
 * construction.
 *
 * Gating order (contract-fixed): runbook contract validation, per-runbook
 * enable flag, auto-remediation kill switch, circuit breaker, durable
 * exactly-once attempt claim, bounded recheck, independent verification.
 *
 * NOT a Nest injectable: the coordinator composes it in app.module.ts with
 * plain constructor options. It never throws; every path returns a
 * RemediationExecutionResult.
 */

import type { AttemptResultCode, AttemptStore, RemediationAttemptRecord } from '../attempt-contract';
import type { EvidenceSource } from '../../observer/evidence-source';
import { validateEvidenceProjection } from '../../supervisor/evidence-projection';
import { DEFAULT_SOURCE_KEYS } from '../../supervisor/supervisor-options';
import type { GateDecision } from '../../platform/kill-switch/kill-switch.service';
import type {
  RemediationExecutionRequest,
  RemediationExecutionResult,
  RemediationExecutor,
} from './executor-contract';
import {
  buildReadonlyRecheckGateSummary,
  buildReadonlyRecheckSummary,
  READONLY_RECHECK_ACCEPTED_ISSUE_CODES,
  READONLY_RECHECK_ALLOWED_TARGETS,
  READONLY_RECHECK_RUNBOOK_KEY,
  READONLY_RECHECK_RUNBOOK_VERSION,
  READONLY_RECHECK_TIMEOUT_MS,
} from './readonly-recheck-runbook';
import { buildAttemptAuditEvent } from './attempt-audit';

const DAY_UTC_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const KNOWN_SOURCE_KEYS: ReadonlySet<string> = new Set<string>(DEFAULT_SOURCE_KEYS);

/** Distinct classification buckets for the independent-verification compare. */
type FreshnessClassification = 'OK' | 'NOT_OK';

class BoundedReadTimedOutError extends Error {
  constructor() {
    super('bounded evidence read timed out');
    this.name = 'BoundedReadTimedOutError';
  }
}

export interface RemediationCircuit {
  isOpen(): boolean;
  onSuccess(): void;
  onFailure(): void;
}

export interface TierARemediationExecutorOptions {
  attemptStore: AttemptStore;
  evidence: Pick<EvidenceSource, 'read'>;
  killSwitch: { check(capability: 'auto-remediation'): GateDecision };
  runbookEnabled: (runbookKey: string) => boolean;
  audit?: { record(event: unknown): unknown };
  now?: () => number;
  recheckTimeoutMs?: number;
  attemptIdFactory?: () => string;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
  circuit?: RemediationCircuit;
}

let attemptCounter = 0;

export class TierARemediationExecutor implements RemediationExecutor {
  private readonly attemptStore: AttemptStore;
  private readonly evidence: Pick<EvidenceSource, 'read'>;
  private readonly killSwitch: { check(capability: 'auto-remediation'): GateDecision };
  private readonly runbookEnabled: (runbookKey: string) => boolean;
  private readonly audit: { record(event: unknown): unknown } | undefined;
  private readonly now: () => number;
  private readonly recheckTimeoutMs: number;
  private readonly attemptIdFactory: () => string;
  private readonly setTimeoutFn: typeof setTimeout;
  private readonly clearTimeoutFn: typeof clearTimeout;
  private readonly circuit: RemediationCircuit | undefined;

  constructor(options: TierARemediationExecutorOptions) {
    this.attemptStore = options.attemptStore;
    this.evidence = options.evidence;
    this.killSwitch = options.killSwitch;
    this.runbookEnabled = options.runbookEnabled;
    this.audit = options.audit;
    this.now = options.now ?? (() => Date.now());
    this.recheckTimeoutMs = options.recheckTimeoutMs ?? READONLY_RECHECK_TIMEOUT_MS;
    this.attemptIdFactory =
      options.attemptIdFactory ??
      (() => `att-${attemptCounter++}-${this.now().toString(36)}`);
    this.setTimeoutFn = options.setTimeoutFn ?? setTimeout;
    this.clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
    this.circuit = options.circuit;
  }

  async execute(request: RemediationExecutionRequest): Promise<RemediationExecutionResult> {
    try {
      return await this.gatedAttempt(request);
    } catch {
      // Never-throws invariant: an unexpected fault before the claim is
      // recorded maps to a closed INTERNAL_ERROR result.
      return {
        outcome: 'INTERNAL_ERROR',
        attemptId: null,
        resultCode: 'INTERNAL_ERROR',
        summary: buildReadonlyRecheckGateSummary('INTERNAL_ERROR'),
      };
    }
  }

  private async gatedAttempt(
    request: RemediationExecutionRequest,
  ): Promise<RemediationExecutionResult> {
    const gate = this.validateContract(request);
    if (gate !== null) return gate;
    if (!this.runbookEnabled(READONLY_RECHECK_RUNBOOK_KEY)) {
      return {
        outcome: 'PRECONDITION_FAILED',
        attemptId: null,
        resultCode: 'PRECONDITION_FAILED',
        summary: buildReadonlyRecheckGateSummary('RUNBOOK_DISABLED'),
      };
    }
    const decision = this.killSwitch.check('auto-remediation');
    if (!decision.allowed) {
      return {
        outcome: 'BLOCKED_KILL_SWITCH',
        attemptId: null,
        resultCode: 'BLOCKED_KILL_SWITCH',
        summary: buildReadonlyRecheckGateSummary('KILL_SWITCH'),
      };
    }
    if (this.circuit?.isOpen()) {
      return {
        outcome: 'CIRCUIT_OPEN',
        attemptId: null,
        resultCode: 'BLOCKED_KILL_SWITCH',
        summary: buildReadonlyRecheckGateSummary('CIRCUIT_OPEN'),
      };
    }

    const idempotencyKey = `${READONLY_RECHECK_RUNBOOK_KEY}:${request.targetKey}:${request.idempotencyDayUtc}`;
    const attemptId = this.attemptIdFactory();
    const claimed = await this.attemptStore.claim({
      attemptId,
      runbookKey: READONLY_RECHECK_RUNBOOK_KEY,
      runbookVersion: READONLY_RECHECK_RUNBOOK_VERSION,
      targetKey: request.targetKey,
      issueCode: request.issueCode,
      idempotencyKey,
      nowMs: request.nowMs,
      clientKey: request.clientKey,
      environmentKey: request.environmentKey,
    });
    if (claimed === null) {
      return {
        outcome: 'ALREADY_CLAIMED',
        attemptId: null,
        resultCode: null,
        summary: buildReadonlyRecheckGateSummary('ALREADY_CLAIMED'),
      };
    }

    try {
      return await this.attemptBody(request, claimed);
    } catch {
      // Unexpected fault after the claim: close the attempt out as
      // INTERNAL_ERROR (best effort, swallowed) and fail closed.
      await this.finishSafely(claimed.attemptId, 'FAILED', 'INTERNAL_ERROR', request);
      this.feedCircuit('INTERNAL_ERROR');
      this.emitAudit('EXECUTED', 'INTERNAL_ERROR', request.targetKey, request);
      return {
        outcome: 'EXECUTED',
        attemptId: claimed.attemptId,
        resultCode: 'INTERNAL_ERROR',
        summary: buildReadonlyRecheckSummary(
          request.targetKey,
          request.idempotencyDayUtc,
          'INTERNAL_ERROR',
        ),
      };
    }
  }

  private async attemptBody(
    request: RemediationExecutionRequest,
    claimed: RemediationAttemptRecord,
  ): Promise<RemediationExecutionResult> {
    // Recheck: one bounded read-only freshness re-check for exactly the
    // target source.
    let recheckClassification: FreshnessClassification;
    try {
      const projection = await this.boundedRead(request.clientKey, request.environmentKey);
      recheckClassification = this.classifyTarget(projection, request.targetKey);
    } catch (error) {
      const resultCode: AttemptResultCode =
        error instanceof BoundedReadTimedOutError ? 'TIMED_OUT' : 'SOURCE_FAILED';
      return this.finishAndReport(claimed, request, resultCode, 'FAILED');
    }

    // Independent verification: a second bounded read; disagreement or any
    // verification fault fails closed as SOURCE_FAILED.
    let verificationClassification: FreshnessClassification;
    try {
      const projection = await this.boundedRead(request.clientKey, request.environmentKey);
      verificationClassification = this.classifyTarget(projection, request.targetKey);
    } catch {
      return this.finishAndReport(claimed, request, 'SOURCE_FAILED', 'FAILED');
    }

    if (verificationClassification !== recheckClassification) {
      return this.finishAndReport(claimed, request, 'SOURCE_FAILED', 'FAILED');
    }

    const resultCode: AttemptResultCode =
      verificationClassification === 'OK' ? 'RECOVERED' : 'CONFIRMED_STALE';
    return this.finishAndReport(claimed, request, resultCode, 'SUCCEEDED');
  }

  private async finishAndReport(
    claimed: RemediationAttemptRecord,
    request: RemediationExecutionRequest,
    resultCode: AttemptResultCode,
    status: 'SUCCEEDED' | 'FAILED',
  ): Promise<RemediationExecutionResult> {
    const summary = buildReadonlyRecheckSummary(
      request.targetKey,
      request.idempotencyDayUtc,
      resultCode,
    );
    await this.finishSafely(claimed.attemptId, status, resultCode, request, summary);
    this.feedCircuit(resultCode);
    this.emitAudit('EXECUTED', resultCode, request.targetKey, request, summary);
    return {
      outcome: 'EXECUTED',
      attemptId: claimed.attemptId,
      resultCode,
      summary,
    };
  }

  private classifyTarget(projection: unknown, targetKey: string): FreshnessClassification {
    const validated = validateEvidenceProjection(projection, KNOWN_SOURCE_KEYS);
    if (!validated.ok) return this.sourceFailed();
    const record = validated.value.records.find((entry) => entry.sourceKey === targetKey);
    if (!record) return this.sourceFailed();
    return record.status === 'OK' ? 'OK' : 'NOT_OK';
  }

  private sourceFailed(): never {
    throw new BoundedReadSourceFailedError();
  }

  private async boundedRead(clientKey: string, environmentKey: string): Promise<unknown> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.evidence.read(clientKey, environmentKey),
        new Promise<never>((_resolve, reject) => {
          timer = this.setTimeoutFn(
            () => reject(new BoundedReadTimedOutError()),
            this.recheckTimeoutMs,
          ) as ReturnType<typeof setTimeout>;
        }),
      ]);
    } finally {
      if (timer !== undefined) {
        this.clearTimeoutFn(timer);
      }
    }
  }

  private async finishSafely(
    attemptId: string,
    status: 'SUCCEEDED' | 'FAILED',
    resultCode: AttemptResultCode,
    request: RemediationExecutionRequest,
    summary?: string,
  ): Promise<void> {
    try {
      await this.attemptStore.finish(attemptId, {
        status,
        resultCode,
        summary:
          summary ??
          buildReadonlyRecheckSummary(
            request.targetKey,
            request.idempotencyDayUtc,
            resultCode,
          ),
        nowMs: request.nowMs,
      });
    } catch {
      // Append-only close-out is best effort; the result stands.
    }
  }

  private feedCircuit(resultCode: AttemptResultCode): void {
    if (!this.circuit) return;
    try {
      if (resultCode === 'RECOVERED' || resultCode === 'CONFIRMED_STALE') {
        this.circuit.onSuccess();
      } else {
        this.circuit.onFailure();
      }
    } catch {
      // Circuit feedback never changes the result.
    }
  }

  private emitAudit(
    outcome: 'EXECUTED',
    resultCode: AttemptResultCode,
    targetKey: string,
    request: RemediationExecutionRequest,
    summary?: string,
  ): void {
    if (!this.audit) return;
    try {
      this.audit.record(
        buildAttemptAuditEvent(
          outcome,
          resultCode,
          targetKey,
          new Date(this.now()).toISOString(),
          summary ??
            buildReadonlyRecheckSummary(
              request.targetKey,
              request.idempotencyDayUtc,
              resultCode,
            ),
        ),
      );
    } catch {
      // A failing audit sink must never change the execution result.
    }
  }

  private validateContract(
    request: RemediationExecutionRequest,
  ): RemediationExecutionResult | null {
    if (
      request.runbookKey !== READONLY_RECHECK_RUNBOOK_KEY ||
      request.runbookVersion !== READONLY_RECHECK_RUNBOOK_VERSION ||
      !(READONLY_RECHECK_ACCEPTED_ISSUE_CODES as readonly string[]).includes(request.issueCode) ||
      !(READONLY_RECHECK_ALLOWED_TARGETS as readonly string[]).includes(request.targetKey) ||
      !DAY_UTC_PATTERN.test(request.idempotencyDayUtc)
    ) {
      return {
        outcome: 'PRECONDITION_FAILED',
        attemptId: null,
        resultCode: 'PRECONDITION_FAILED',
        summary: buildReadonlyRecheckGateSummary('CONTRACT'),
      };
    }
    return null;
  }
}

class BoundedReadSourceFailedError extends Error {
  constructor() {
    super('evidence contract violated for target source');
    this.name = 'BoundedReadSourceFailedError';
  }
}
