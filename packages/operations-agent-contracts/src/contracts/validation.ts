/**
 * Fail-closed structural validation core for the AI Maintenance contracts.
 *
 * Boundary: this module performs STRUCTURAL validation only - shape, closed
 * field sets, closed enums, length/item caps, charset patterns, timestamp
 * shape and control-character absence. The full text-sanitization policy
 * (URL/email/token stripping, HTML removal) belongs to Worker C's
 * src/security and is applied upstream; validators here intentionally
 * enforce only length + control-character rules on text.
 *
 * Validators never throw on bad input. They return a discriminated result:
 *   { ok: true, value } | { ok: false, errors: string[] }
 */

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; errors: string[] };

/** C0 control characters and DEL. Structured output must not contain them. */
export const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;

export const SUMMARY_MAX_LENGTH = 1000;
export const EVIDENCE_KEYS_MAX_ITEMS = 50;
export const KEY_ID_MAX_LENGTH = 128;
export const SHORT_CODE_MAX_LENGTH = 64;
export const ENVIRONMENT_KEY_MAX_LENGTH = 64;

const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

export type FieldType =
  | 'string'
  | 'string[]'
  | 'integer'
  | 'number'
  | 'boolean'
  | 'timestamp'
  | 'any';

export interface FieldSpec {
  readonly type: FieldType;
  readonly required: boolean;
  /** Closed enum membership (strings only). */
  readonly enum?: readonly string[];
  /** Charset/prefix pattern for bounded key/code strings. */
  readonly pattern?: RegExp;
  readonly maxLength?: number;
  readonly minLength?: number;
  readonly maxItems?: number;
  readonly itemMaxLength?: number;
  readonly max?: number;
  readonly min?: number;
}

export type ObjectSpec = Readonly<Record<string, FieldSpec>>;

export const requiredString = (spec: Omit<FieldSpec, 'type' | 'required'> = {}): FieldSpec => ({
  type: 'string',
  required: true,
  ...spec,
});

export const requiredEnum = (
  members: readonly string[],
  spec: Omit<FieldSpec, 'type' | 'required' | 'enum'> = {},
): FieldSpec => ({ type: 'string', required: true, enum: members, ...spec });

export const requiredStringArray = (
  spec: Omit<FieldSpec, 'type' | 'required'> = {},
): FieldSpec => ({ type: 'string[]', required: true, ...spec });

export const requiredTimestamp = (): FieldSpec => ({ type: 'timestamp', required: true });

/** Pass-through field; the value is validated by its own contract validator. */
export const requiredAny = (): FieldSpec => ({ type: 'any', required: true });

export const SUMMARY_FIELD: FieldSpec = requiredString({
  maxLength: SUMMARY_MAX_LENGTH,
});

export const EVIDENCE_KEYS_FIELD: FieldSpec = requiredStringArray({
  maxItems: EVIDENCE_KEYS_MAX_ITEMS,
  itemMaxLength: KEY_ID_MAX_LENGTH,
});

function isPlainObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function describeKind(input: unknown): string {
  if (input === null) return 'null';
  if (Array.isArray(input)) return 'array';
  return typeof input;
}

function validateString(path: string, raw: unknown, spec: FieldSpec, errors: string[]): void {
  if (typeof raw !== 'string') {
    errors.push(`${path}: expected string, received ${describeKind(raw)}`);
    return;
  }
  if (CONTROL_CHARACTER_PATTERN.test(raw)) {
    errors.push(`${path}: control characters are not allowed`);
    return;
  }
  if (spec.maxLength !== undefined && raw.length > spec.maxLength) {
    errors.push(`${path}: exceeds maximum length ${spec.maxLength}`);
    return;
  }
  if (spec.minLength !== undefined && raw.length < spec.minLength) {
    errors.push(`${path}: below minimum length ${spec.minLength}`);
    return;
  }
  if (spec.pattern !== undefined && !spec.pattern.test(raw)) {
    errors.push(`${path}: does not match required pattern ${spec.pattern}`);
    return;
  }
  if (spec.enum !== undefined && !(spec.enum as readonly string[]).includes(raw)) {
    errors.push(`${path}: "${raw}" is not a member of the closed enum [${spec.enum.join(', ')}]`);
  }
}

function validateStringArray(path: string, raw: unknown, spec: FieldSpec, errors: string[]): void {
  if (!Array.isArray(raw)) {
    errors.push(`${path}: expected array of strings, received ${describeKind(raw)}`);
    return;
  }
  if (spec.maxItems !== undefined && raw.length > spec.maxItems) {
    errors.push(`${path}: exceeds maximum item count ${spec.maxItems}`);
    return;
  }
  for (let i = 0; i < raw.length; i += 1) {
    const item: unknown = raw[i];
    const itemPath = `${path}[${i}]`;
    if (typeof item !== 'string') {
      errors.push(`${itemPath}: expected string, received ${describeKind(item)}`);
      continue;
    }
    if (CONTROL_CHARACTER_PATTERN.test(item)) {
      errors.push(`${itemPath}: control characters are not allowed`);
      continue;
    }
    if (spec.itemMaxLength !== undefined && item.length > spec.itemMaxLength) {
      errors.push(`${itemPath}: exceeds maximum length ${spec.itemMaxLength}`);
    }
  }
}

function validateField(path: string, raw: unknown, spec: FieldSpec, errors: string[]): void {
  switch (spec.type) {
    case 'string':
      validateString(path, raw, spec, errors);
      return;
    case 'string[]':
      validateStringArray(path, raw, spec, errors);
      return;
    case 'boolean':
      if (typeof raw !== 'boolean') {
        errors.push(`${path}: expected boolean, received ${describeKind(raw)}`);
      }
      return;
    case 'integer':
    case 'number': {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        errors.push(`${path}: expected number, received ${describeKind(raw)}`);
        return;
      }
      if (spec.type === 'integer' && !Number.isInteger(raw)) {
        errors.push(`${path}: expected integer, received ${raw}`);
        return;
      }
      if (spec.min !== undefined && raw < spec.min) {
        errors.push(`${path}: below minimum ${spec.min}`);
      }
      if (spec.max !== undefined && raw > spec.max) {
        errors.push(`${path}: exceeds maximum ${spec.max}`);
      }
      return;
    }
    case 'timestamp': {
      if (typeof raw !== 'string') {
        errors.push(`${path}: expected ISO-8601 timestamp string, received ${describeKind(raw)}`);
        return;
      }
      if (!ISO_TIMESTAMP_PATTERN.test(raw) || Number.isNaN(Date.parse(raw))) {
        errors.push(`${path}: "${raw}" is not a valid ISO-8601 timestamp`);
      }
      return;
    }
    case 'any':
      return;
  }
}

/**
 * Builds a fail-closed object validator from a closed field spec.
 * Rejects: non-objects, unknown/extra fields, missing required fields,
 * wrong types, non-member enum values and oversized input. Never throws.
 */
export function buildValidator<T>(
  contractName: string,
  fields: ObjectSpec,
): (input: unknown) => ValidationResult<T> {
  return (input: unknown): ValidationResult<T> => {
    if (!isPlainObject(input)) {
      return {
        ok: false,
        errors: [`${contractName}: expected an object, received ${describeKind(input)}`],
      };
    }

    const errors: string[] = [];

    // Closed schema: any field not declared in the spec is rejected.
    for (const key of Object.keys(input)) {
      if (!(key in fields)) {
        errors.push(`${contractName}.${key}: unknown field (schema is closed)`);
      }
    }

    const output: Record<string, unknown> = {};
    let valid = true;
    for (const [name, spec] of Object.entries(fields)) {
      const raw: unknown = input[name];
      if (raw === undefined || raw === null) {
        if (spec.required) {
          errors.push(`${contractName}.${name}: missing required field`);
          valid = false;
        }
        continue;
      }
      const before = errors.length;
      validateField(`${contractName}.${name}`, raw, spec, errors);
      if (errors.length === before) {
        output[name] = raw;
      } else {
        valid = false;
      }
    }

    if (!valid || errors.length > 0) {
      return { ok: false, errors };
    }
    return { ok: true, value: output as unknown as T };
  };
}
