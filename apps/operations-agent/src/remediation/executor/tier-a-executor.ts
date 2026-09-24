/**
 * Tier A remediation executor (Phase H) — the only path by which an
 * allowlisted Tier A runbook performs its fixed, non-destructive action.
 *
 * Runbook 1 (RB-READONLY-RECHECK-001): ONE bounded read-only freshness
 * re-check for a non-critical evidence source, independently verified by a
 * second bounded read, recorded as an append-only attempt.
 *
 * Runbook 2 (RB-INCIDENT-RECOVERY-VERIFY-001): when the alert engine
 * declares a subject recovered, the recovery is independently verified
 * against real read-only evidence by TWO agreeing bounded reads before it is
 * durably trusted. Zero external side effects by construction.
 *
 * The allowlist is a CLOSED, compile-time two-entry registry keyed by
 * runbookKey; unknown keys fail closed at contract validation.
 *
 * Gating order (contract-fixed): runbook contract validation, per-runbook
 * enable flag, auto-remediation kill switch, circuit breaker, durable
 * exactly-once attempt claim, bounded recheck, independent verification.
 *
 * NOT a Nest injectable: the coordinator composes it in app.module.ts with
 * plain constructor options. It never throws; every path returns a
 * RemediationExecutionResult.
 */

import {
  CONTROL_CHARACTER_PATTERN,
} from '@cloudit/operations-agent-contracts';
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
import {
  buildRecoveryVerifyGateSummary,
  buildRecoveryVerifySummary,
  isRecoveryVerifyTargetKey,
  RECOVERY_VERIFY_ACCEPTED_ISSUE_CODES,
  RECOVERY_VERIFY_RUNBOOK_KEY,
  RECOVERY_VERIFY_RUNBOOK_VERSION,
} from './recovery-verify-runbook';
import { buildAttemptAuditEvent } from './attempt-audit';

const DAY_UTC_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const KNOWN_SOURCE_KEYS: ReadonlySet<string> = new Set<string>(DEFAULT_SOURCE_KEYS);
const MAX_EVIDENCE_KEY_CHARS = 64;

/** Distinct classification buckets for the independent-verification compare. */
type FreshnessClassification = 'OK' | 'NOT_OK';

/** Recovery classification: both bounded reads must land in the same bucket. */
type RecoveryClassification = 'RECOVERED' | 'CONFIRMED_STALE';

type TierARunbookKind = 'recheck' | 'recovery-verify';

/**
 * Closed registry entry: the compile-time allowlist of Tier A runbooks. Each
 * entry pins its contract facts and its own summary templates; the flag
 * callback per entry is resolved by the executor (backward-compatible
 * `runbookEnabled` for the recheck entry, the optional
 * `recoveryVerifyEnabled` for the recovery-verify entry).
 */
interface TierARunbookEntry {
  readonly kind: TierARunbookKind;
  readonly runbookKey: string;
  readonly runbookVersion: string;
  readonly acceptedIssueCodes: readonly string[];
  acceptsTargetKey(targetKey: unknown): boolean;
  buildSummary(targetKey: string, dayUtc: string, resultCode: string): string;
  buildGateSummary(reason: string): string;
}

const TIER_A_RUNBOOK_REGISTRY: readonly TierARunbookEntry[] = Object.freeze([
  Object.freeze({
    kind: 'recheck',
    runbookKey: READONLY_RECHECK_RUNBOOK_KEY,
    runbookVersion: READONLY_RECHECK_RUNBOOK_VERSION,
    acceptedIssueCodes: READONLY_RECHECK_ACCEPTED_ISSUE_CODES,
    acceptsTargetKey: (targetKey: unknown): boolean =>
      (READONLY_RECHECK_ALLOWED_TARGETS as readonly string[]).includes(targetKey as string),
    buildSummary: buildReadonlyRecheckSummary,
    buildGateSummary: buildReadonlyRecheckGateSummary,
  }),
  Object.freeze({
    kind: 'recovery-verify',
    runbookKey: RECOVERY_VERIFY_RUNBOOK_KEY,
    runbookVersion: RECOVERY_VERIFY_RUNBOOK_VERSION,
    acceptedIssueCodes: RECOVERY_VERIFY_ACCEPTED_ISSUE_CODES,
    acceptsTargetKey: isRecoveryVerifyTargetKey,
    buildSummary: buildRecoveryVerifySummary,
    buildGateSummary: buildRecoveryVerifyGateSummary,
  }),
]);

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
  /**
   * Per-runbook enable flag for RB-INCIDENT-RECOVERY-VERIFY-001. When
   * undefined the recovery-verify runbook is disabled (fail closed). The
   * existing `runbookEnabled` callback keeps gating RB-READONLY-RECHECK-001
   * exactly as before.
   */
  recoveryVerifyEnabled?: (runbookKey: string) => boolean;
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
  private readonly recoveryVerifyEnabled: ((runbookKey: string) => boolean) | undefined;
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
    this.recoveryVerifyEnabled = options.recoveryVerifyEnabled;
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
        summary: this.gateSummaryFor(request, 'INTERNAL_ERROR'),
      };
    }
  }

  private async gatedAttempt(
    request: RemediationExecutionRequest,
  ): Promise<RemediationExecutionResult> {
    const entry = this.resolveEntry(request);
    if (entry === null || !this.contractFits(entry, request)) {
      return {
        outcome: 'PRECONDITION_FAILED',
        attemptId: null,
        resultCode: 'PRECONDITION_FAILED',
        summary: this.gateSummaryFor(request, 'CONTRACT'),
      };
    }
    if (!this.isEntryEnabled(entry)) {
      return {
        outcome: 'PRECONDITION_FAILED',
        attemptId: null,
        resultCode: 'PRECONDITION_FAILED',
        summary: entry.buildGateSummary('RUNBOOK_DISABLED'),
      };
    }
    const decision = this.killSwitch.check('auto-remediation');
    if (!decision.allowed) {
      return {
        outcome: 'BLOCKED_KILL_SWITCH',
        attemptId: null,
        resultCode: 'BLOCKED_KILL_SWITCH',
        summary: entry.buildGateSummary('KILL_SWITCH'),
      };
    }
    if (this.circuit?.isOpen()) {
      return {
        outcome: 'CIRCUIT_OPEN',
        attemptId: null,
        resultCode: 'BLOCKED_KILL_SWITCH',
        summary: entry.buildGateSummary('CIRCUIT_OPEN'),
      };
    }

    const idempotencyKey = `${entry.runbookKey}:${request.targetKey}:${request.idempotencyDayUtc}`;
    const attemptId = this.attemptIdFactory();
    const claimed = await this.attemptStore.claim({
      attemptId,
      runbookKey: entry.runbookKey,
      runbookVersion: entry.runbookVersion,
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
        summary: entry.buildGateSummary('ALREADY_CLAIMED'),
      };
    }

    try {
      return await this.attemptBody(entry, request, claimed);
    } catch {
      // Unexpected fault after the claim: close the attempt out as
      // INTERNAL_ERROR (best effort, swallowed) and fail closed.
      await this.finishSafely(entry, claimed.attemptId, 'FAILED', 'INTERNAL_ERROR', request);
      this.feedCircuit('INTERNAL_ERROR');
      this.emitAudit(entry, 'EXECUTED', 'INTERNAL_ERROR', request);
      return {
        outcome: 'EXECUTED',
        attemptId: claimed.attemptId,
        resultCode: 'INTERNAL_ERROR',
        summary: entry.buildSummary(
          request.targetKey,
          request.idempotencyDayUtc,
          'INTERNAL_ERROR',
        ),
      };
    }
  }

  private async attemptBody(
    entry: TierARunbookEntry,
    request: RemediationExecutionRequest,
    claimed: RemediationAttemptRecord,
  ): Promise<RemediationExecutionResult> {
    // Recheck: one bounded read-only evidence read for the runbook's source
    // set (the single target source, or every checked source).
    let recheckClassification: FreshnessClassification | RecoveryClassification;
    try {
      const projection = await this.boundedRead(request.clientKey, request.environmentKey);
      recheckClassification = this.classifyForEntry(entry, projection, request);
    } catch (error) {
      const resultCode: AttemptResultCode =
        error instanceof BoundedReadTimedOutError ? 'TIMED_OUT' : 'SOURCE_FAILED';
      return this.finishAndReport(entry, claimed, request, resultCode, 'FAILED');
    }

    // Independent verification: a second bounded read; disagreement or any
    // verification fault fails closed as SOURCE_FAILED.
    let verificationClassification: FreshnessClassification | RecoveryClassification;
    try {
      const projection = await this.boundedRead(request.clientKey, request.environmentKey);
      verificationClassification = this.classifyForEntry(entry, projection, request);
    } catch {
      return this.finishAndReport(entry, claimed, request, 'SOURCE_FAILED', 'FAILED');
    }

    if (verificationClassification !== recheckClassification) {
      return this.finishAndReport(entry, claimed, request, 'SOURCE_FAILED', 'FAILED');
    }

    const resultCode: AttemptResultCode =
      entry.kind === 'recheck'
        ? recheckClassification === 'OK'
          ? 'RECOVERED'
          : 'CONFIRMED_STALE'
        : (recheckClassification as RecoveryClassification);
    return this.finishAndReport(entry, claimed, request, resultCode, 'SUCCEEDED');
  }

  private classifyForEntry(
    entry: TierARunbookEntry,
    projection: unknown,
    request: RemediationExecutionRequest,
  ): FreshnessClassification | RecoveryClassification {
    if (entry.kind === 'recheck') {
      return this.classifyTarget(projection, request.targetKey);
    }
    return this.classifyRecovery(projection, request);
  }

  private classifyTarget(projection: unknown, targetKey: string): FreshnessClassification {
    const validated = validateEvidenceProjection(projection, KNOWN_SOURCE_KEYS);
    if (!validated.ok) return this.sourceFailed();
    const record = validated.value.records.find((entry) => entry.sourceKey === targetKey);
    if (!record) return this.sourceFailed();
    return record.status === 'OK' ? 'OK' : 'NOT_OK';
  }

  /**
   * Recovery-verify classification. The checked source set is the request's
   * evidenceKeys when present and non-empty (each pre-validated as a safe
   * string), otherwise every record in the projection. A source is healthy
   * only when its status is 'OK' AND its freshUntil is after nowMs. A
   * requested key with no projection record counts as not healthy (fail
   * closed). An empty checked set fails closed as CONFIRMED_STALE.
   */
  private classifyRecovery(
    projection: unknown,
    request: RemediationExecutionRequest,
  ): RecoveryClassification {
    const validated = validateEvidenceProjection(projection, KNOWN_SOURCE_KEYS);
    if (!validated.ok) return this.sourceFailed();
    const records = validated.value.records;
    const requested = request.evidenceKeys;
    const checkedKeys: readonly string[] =
      requested !== undefined && requested.length > 0
        ? requested
        : records.map((record) => record.sourceKey);
    if (checkedKeys.length === 0) return 'CONFIRMED_STALE';
    const bySourceKey = new Map<string, (typeof records)[number]>();
    for (const record of records) {
      bySourceKey.set(record.sourceKey, record);
    }
    for (const key of checkedKeys) {
      const record = bySourceKey.get(key);
      const healthy =
        record !== undefined &&
        record.status === 'OK' &&
        Date.parse(record.freshUntil) > request.nowMs;
      if (!healthy) return 'CONFIRMED_STALE';
    }
    return 'RECOVERED';
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

  private async finishAndReport(
    entry: TierARunbookEntry,
    claimed: RemediationAttemptRecord,
    request: RemediationExecutionRequest,
    resultCode: AttemptResultCode,
    status: 'SUCCEEDED' | 'FAILED',
  ): Promise<RemediationExecutionResult> {
    const summary = entry.buildSummary(
      request.targetKey,
      request.idempotencyDayUtc,
      resultCode,
    );
    await this.finishSafely(entry, claimed.attemptId, status, resultCode, request, summary);
    this.feedCircuit(resultCode);
    this.emitAudit(entry, 'EXECUTED', resultCode, request, summary);
    return {
      outcome: 'EXECUTED',
      attemptId: claimed.attemptId,
      resultCode,
      summary,
    };
  }

  private async finishSafely(
    entry: TierARunbookEntry,
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
          entry.buildSummary(request.targetKey, request.idempotencyDayUtc, resultCode),
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
    entry: TierARunbookEntry,
    outcome: 'EXECUTED',
    resultCode: AttemptResultCode,
    request: RemediationExecutionRequest,
    summary?: string,
  ): void {
    if (!this.audit) return;
    try {
      this.audit.record(
        buildAttemptAuditEvent(
          outcome,
          resultCode,
          request.targetKey,
          new Date(this.now()).toISOString(),
          summary ??
            entry.buildSummary(
              request.targetKey,
              request.idempotencyDayUtc,
              resultCode,
            ),
          this.auditKeysFor(entry, request),
        ),
      );
    } catch {
      // A failing audit sink must never change the execution result.
    }
  }

  /**
   * Recovery-verify audit events carry the checked evidence source keys;
   * the recheck runbook keeps its original single-target-key event shape.
   */
  private auditKeysFor(
    entry: TierARunbookEntry,
    request: RemediationExecutionRequest,
  ): { evidenceKeys?: readonly string[] } | undefined {
    if (entry.kind !== 'recovery-verify') return undefined;
    const requested = request.evidenceKeys;
    if (requested === undefined || requested.length === 0) return undefined;
    return { evidenceKeys: requested };
  }

  private resolveEntry(request: RemediationExecutionRequest): TierARunbookEntry | null {
    const key = request?.runbookKey;
    if (typeof key !== 'string') return null;
    return TIER_A_RUNBOOK_REGISTRY.find((entry) => entry.runbookKey === key) ?? null;
  }

  private resolveEntrySafely(request: RemediationExecutionRequest): TierARunbookEntry | null {
    try {
      return this.resolveEntry(request);
    } catch {
      return null;
    }
  }

  /** Resolves the per-entry enable flag; the recovery entry fails closed. */
  private isEntryEnabled(entry: TierARunbookEntry): boolean {
    if (entry.kind === 'recheck') {
      return this.runbookEnabled(entry.runbookKey);
    }
    return this.recoveryVerifyEnabled
      ? this.recoveryVerifyEnabled(entry.runbookKey)
      : false;
  }

  private gateSummaryFor(request: RemediationExecutionRequest, reason: string): string {
    const entry = this.resolveEntrySafely(request);
    const buildGate = entry?.buildGateSummary ?? buildReadonlyRecheckGateSummary;
    return buildGate(reason);
  }

  private contractFits(
    entry: TierARunbookEntry,
    request: RemediationExecutionRequest,
  ): boolean {
    if (request.runbookVersion !== entry.runbookVersion) return false;
    if (!entry.acceptedIssueCodes.includes(request.issueCode)) return false;
    if (!entry.acceptsTargetKey(request.targetKey)) return false;
    if (!DAY_UTC_PATTERN.test(request.idempotencyDayUtc)) return false;
    if (entry.kind === 'recovery-verify' && !this.evidenceKeysFit(request.evidenceKeys)) {
      return false;
    }
    return true;
  }

  /** Requested evidence keys must be safe strings: 1-64 chars, no controls. */
  private evidenceKeysFit(keys: readonly string[] | undefined): boolean {
    if (keys === undefined) return true;
    if (!Array.isArray(keys)) return false;
    if (keys.length === 0) return true;
    for (const key of keys) {
      if (
        typeof key !== 'string' ||
        key.length === 0 ||
        key.length > MAX_EVIDENCE_KEY_CHARS ||
        CONTROL_CHARACTER_PATTERN.test(key)
      ) {
        return false;
      }
    }
    return true;
  }
}

class BoundedReadSourceFailedError extends Error {
  constructor() {
    super('evidence contract violated for target source');
    this.name = 'BoundedReadSourceFailedError';
  }
}
