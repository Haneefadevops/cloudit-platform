/**
 * Summaries/answers service (AI-brain phase, KIMI plan 7b Worker B).
 *
 * FROZEN PUBLIC SURFACE (coordinator skeleton). Worker B implements the
 * internals behind this exact signature; Worker C writes blind evals against
 * it. Contract:
 *
 * - fixed prompt templates fed ONLY with already-sanitized observer/digest
 *   views; every evidence text field is treated as untrusted data and
 *   wrapped via the contracts package `labelUntrustedText`;
 * - model output validated with `validateHealthAssessment` (closed schema,
 *   enums, evidence-key membership, bounded summary); refusal, malformed,
 *   contradictory or canary-leaking output collapses to the deterministic
 *   fallback — deterministic checks are ALWAYS authoritative;
 * - gate -> budget -> route -> call -> validate -> record/audit pipeline,
 *   mirroring the shadow-mode adapter; no mutation tool is ever exposed;
 * - `getExplanation` returns bounded plain text safe for Telegram `/explain`.
 *
 * Skeleton state: performs the gate/budget checks and returns the
 * deterministic fallback (never contacts the model). Worker B lands the
 * real prompt/call/validate path.
 */

import { HealthAssessment } from '@cloudit/operations-agent-contracts';
import { AiAdapterOptions, AiGate, BudgetGate } from '../ai-adapter.service';
import { LlmClient } from '../llm';

export interface SummariesServiceOptions {
  ai: AiAdapterOptions['ai'];
  client: LlmClient;
  budget: BudgetGate;
  gate: AiGate;
  audit?: { record(event: unknown): unknown };
  now?: () => number;
}

export interface GetExplanationInput {
  /** Deterministic verdict produced by the supervisor — ALWAYS authoritative. */
  deterministic: HealthAssessment;
  /** Already-sanitized, bounded finding text; treated as untrusted data. */
  findingSummary: string;
  /** Sanitized evidence hash for audit/correlation. Opaque, no PII. */
  evidenceHash: string;
  ownerRequestedDeepExplanation?: boolean;
}

export interface GetExplanationResult {
  assessment: HealthAssessment;
  /** Bounded plain-text explanation, safe for Telegram. */
  explanation: string;
  /** Model alias used, or 'deterministic' when falling back. */
  model: string;
  fallback: boolean;
  costEur: number;
  tokensIn: number;
  tokensOut: number;
}

const EXPLANATION_MAX_CHARS = 1_000;

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

export class SummariesService {
  constructor(private readonly options: SummariesServiceOptions) {}

  /**
   * Bounded explanation for one sanitized finding. Never rejects: any
   * failure mode (AI disabled, budget denied, model failure, invalid or
   * contradictory output) produces the deterministic fallback with
   * costEur 0.
   */
  async getExplanation(input: GetExplanationInput): Promise<GetExplanationResult> {
    let enabled = true;
    try {
      this.options.gate.assertEnabled();
    } catch {
      enabled = false;
    }
    const affordable = this.options.budget.canCall();
    if (!enabled || !affordable) {
      // Skeleton + kill-switch-off/budget-denied path: deterministic fallback.
    }
    return {
      assessment: input.deterministic,
      explanation: truncate(
        `Deterministic verdict ${input.deterministic.assessment}: ${input.deterministic.summary}`,
        EXPLANATION_MAX_CHARS,
      ),
      model: 'deterministic',
      fallback: true,
      costEur: 0,
      tokensIn: 0,
      tokensOut: 0,
    };
  }
}
