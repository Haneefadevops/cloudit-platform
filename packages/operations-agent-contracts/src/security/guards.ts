/**
 * Fail-closed leak guards for callers that handle output text.
 */
import { CanaryLeakReport, detectCanaryLeak } from './canary';
import { SecurityError, fail, ok, type Result } from './errors';

/**
 * Result-returning guard: `ok(text)` when no canary leaks are detected,
 * otherwise `fail` with a typed {@link SecurityError} (code
 * `SECURITY_ERR_CANARY_LEAK`). Never throws on string input.
 */
export function checkNoLeak(outputText: unknown): Result<string> {
  const report: CanaryLeakReport = detectCanaryLeak(outputText);
  if (report.leaked) {
    return fail(
      new SecurityError(
        'SECURITY_ERR_CANARY_LEAK',
        `canary leak detected in categories: ${report.categories.join(', ')}`,
        report.matches.map((match) => ({
          code: 'SECURITY_ERR_CANARY_LEAK',
          path: '$',
          message: `canary value present: ${match}`,
        })),
      ),
    );
  }
  return ok(outputText as string);
}

/**
 * Asserting guard: returns the input text unchanged when clean, throws a
 * typed {@link SecurityError} when a canary leaks. For callers that prefer
 * exceptions at a trust boundary.
 */
export function assertNoLeak(outputText: unknown, context?: string): string {
  const result = checkNoLeak(outputText);
  if (!result.ok) {
    const where = context ? ` (${context})` : '';
    throw new SecurityError(result.error.code, `${result.error.message}${where}`, result.error.issues);
  }
  return result.value;
}
