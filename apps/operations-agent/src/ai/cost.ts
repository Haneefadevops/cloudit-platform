/**
 * Synthetic cost estimation for AI calls.
 *
 * SYNTHETIC PLACEHOLDER RATES ONLY. These values are NOT verified provider
 * pricing. Operator-plan section 8.2 requires model aliases and pricing to be
 * reverified against official documentation before any live enablement and
 * pinned to an evaluated snapshot. All enforcement in this phase is offline
 * and synthetic; the estimate exists so the adapter can report `costEur` and
 * feed the BudgetGate.
 *
 * estimateCostEur(tokensIn, tokensOut) = tokensIn * rateIn + tokensOut * rateOut
 * with rates expressed per token (the table is per 1M tokens for readability).
 * An unknown model falls back to the routine model's rate so an estimate is
 * always produced; unpriced usage cannot silently bypass the budget gate.
 */

export interface SyntheticModelRate {
  /** Synthetic EUR price per 1M input tokens. */
  readonly inputEurPerMillionTokens: number;
  /** Synthetic EUR price per 1M output tokens. */
  readonly outputEurPerMillionTokens: number;
}

export const SYNTHETIC_MODEL_RATES: Readonly<Record<string, SyntheticModelRate>> = Object.freeze({
  'gpt-5.6-luna': Object.freeze({ inputEurPerMillionTokens: 0.25, outputEurPerMillionTokens: 1 }),
  'gpt-5.6-terra': Object.freeze({ inputEurPerMillionTokens: 1, outputEurPerMillionTokens: 4 }),
});

export const ROUTINE_FALLBACK_MODEL = 'gpt-5.6-luna';

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Estimated EUR cost of one call. `fallbackModel` is used when `model` has no
 * rate entry (defaults to the luna routine alias). Documented as synthetic.
 */
export function estimateCostEur(
  model: string,
  tokensIn: number,
  tokensOut: number,
  fallbackModel: string = ROUTINE_FALLBACK_MODEL,
): number {
  const rate = SYNTHETIC_MODEL_RATES[model] ?? SYNTHETIC_MODEL_RATES[fallbackModel];
  if (!rate) return 0;
  return round6(
    (tokensIn / 1_000_000) * rate.inputEurPerMillionTokens +
      (tokensOut / 1_000_000) * rate.outputEurPerMillionTokens,
  );
}
