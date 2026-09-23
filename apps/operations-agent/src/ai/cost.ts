/**
 * Cost estimation for AI calls.
 *
 * Rates are derived from the verified pricing snapshot (pricing.ts): official
 * USD prices per 1M tokens converted at a configurable USD→EUR FX rate
 * (AI_FX_USD_TO_EUR; the budget meter injects the runtime-configured table).
 * An unknown model falls back to the routine model's rate so an estimate is
 * always produced; unpriced usage cannot silently bypass the budget gate.
 */

import { buildVerifiedEurRateTable, EurModelRate, FX_USD_TO_EUR_DEFAULT } from './pricing';

/** Verified-derived EUR rate table at the pinned FX snapshot. */
export const VERIFIED_EUR_MODEL_RATES: Readonly<Record<string, EurModelRate>> =
  buildVerifiedEurRateTable();

export const ROUTINE_FALLBACK_MODEL = 'gpt-5.6-luna';

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Estimated EUR cost of one call. `fallbackModel` is used when `model` has no
 * rate entry (defaults to the luna routine alias). Optional `fxUsdToEur`
 * rebuilds the table at a runtime-configured FX rate.
 */
export function estimateCostEur(
  model: string,
  tokensIn: number,
  tokensOut: number,
  fallbackModel: string = ROUTINE_FALLBACK_MODEL,
  fxUsdToEur: number = FX_USD_TO_EUR_DEFAULT,
): number {
  const rates: Readonly<Record<string, EurModelRate>> =
    fxUsdToEur === FX_USD_TO_EUR_DEFAULT
      ? VERIFIED_EUR_MODEL_RATES
      : buildVerifiedEurRateTable(fxUsdToEur);
  const rate = rates[model] ?? rates[fallbackModel];
  if (!rate) return 0;
  return round6(
    (tokensIn / 1_000_000) * rate.inputEurPerMillionTokens +
      (tokensOut / 1_000_000) * rate.outputEurPerMillionTokens,
  );
}
