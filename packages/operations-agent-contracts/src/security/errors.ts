/**
 * Typed errors and the fail-closed Result type for the security module.
 * Dependency-free (TypeScript stdlib only).
 */

export type SecurityErrorCode =
  | 'SECURITY_ERR_INVALID_INPUT'
  | 'SECURITY_ERR_VALIDATION'
  | 'SECURITY_ERR_DEPTH'
  | 'SECURITY_ERR_SIZE'
  | 'SECURITY_ERR_REPLAY'
  | 'SECURITY_ERR_BUDGET'
  | 'SECURITY_ERR_CANARY_LEAK';

export interface ValidationIssue {
  readonly code: SecurityErrorCode;
  /** JSONPath-style location of the offending value, e.g. `$[3].id`. */
  readonly path: string;
  readonly message: string;
}

export class SecurityError extends Error {
  readonly code: SecurityErrorCode;
  readonly issues: readonly ValidationIssue[];

  constructor(code: SecurityErrorCode, message: string, issues: readonly ValidationIssue[] = []) {
    super(message);
    this.name = 'SecurityError';
    this.code = code;
    this.issues = Object.freeze([...issues]);
    Object.freeze(this);
  }
}

export type Result<T, E extends SecurityError = SecurityError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value } as Result<T, never>;
}

export function fail<E extends SecurityError>(error: E): Result<never, E> {
  return { ok: false, error };
}
