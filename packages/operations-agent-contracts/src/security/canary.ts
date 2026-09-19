/**
 * Canary-leak detection: scans output text for any known secret-canary
 * fixture value and reports which categories leaked. Used to prove that
 * sanitized output carries no secret-shaped content.
 */
import { SecurityError } from './errors';
import { SECRET_CANARY_FIXTURES, type SecretCanaryCategory } from './fixtures/secret-canary';

export interface CanaryLeakReport {
  readonly leaked: boolean;
  readonly categories: readonly SecretCanaryCategory[];
  /** The exact canary values found. */
  readonly matches: readonly string[];
}

export function detectCanaryLeak(outputText: unknown): CanaryLeakReport {
  if (typeof outputText !== 'string') {
    throw new SecurityError(
      'SECURITY_ERR_INVALID_INPUT',
      'detectCanaryLeak expects a string; received ' + (outputText === null ? 'null' : typeof outputText),
    );
  }
  const categories = new Set<SecretCanaryCategory>();
  const matches: string[] = [];
  for (const canary of SECRET_CANARY_FIXTURES) {
    if (outputText.includes(canary.value)) {
      categories.add(canary.category);
      matches.push(canary.value);
    }
  }
  return Object.freeze({
    leaked: matches.length > 0,
    categories: Object.freeze([...categories]),
    matches: Object.freeze(matches),
  });
}
