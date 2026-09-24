/**
 * Deterministic Telegram alert engine (Phase F: "deterministic RED/recovery
 * alerts through Telegram; reviewed daily/weekly/monthly summaries; prove
 * dedup, recovery, outage fallback").
 *
 * Design constraints:
 *  - Deterministic: fixed templates, no model involvement, no untrusted text
 *    (verdict.summary / evidence keys never enter a message).
 *  - Pure ports: the kill-switch gate, sender and outbox are injected narrow
 *    structural interfaces; no imports from src/platform or src/telegram, no
 *    timers, no network. The coordinator binds the real adapters.
 *  - Never throws: every failure path returns an AlertDecision; the engine
 *    records exactly one closed audit event per handle()/sendDigest() call.
 *
 * Behavior:
 *  1. Dedup per (environmentKey, subjectKey): first RED sends red_alert; a
 *     repeated RED is SUPPRESSED_DUPLICATE; a later non-RED verdict for an
 *     alerted subject sends recovery and clears the subject; non-RED with no
 *     state is SKIPPED_NOT_RED. Subjects are independent.
 *  2. Rate limit: at most maxAlertsPerHour sends (successful sends AND
 *     queued-outage attempts) per rolling hour, sliding window over now().
 *  3. Kill switch: gate.assertEnabled() throws -> BLOCKED_KILL_SWITCH, no
 *     send, still one audit event.
 *  4. Sender outage: append to the outbox (bounded per subject by
 *     outageRetryMaxAttempts) -> QUEUED_OUTAGE; otherwise SUPPRESSED_OUTAGE_BOUND.
 *  5. Digest: fixed period header with entry count, per-category counts and
 *     one `subjectKey: CATEGORY` line per entry; same gate/rate-limit/outage
 *     and canary rules.
 */

import { HealthAssessment } from '@cloudit/operations-agent-contracts';
import { AlertDispatchAuditEvent, buildAlertAuditEvent } from './alert-audit';
import { DigestPeriod, renderDigest, renderRedAlert, renderRecovery } from './templates';

export interface AlertMessage {
  kind: 'red_alert' | 'recovery' | 'digest';
  environmentKey: string;
  subjectKey: string;
  text: string;
  occurredAt: string; // ISO
}

export interface DigestEntry {
  subjectKey: string;
  category: 'RED' | 'AMBER' | 'GREEN' | 'NO_DATA' | 'UNKNOWN';
  summary: string;
  lastOccurredAt: string; // ISO
}

export type AlertAction =
  | 'SENT'
  | 'SUPPRESSED_DUPLICATE'
  | 'SUPPRESSED_RATE_LIMITED'
  | 'SUPPRESSED_OUTAGE_BOUND'
  | 'QUEUED_OUTAGE'
  | 'SKIPPED_NOT_RED'
  | 'BLOCKED_KILL_SWITCH';

export interface AlertDecision {
  action: AlertAction;
  message?: AlertMessage;
}

export interface AlertEngineOptions {
  gate: { assertEnabled(): void };
  sender: { send(message: AlertMessage): Promise<void> };
  outbox?: { append(entry: { entryId: string; type: string; payload: unknown }): unknown };
  audit?: { record(event: unknown): unknown };
  maxAlertsPerHour: number;
  outageRetryMaxAttempts: number;
  now?: () => number; // ms epoch; default Date.now
  /**
   * Optional observation hook invoked once per completed handle() call with
   * the final decision. Never affects the decision: a throwing callback is
   * swallowed. Undefined means zero behavioral change.
   */
  readonly onDispatch?: (info: {
    readonly environmentKey: string;
    readonly verdict: HealthAssessment;
    readonly decision: AlertDecision;
  }) => void;
}

const RATE_WINDOW_MS = 3_600_000; // rolling hour
const DEFAULT_SUBJECT = 'unknown';

function subjectKeyOf(verdict: HealthAssessment): string {
  const issueCode: unknown = verdict?.issueCode;
  return typeof issueCode === 'string' && issueCode.length > 0 ? issueCode : DEFAULT_SUBJECT;
}

function evidenceCountOf(verdict: HealthAssessment): number {
  return Array.isArray(verdict?.evidenceKeys) ? verdict.evidenceKeys.length : 0;
}

/** Internal control-flow marker for kill-switch denials. */
class GateDeniedError extends Error {
  constructor() {
    super('kill switch denied');
    this.name = 'GateDeniedError';
  }
}

export class AlertEngine {
  private readonly now: () => number;
  /** Subjects currently in the alerted state (awaiting recovery). */
  private readonly alerted = new Set<string>();
  /** Sliding window of send-attempt timestamps (successful + queued). */
  private readonly sendLog: number[] = [];
  /** Queued-outage appends per subject since construction (outage bound). */
  private readonly outagePending = new Map<string, number>();
  /** Monotonic outbox sequence: entryIds must be unique per occurrence even
   * under a fixed clock, or the durable outbox rejects the append. */
  private outboxSequence = 0;

  private readonly onDispatch: AlertEngineOptions['onDispatch'];

  constructor(private readonly options: AlertEngineOptions) {
    this.now = options.now ?? (() => Date.now());
    this.onDispatch = options.onDispatch;
  }

  async handle(environmentKey: string, verdict: HealthAssessment): Promise<AlertDecision> {
    const subjectKey = subjectKeyOf(verdict);
    let decision: AlertDecision;
    try {
      decision = await this.dispatchAlert(environmentKey, subjectKey, verdict);
    } catch (error) {
      if (error instanceof GateDeniedError) {
        decision = this.finish('BLOCKED_KILL_SWITCH', subjectKey, undefined);
      } else {
        // Never-throws safety net: degrade to a bounded suppression.
        decision = this.finish('SUPPRESSED_OUTAGE_BOUND', subjectKey, undefined);
      }
    }
    this.emitDispatch(environmentKey, verdict, decision);
    return decision;
  }

  /** Observation hook: frozen info, same decision reference, never throws. */
  private emitDispatch(
    environmentKey: string,
    verdict: HealthAssessment,
    decision: AlertDecision,
  ): void {
    if (!this.onDispatch) return;
    try {
      this.onDispatch(Object.freeze({ environmentKey, verdict, decision }));
    } catch {
      // The hook is observational only; callback failures must not alter dispatch.
    }
  }

  async sendDigest(
    environmentKey: string,
    period: 'daily' | 'weekly' | 'monthly',
    entries: DigestEntry[],
  ): Promise<AlertDecision> {
    const subjectKey = 'digest';
    try {
      this.assertGate();
      if (!this.rateBudgetAvailable()) {
        return this.finish('SUPPRESSED_RATE_LIMITED', subjectKey, undefined);
      }
      const message: AlertMessage = {
        kind: 'digest',
        environmentKey,
        subjectKey,
        text: renderDigest(environmentKey, period as DigestPeriod, entries),
        occurredAt: new Date(this.now()).toISOString(),
      };
      return this.sendOrQueue(environmentKey, subjectKey, message);
    } catch (error) {
      if (error instanceof GateDeniedError) {
        return this.finish('BLOCKED_KILL_SWITCH', subjectKey, undefined);
      }
      return this.finish('SUPPRESSED_OUTAGE_BOUND', subjectKey, undefined);
    }
  }

  private assertGate(): void {
    try {
      this.options.gate.assertEnabled();
    } catch {
      throw new GateDeniedError();
    }
  }

  private async dispatchAlert(
    environmentKey: string,
    subjectKey: string,
    verdict: HealthAssessment,
  ): Promise<AlertDecision> {
    this.assertGate();

    const stateKey = `${environmentKey}:${subjectKey}`;
    const isRed = verdict?.assessment === 'RED';

    if (!isRed && !this.alerted.has(stateKey)) {
      return this.finish('SKIPPED_NOT_RED', subjectKey, undefined);
    }
    if (isRed && this.alerted.has(stateKey)) {
      return this.finish('SUPPRESSED_DUPLICATE', subjectKey, undefined);
    }
    if (!this.rateBudgetAvailable()) {
      return this.finish('SUPPRESSED_RATE_LIMITED', subjectKey, undefined);
    }

    const message: AlertMessage = isRed
      ? {
          kind: 'red_alert',
          environmentKey,
          subjectKey,
          text: renderRedAlert(environmentKey, subjectKey, evidenceCountOf(verdict)),
          occurredAt: new Date(this.now()).toISOString(),
        }
      : {
          kind: 'recovery',
          environmentKey,
          subjectKey,
          text: renderRecovery(
            environmentKey,
            subjectKey,
            String(verdict.assessment),
            evidenceCountOf(verdict),
          ),
          occurredAt: new Date(this.now()).toISOString(),
        };

    const decision = await this.sendOrQueue(environmentKey, subjectKey, message);
    if (decision.action === 'SENT') {
      // State transitions only on successful delivery.
      if (isRed) this.alerted.add(stateKey);
      else this.alerted.delete(stateKey);
    }
    return decision;
  }

  /** Send; on sender outage append to the outbox subject to the retry bound. */
  private async sendOrQueue(
    environmentKey: string,
    subjectKey: string,
    message: AlertMessage,
  ): Promise<AlertDecision> {
    try {
      await this.options.sender.send(message);
      this.recordSendAttempt();
      return this.finish('SENT', subjectKey, message);
    } catch {
      const stateKey = `${environmentKey}:${subjectKey}`;
      const pending = this.outagePending.get(stateKey) ?? 0;
      if (!this.options.outbox || pending >= this.options.outageRetryMaxAttempts) {
        return this.finish('SUPPRESSED_OUTAGE_BOUND', subjectKey, undefined);
      }
      const occurredAtMillis = this.now();
      this.outboxSequence += 1;
      this.options.outbox.append({
        entryId: `alert-outage-${environmentKey}-${subjectKey}-${occurredAtMillis}-${this.outboxSequence}`,
        type: 'telegram_alert',
        payload: message,
      });
      this.outagePending.set(stateKey, pending + 1);
      // Queued-outage attempts count toward the rate limit.
      this.recordSendAttempt();
      return this.finish('QUEUED_OUTAGE', subjectKey, message);
    }
  }

  private rateBudgetAvailable(): boolean {
    const cutoff = this.now() - RATE_WINDOW_MS;
    let used = 0;
    for (const ts of this.sendLog) {
      if (ts > cutoff) used += 1;
    }
    return used < this.options.maxAlertsPerHour;
  }

  private recordSendAttempt(): void {
    this.sendLog.push(this.now());
  }

  /** Builds the decision and records exactly one closed audit event. */
  private finish(
    action: AlertAction,
    subjectKey: string,
    message: AlertMessage | undefined,
  ): AlertDecision {
    if (this.options.audit) {
      const event: AlertDispatchAuditEvent = buildAlertAuditEvent(
        action,
        subjectKey,
        new Date(this.now()).toISOString(),
      );
      try {
        this.options.audit.record(event);
      } catch {
        // Audit sinks must never break dispatch.
      }
    }
    const decision: AlertDecision = { action };
    if (message && (action === 'SENT' || action === 'QUEUED_OUTAGE')) {
      decision.message = message;
    }
    return decision;
  }
}
