/**
 * Untrusted-text labeling. Any text that originated outside the trusted
 * system boundary (evidence excerpts, provider payloads, operator free text)
 * must flow through `labelUntrustedText` so downstream code can never
 * mistake it for instructions or a trusted channel.
 */
import { SecurityError } from './errors';

export const UNTRUSTED_KIND = 'untrusted' as const;

export interface UntrustedText {
  readonly kind: typeof UNTRUSTED_KIND;
  readonly value: string;
}

/**
 * Wrap an arbitrary string as inert, labeled data. Fail-closed: anything
 * that is not a string is a programming error and throws a typed
 * {@link SecurityError}.
 */
export function labelUntrustedText(value: unknown): UntrustedText {
  if (typeof value !== 'string') {
    throw new SecurityError(
      'SECURITY_ERR_INVALID_INPUT',
      'labelUntrustedText expects a string; received ' + (value === null ? 'null' : typeof value),
    );
  }
  return Object.freeze({ kind: UNTRUSTED_KIND, value });
}

export function isUntrustedText(value: unknown): value is UntrustedText {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === UNTRUSTED_KIND &&
    typeof (value as { value?: unknown }).value === 'string'
  );
}
