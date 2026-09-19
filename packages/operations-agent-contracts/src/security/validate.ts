/**
 * Fail-closed batch validation, replay detection and budget enforcement.
 *
 * Every function here returns a {@link Result}: malformed, replayed or
 * over-budget input yields `{ ok: false, error: SecurityError }` with NO
 * partial output, and validation never throws (not even on circular or
 * hostile structures). Typed {@link SecurityError} throws are reserved for
 * programming errors (non-string arguments to string APIs).
 */
import { SecurityError, fail, ok, type Result, type ValidationIssue } from './errors';
import { SECURITY_LIMITS } from './limits';
import type { EvidenceBudgetCap } from './fixtures/over-budget';

export interface ValidatedEvidenceItem {
  readonly id: string;
  readonly nonce: string | null;
  readonly timestamp: string | number | null;
  readonly costMicros: number;
  readonly tokenCount: number;
}

export interface BudgetTotals {
  readonly costMicros: number;
  readonly tokenCount: number;
}

export interface ValidatedBatch {
  readonly items: readonly ValidatedEvidenceItem[];
  readonly totals: BudgetTotals;
}

function validationFailure(issues: readonly ValidationIssue[]): Result<never> {
  const first = issues[0];
  return fail(new SecurityError(first?.code ?? 'SECURITY_ERR_VALIDATION', 'evidence batch rejected', issues));
}

function measureDepth(value: unknown, seen: Set<unknown>, issues: ValidationIssue[], path: string): number {
  if (value === null || typeof value !== 'object') return 0;
  if (seen.has(value)) {
    issues.push({ code: 'SECURITY_ERR_VALIDATION', path, message: 'circular reference in payload' });
    return 0;
  }
  seen.add(value);
  const children = Array.isArray(value) ? value : Object.values(value);
  let maxChild = 0;
  for (const child of children) {
    maxChild = Math.max(maxChild, measureDepth(child, seen, issues, path));
  }
  return maxChild + 1;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNonNegativeFiniteNumber(
  item: Record<string, unknown>,
  key: 'costMicros' | 'tokenCount',
  path: string,
  issues: ValidationIssue[],
): number {
  const raw = item[key];
  if (raw === undefined || raw === null) return 0;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
    issues.push({
      code: 'SECURITY_ERR_VALIDATION',
      path: `${path}.${key}`,
      message: `${key} must be a finite number >= 0`,
    });
    return 0;
  }
  return raw;
}

/**
 * Validate a raw evidence batch. Rejects (fail-closed, no partial output):
 * non-array input, null/array items, missing/oversized/non-string ids,
 * NaN/Infinity/negative numbers, payloads exceeding MAX_EVIDENCE_DEPTH or
 * MAX_INPUT_BYTES, and batches larger than MAX_BATCH_ITEMS.
 */
export function validateEvidenceBatch(input: unknown): Result<ValidatedBatch> {
  if (!Array.isArray(input)) {
    return validationFailure([
      { code: 'SECURITY_ERR_VALIDATION', path: '$', message: 'batch must be an array' },
    ]);
  }
  const issues: ValidationIssue[] = [];

  if (input.length > SECURITY_LIMITS.MAX_BATCH_ITEMS) {
    issues.push({
      code: 'SECURITY_ERR_SIZE',
      path: '$',
      message: `batch has ${input.length} items; limit is ${SECURITY_LIMITS.MAX_BATCH_ITEMS}`,
    });
  }

  let serializedLength: number | null = null;
  try {
    serializedLength = JSON.stringify(input)?.length ?? 0;
  } catch {
    issues.push({ code: 'SECURITY_ERR_VALIDATION', path: '$', message: 'payload is not serializable' });
  }
  if (serializedLength !== null && serializedLength > SECURITY_LIMITS.MAX_INPUT_BYTES) {
    issues.push({
      code: 'SECURITY_ERR_SIZE',
      path: '$',
      message: `payload is ${serializedLength} bytes; limit is ${SECURITY_LIMITS.MAX_INPUT_BYTES}`,
    });
  }

  const depth = measureDepth(input, new Set(), issues, '$');
  if (depth > SECURITY_LIMITS.MAX_EVIDENCE_DEPTH) {
    issues.push({
      code: 'SECURITY_ERR_DEPTH',
      path: '$',
      message: `payload depth ${depth} exceeds limit ${SECURITY_LIMITS.MAX_EVIDENCE_DEPTH}`,
    });
  }

  const items: ValidatedEvidenceItem[] = [];
  input.forEach((rawItem, index) => {
    const path = `$[${index}]`;
    if (!isPlainObject(rawItem)) {
      issues.push({ code: 'SECURITY_ERR_VALIDATION', path, message: 'item must be a plain object' });
      return;
    }
    const id = rawItem.id;
    if (typeof id !== 'string' || id.length === 0 || id.length > SECURITY_LIMITS.MAX_ID_LENGTH) {
      issues.push({
        code: 'SECURITY_ERR_VALIDATION',
        path: `${path}.id`,
        message: 'id must be a non-empty string within the length limit',
      });
    }
    let nonce: string | null = null;
    const rawNonce = rawItem.nonce;
    if (rawNonce !== undefined && rawNonce !== null) {
      if (typeof rawNonce !== 'string' || rawNonce.length === 0 || rawNonce.length > SECURITY_LIMITS.MAX_ID_LENGTH) {
        issues.push({
          code: 'SECURITY_ERR_VALIDATION',
          path: `${path}.nonce`,
          message: 'nonce must be a non-empty string within the length limit',
        });
      } else {
        nonce = rawNonce;
      }
    }
    let timestamp: string | number | null = null;
    const rawTimestamp = rawItem.timestamp;
    if (rawTimestamp !== undefined && rawTimestamp !== null) {
      if (
        (typeof rawTimestamp !== 'string' || rawTimestamp.length === 0) &&
        !(typeof rawTimestamp === 'number' && Number.isFinite(rawTimestamp))
      ) {
        issues.push({
          code: 'SECURITY_ERR_VALIDATION',
          path: `${path}.timestamp`,
          message: 'timestamp must be a non-empty string or a finite number',
        });
      } else {
        timestamp = rawTimestamp;
      }
    }
    items.push({
      id: typeof id === 'string' ? id : '',
      nonce,
      timestamp,
      costMicros: readNonNegativeFiniteNumber(rawItem, 'costMicros', path, issues),
      tokenCount: readNonNegativeFiniteNumber(rawItem, 'tokenCount', path, issues),
    });
  });

  if (issues.length > 0) {
    return validationFailure(issues);
  }

  const totals: BudgetTotals = Object.freeze({
    costMicros: items.reduce((sum, item) => sum + item.costMicros, 0),
    tokenCount: items.reduce((sum, item) => sum + item.tokenCount, 0),
  });
  return ok(Object.freeze({ items: Object.freeze(items), totals }));
}

/**
 * Replay detection: rejects batches containing duplicate evidence ids,
 * duplicate nonces, or duplicate (id, timestamp) pairs. Items must already
 * have passed {@link validateEvidenceBatch}.
 */
export function checkReplay(batch: ValidatedBatch): Result<ValidatedBatch> {
  const issues: ValidationIssue[] = [];
  const seenIds = new Map<string, number>();
  const seenNonces = new Map<string, number>();
  const seenPairs = new Map<string, number>();
  batch.items.forEach((item, index) => {
    const firstIndex = seenIds.get(item.id);
    if (firstIndex !== undefined) {
      issues.push({
        code: 'SECURITY_ERR_REPLAY',
        path: `$[${index}].id`,
        message: `duplicate evidence id "${item.id}" (first seen at index ${firstIndex})`,
      });
    } else {
      seenIds.set(item.id, index);
    }
    if (item.nonce !== null) {
      const nonceFirst = seenNonces.get(item.nonce);
      if (nonceFirst !== undefined) {
        issues.push({
          code: 'SECURITY_ERR_REPLAY',
          path: `$[${index}].nonce`,
          message: `duplicate nonce "${item.nonce}" (first seen at index ${nonceFirst})`,
        });
      } else {
        seenNonces.set(item.nonce, index);
      }
    }
    if (item.timestamp !== null) {
      const pairKey = `${item.id}@${String(item.timestamp)}`;
      const pairFirst = seenPairs.get(pairKey);
      if (pairFirst !== undefined) {
        issues.push({
          code: 'SECURITY_ERR_REPLAY',
          path: `$[${index}]`,
          message: `duplicate evidence id + timestamp pair "${pairKey}" (first seen at index ${pairFirst})`,
        });
      } else {
        seenPairs.set(pairKey, index);
      }
    }
  });
  if (issues.length > 0) {
    return fail(new SecurityError('SECURITY_ERR_REPLAY', 'replay detected in evidence batch', issues));
  }
  return ok(batch);
}

/**
 * Budget enforcement: rejects batches where any item exceeds the per-item
 * caps or where the aggregate totals exceed the total caps. The failing
 * batch is never returned — no partial output.
 */
export function checkBudget(batch: ValidatedBatch, cap: EvidenceBudgetCap): Result<ValidatedBatch> {
  const issues: ValidationIssue[] = [];
  batch.items.forEach((item, index) => {
    if (item.costMicros > cap.maxItemCostMicros) {
      issues.push({
        code: 'SECURITY_ERR_BUDGET',
        path: `$[${index}].costMicros`,
        message: `item cost ${item.costMicros} exceeds per-item cap ${cap.maxItemCostMicros}`,
      });
    }
    if (item.tokenCount > cap.maxItemTokens) {
      issues.push({
        code: 'SECURITY_ERR_BUDGET',
        path: `$[${index}].tokenCount`,
        message: `item tokens ${item.tokenCount} exceed per-item cap ${cap.maxItemTokens}`,
      });
    }
  });
  if (batch.totals.costMicros > cap.maxTotalCostMicros) {
    issues.push({
      code: 'SECURITY_ERR_BUDGET',
      path: '$.totals.costMicros',
      message: `total cost ${batch.totals.costMicros} exceeds total cap ${cap.maxTotalCostMicros}`,
    });
  }
  if (batch.totals.tokenCount > cap.maxTotalTokens) {
    issues.push({
      code: 'SECURITY_ERR_BUDGET',
      path: '$.totals.tokenCount',
      message: `total tokens ${batch.totals.tokenCount} exceed total cap ${cap.maxTotalTokens}`,
    });
  }
  if (issues.length > 0) {
    return fail(new SecurityError('SECURITY_ERR_BUDGET', 'budget cap exceeded', issues));
  }
  return ok(batch);
}
