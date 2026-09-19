/**
 * SanitizedEvidenceProjection - the ONLY evidence shape the maintenance
 * supervisor reads (operator-plan sections 4.1 and 11.2).
 *
 * The projection is an allowlisted, closed-schema view produced upstream from
 * sanitized evidence. The supervisor treats every value as untrusted input at
 * its boundary: validation is fail-closed and rejects, with
 * ValidationResult-style errors (never throws):
 *   - fields outside the closed allowlist,
 *   - source keys outside the known catalogue,
 *   - malformed timestamps / enums / counts,
 *   - tenant (client) or environment identifiers on a record that do not
 *     match the projection's declared client/environment,
 *   - duplicate source keys.
 *
 * Only safe, bounded fields cross this boundary: no raw provider responses,
 * no payloads, no secrets. Text is length- and control-character-checked
 * here; URL/HTML/token stripping is applied upstream by the platform
 * sanitization layer (Worker C).
 */

import {
  CONTROL_CHARACTER_PATTERN,
  ENVIRONMENT_KEY_PATTERN,
  isMember,
  SEVERITIES,
  Severity,
  SUMMARY_MAX_LENGTH,
  ValidationResult,
} from '@cloudit/operations-agent-contracts';

export const EVIDENCE_SOURCE_STATUSES = ['OK', 'DEGRADED', 'FAILED', 'UNKNOWN'] as const;
export type EvidenceSourceStatus = (typeof EVIDENCE_SOURCE_STATUSES)[number];

export const SOURCE_CRITICALITIES = ['required', 'optional', 'analytics'] as const;
export type SourceCriticality = (typeof SOURCE_CRITICALITIES)[number];

export const PROJECTION_MAX_RECORDS = 50;
export const EVIDENCE_COUNTS_MAX_KEYS = 20;

const CLIENT_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const EVIDENCE_COUNT_KEY_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    ISO_TIMESTAMP_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function describeKind(input: unknown): string {
  if (input === null) return 'null';
  if (Array.isArray(input)) return 'array';
  return typeof input;
}

/** One allowlisted evidence record for a single monitored source. */
export interface EvidenceSourceRecord {
  /** Must be a member of the known source-key catalogue. */
  sourceKey: string;
  /** Closed status enum for the source at observation time. */
  status: EvidenceSourceStatus;
  /** Source-declared severity; 'critical' marks a confirmed live failure. */
  severity: Severity;
  /** ISO-8601 timestamp of the observation. */
  observedAt: string;
  /** ISO-8601 timestamp until which the observation is considered fresh. */
  freshUntil: string;
  /** Whether this source is required for a trustworthy verdict. */
  criticality: SourceCriticality;
  /** Bounded, pre-sanitized human summary (max 1000 chars, no control chars). */
  safeSummary: string;
  /** Small bag of non-negative integer counters with bounded key shapes. */
  counts: Record<string, number>;
  /** Optional tenant identifier; must equal the projection client if present. */
  client?: string;
  /** Optional environment identifier; must equal projection environment. */
  environment?: string;
}

/**
 * The deterministic, closed-schema projection the supervisor evaluates.
 * `client` is the tenant identifier, `environment` the environment key; a
 * record carrying a different identifier is a boundary violation and fails
 * the whole projection closed.
 */
export interface SanitizedEvidenceProjection {
  client: string;
  environment: string;
  records: EvidenceSourceRecord[];
}

const PROJECTION_FIELDS = ['client', 'environment', 'records'] as const;
const RECORD_FIELDS = [
  'sourceKey',
  'status',
  'severity',
  'observedAt',
  'freshUntil',
  'criticality',
  'safeSummary',
  'counts',
  'client',
  'environment',
] as const;

function isPlainObject(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}

function validateCounts(path: string, raw: unknown, errors: string[]): void {
  if (!isPlainObject(raw)) {
    errors.push(`${path}: expected an object of counters, received ${describeKind(raw)}`);
    return;
  }
  const keys = Object.keys(raw);
  if (keys.length > EVIDENCE_COUNTS_MAX_KEYS) {
    errors.push(`${path}: exceeds maximum key count ${EVIDENCE_COUNTS_MAX_KEYS}`);
    return;
  }
  for (const key of keys) {
    if (!EVIDENCE_COUNT_KEY_PATTERN.test(key)) {
      errors.push(`${path}.${key}: counter key does not match ${EVIDENCE_COUNT_KEY_PATTERN}`);
      continue;
    }
    const value: unknown = raw[key];
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
      errors.push(`${path}.${key}: expected a non-negative integer`);
    }
  }
}

function validateRecord(
  path: string,
  raw: unknown,
  knownSourceKeys: ReadonlySet<string>,
  projection: { client: string; environment: string },
  errors: string[],
): EvidenceSourceRecord | undefined {
  if (!isPlainObject(raw)) {
    errors.push(`${path}: expected an object, received ${describeKind(raw)}`);
    return undefined;
  }
  for (const key of Object.keys(raw)) {
    if (!(RECORD_FIELDS as readonly string[]).includes(key)) {
      errors.push(`${path}.${key}: unknown field (schema is closed)`);
    }
  }

  const record: Record<string, unknown> = {};
  let valid = true;
  const fail = (message: string): void => {
    errors.push(message);
    valid = false;
  };

  const sourceKey = raw.sourceKey;
  if (typeof sourceKey !== 'string' || sourceKey.length === 0) {
    fail(`${path}.sourceKey: expected a non-empty string`);
  } else if (!knownSourceKeys.has(sourceKey)) {
    fail(`${path}.sourceKey: "${sourceKey}" is not a known evidence source`);
  } else {
    record.sourceKey = sourceKey;
  }

  if (!isMember(raw.status, EVIDENCE_SOURCE_STATUSES)) {
    fail(`${path}.status: expected one of [${EVIDENCE_SOURCE_STATUSES.join(', ')}]`);
  } else {
    record.status = raw.status;
  }

  if (!isMember(raw.severity, SEVERITIES)) {
    fail(`${path}.severity: expected one of [${SEVERITIES.join(', ')}]`);
  } else {
    record.severity = raw.severity;
  }

  if (!isIsoTimestamp(raw.observedAt)) {
    fail(`${path}.observedAt: not a valid ISO-8601 timestamp`);
  } else {
    record.observedAt = raw.observedAt;
  }

  if (!isIsoTimestamp(raw.freshUntil)) {
    fail(`${path}.freshUntil: not a valid ISO-8601 timestamp`);
  } else {
    record.freshUntil = raw.freshUntil;
  }

  if (
    typeof raw.observedAt === 'string' &&
    typeof raw.freshUntil === 'string' &&
    isIsoTimestamp(raw.observedAt) &&
    isIsoTimestamp(raw.freshUntil) &&
    Date.parse(raw.observedAt) > Date.parse(raw.freshUntil)
  ) {
    fail(`${path}: observedAt must not be after freshUntil`);
  }

  if (!isMember(raw.criticality, SOURCE_CRITICALITIES)) {
    fail(`${path}.criticality: expected one of [${SOURCE_CRITICALITIES.join(', ')}]`);
  } else {
    record.criticality = raw.criticality;
  }

  if (typeof raw.safeSummary !== 'string') {
    fail(`${path}.safeSummary: expected string, received ${describeKind(raw.safeSummary)}`);
  } else if (CONTROL_CHARACTER_PATTERN.test(raw.safeSummary)) {
    fail(`${path}.safeSummary: control characters are not allowed`);
  } else if (raw.safeSummary.length > SUMMARY_MAX_LENGTH) {
    fail(`${path}.safeSummary: exceeds maximum length ${SUMMARY_MAX_LENGTH}`);
  } else {
    record.safeSummary = raw.safeSummary;
  }

  const countsBefore = errors.length;
  validateCounts(`${path}.counts`, raw.counts, errors);
  if (errors.length === countsBefore && isPlainObject(raw.counts)) {
    record.counts = raw.counts;
  } else if (raw.counts !== undefined) {
    valid = false;
  }

  for (const identifier of ['client', 'environment'] as const) {
    const value: unknown = raw[identifier];
    if (value === undefined) continue;
    const declared = projection[identifier];
    if (typeof value !== 'string' || value.length === 0) {
      fail(`${path}.${identifier}: expected a non-empty string`);
    } else if (identifier === 'client' && !CLIENT_KEY_PATTERN.test(value)) {
      fail(`${path}.client: does not match ${CLIENT_KEY_PATTERN}`);
    } else if (identifier === 'environment' && !ENVIRONMENT_KEY_PATTERN.test(value)) {
      fail(`${path}.environment: does not match ${ENVIRONMENT_KEY_PATTERN}`);
    } else if (value !== declared) {
      fail(`${path}.${identifier}: identifier does not match the projection's declared ${identifier}`);
    } else {
      record[identifier] = value;
    }
  }

  return valid ? (record as unknown as EvidenceSourceRecord) : undefined;
}

/**
 * Fail-closed validator for SanitizedEvidenceProjection. Never throws; returns
 * { ok: true, value } only for a fully allowlist-conforming projection.
 */
export function validateEvidenceProjection(
  input: unknown,
  knownSourceKeys: ReadonlySet<string>,
): ValidationResult<SanitizedEvidenceProjection> {
  if (!isPlainObject(input)) {
    return {
      ok: false,
      errors: [`SanitizedEvidenceProjection: expected an object, received ${describeKind(input)}`],
    };
  }
  for (const key of Object.keys(input)) {
    if (!(PROJECTION_FIELDS as readonly string[]).includes(key)) {
      return {
        ok: false,
        errors: [`SanitizedEvidenceProjection.${key}: unknown field (schema is closed)`],
      };
    }
  }

  const errors: string[] = [];
  const client = input.client;
  if (typeof client !== 'string' || !CLIENT_KEY_PATTERN.test(client)) {
    errors.push(`SanitizedEvidenceProjection.client: expected a tenant identifier matching ${CLIENT_KEY_PATTERN}`);
  }
  const environment = input.environment;
  if (typeof environment !== 'string' || !ENVIRONMENT_KEY_PATTERN.test(environment)) {
    errors.push(`SanitizedEvidenceProjection.environment: expected an environment key matching ${ENVIRONMENT_KEY_PATTERN}`);
  }
  if (errors.length > 0) return { ok: false, errors };

  const declared = { client: client as string, environment: environment as string };

  if (!Array.isArray(input.records)) {
    return {
      ok: false,
      errors: [`SanitizedEvidenceProjection.records: expected an array, received ${describeKind(input.records)}`],
    };
  }
  if (input.records.length > PROJECTION_MAX_RECORDS) {
    return {
      ok: false,
      errors: [`SanitizedEvidenceProjection.records: exceeds maximum record count ${PROJECTION_MAX_RECORDS}`],
    };
  }

  const seen = new Set<string>();
  const records: EvidenceSourceRecord[] = [];
  let valid = true;
  for (let i = 0; i < input.records.length; i += 1) {
    const path = `SanitizedEvidenceProjection.records[${i}]`;
    const raw: unknown = input.records[i];
    const before = errors.length;
    const record = validateRecord(path, raw, knownSourceKeys, declared, errors);
    if (errors.length === before && record) {
      if (seen.has(record.sourceKey)) {
        errors.push(`${path}.sourceKey: duplicate source key "${record.sourceKey}"`);
        valid = false;
      } else {
        seen.add(record.sourceKey);
        records.push(record);
      }
    } else {
      valid = false;
    }
  }

  if (!valid || errors.length > 0) return { ok: false, errors };
  return { ok: true, value: { ...declared, records } };
}
