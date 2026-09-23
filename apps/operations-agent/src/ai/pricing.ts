/**
 * Verified provider pricing snapshot (operator-plan 8.2/8.3, KIMI plan 7b).
 *
 * Values verified on the AI-brain phase start against September 2026 pricing
 * trackers citing OpenAI's official pricing page
 * (AIModelCalc "AI API Pricing 2026", BenchLM "OpenAI API Pricing",
 * CloudZero "OpenAI API pricing in 2026"). Prices are USD per 1M tokens;
 * the EUR rate tables used by the cost estimator and the budget meter are
 * derived through a configurable USD→EUR FX rate (never hard-coded history).
 *
 * Reasoning/"thinking" tokens on this generation bill at the output rate;
 * consumers must count total output tokens reported by the provider's usage
 * fields, not just visible completion text.
 *
 * This is a pinned snapshot, not a live quote: reverify before any live
 * enablement (operator-plan 8.2) and update via configuration, not code.
 */

export interface VerifiedModelPriceUsd {
  /** USD price per 1M input tokens (standard, non-batch). */
  readonly inputUsdPerMillionTokens: number;
  /** USD price per 1M output tokens (includes reasoning tokens where billed). */
  readonly outputUsdPerMillionTokens: number;
}

export const PRICING_VERIFIED_AT = '2026-09 (AI-brain phase preparation)';
export const PRICING_SOURCE =
  'OpenAI official pricing page via AIModelCalc/BenchLM/CloudZero September 2026 trackers';

/** Pinned USD→EUR snapshot; override with AI_FX_USD_TO_EUR at runtime. */
export const FX_USD_TO_EUR_DEFAULT = 0.85;

export const VERIFIED_MODEL_PRICING_USD: Readonly<Record<string, VerifiedModelPriceUsd>> =
  Object.freeze({
    'gpt-5.6-luna': Object.freeze({ inputUsdPerMillionTokens: 0.2, outputUsdPerMillionTokens: 1.2 }),
    'gpt-5.6-terra': Object.freeze({ inputUsdPerMillionTokens: 2, outputUsdPerMillionTokens: 12 }),
  });

export interface EurModelRate {
  /** EUR price per 1M input tokens. */
  readonly inputEurPerMillionTokens: number;
  /** EUR price per 1M output tokens. */
  readonly outputEurPerMillionTokens: number;
}

function round4(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

/** Convert the verified USD snapshot to EUR rates at the given FX. */
export function buildVerifiedEurRateTable(
  fxUsdToEur: number = FX_USD_TO_EUR_DEFAULT,
): Readonly<Record<string, EurModelRate>> {
  const fx = Number.isFinite(fxUsdToEur) && fxUsdToEur > 0 ? fxUsdToEur : FX_USD_TO_EUR_DEFAULT;
  return Object.freeze(
    Object.fromEntries(
      Object.entries(VERIFIED_MODEL_PRICING_USD).map(([model, price]) => [
        model,
        Object.freeze({
          inputEurPerMillionTokens: round4(price.inputUsdPerMillionTokens * fx),
          outputEurPerMillionTokens: round4(price.outputUsdPerMillionTokens * fx),
        }),
      ]),
    ),
  );
}
