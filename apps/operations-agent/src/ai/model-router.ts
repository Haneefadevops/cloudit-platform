/**
 * Task-specific model routing (operator-plan section 8.2).
 *
 * `gpt-5.6-terra` (escalation) is used ONLY for:
 *  - deterministic RED with multiple conflicting signals, or
 *  - low-confidence Luna output, or
 *  - an owner-requested deeper explanation.
 * Everything else routes to `gpt-5.6-luna` (routine).
 *
 * Escalations are capped per UTC day (configurable, plan 8.3: max three).
 * When the daily escalation budget is exhausted the decision falls back to
 * routine. `decide` never throws: unexpected input degrades to routine.
 */

export interface RoutingInput {
  deterministicStatus: 'GREEN' | 'AMBER' | 'RED' | 'NO_DATA' | 'UNKNOWN';
  conflictingSignals: boolean;
  lowConfidence: boolean;
  ownerRequestedDeepExplanation: boolean;
}

export type RoutingDecision =
  | { model: 'routine' }
  | { model: 'escalation'; reason: string };

export type EscalationReason =
  | 'CONFLICTING_RED_SIGNALS'
  | 'LOW_CONFIDENCE'
  | 'OWNER_REQUESTED_DEEP_EXPLANATION';

export interface ModelRouterOptions {
  routineModel: string;
  escalationModel: string;
  maxEscalationsPerDay: number;
  now?: () => number;
}

function utcDayKey(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

export class ModelRouter {
  private readonly routineModel: string;
  private readonly escalationModel: string;
  private readonly maxEscalationsPerDay: number;
  private readonly now: () => number;
  private escalationDayKey = '';
  private escalationsUsedToday = 0;

  constructor(options: ModelRouterOptions) {
    this.routineModel = options.routineModel;
    this.escalationModel = options.escalationModel;
    this.maxEscalationsPerDay = Math.max(0, Math.floor(options.maxEscalationsPerDay));
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * Terra only for deterministic RED with conflicting signals, low-confidence
   * output, or owner-requested deep explanation. Cap N/day (configurable):
   * when the daily escalation budget is exhausted, decision falls back to
   * routine. Never throws.
   */
  decide(input: RoutingInput): RoutingDecision {
    try {
      const reason = this.escalationReason(input);
      if (reason !== null && this.consumeEscalationBudget()) {
        return { model: 'escalation', reason };
      }
      return { model: 'routine' };
    } catch {
      return { model: 'routine' };
    }
  }

  /** Configured provider alias for a routing decision. */
  resolveModel(decision: RoutingDecision): string {
    return decision.model === 'escalation' ? this.escalationModel : this.routineModel;
  }

  private escalationReason(input: RoutingInput): EscalationReason | null {
    if (input.ownerRequestedDeepExplanation) return 'OWNER_REQUESTED_DEEP_EXPLANATION';
    if (input.deterministicStatus === 'RED' && input.conflictingSignals) {
      return 'CONFLICTING_RED_SIGNALS';
    }
    if (input.lowConfidence) return 'LOW_CONFIDENCE';
    return null;
  }

  private consumeEscalationBudget(): boolean {
    const today = utcDayKey(this.now());
    if (today !== this.escalationDayKey) {
      this.escalationDayKey = today;
      this.escalationsUsedToday = 0;
    }
    if (this.escalationsUsedToday >= this.maxEscalationsPerDay) return false;
    this.escalationsUsedToday += 1;
    return true;
  }
}
