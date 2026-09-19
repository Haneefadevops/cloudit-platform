/**
 * Versioned contract envelope applied to every record that crosses a
 * module or persistence boundary.
 *
 * The envelope pins the contract version and record type so consumers can
 * fail closed on unknown versions/types instead of guessing. recordType is
 * a closed enum; contractVersion currently accepts only '1'. Payload
 * validation is delegated to the contract-specific validator.
 */

import {
  buildValidator,
  requiredAny,
  requiredEnum,
  requiredTimestamp,
  ValidationResult,
} from './validation';
import { ENVIRONMENT_KEY_FIELD } from './fields';

export const CONTRACT_VERSION = '1' as const;
export type ContractVersion = typeof CONTRACT_VERSION;

export const RECORD_TYPES = [
  'health_assessment',
  'finding',
  'recommendation',
  'repair_request',
  'audit_event',
] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export interface ContractEnvelope<TPayload = unknown> {
  contractVersion: ContractVersion;
  recordType: RecordType;
  emittedAt: string;
  environmentKey: string;
  payload: TPayload;
}

const ENVELOPE_HEAD_FIELDS = {
  contractVersion: requiredEnum([CONTRACT_VERSION]),
  recordType: requiredEnum(RECORD_TYPES),
  emittedAt: requiredTimestamp(),
  environmentKey: ENVIRONMENT_KEY_FIELD,
  payload: requiredAny(),
} as const;

interface EnvelopeHead {
  contractVersion: string;
  recordType: RecordType;
  emittedAt: string;
  environmentKey: string;
  payload: unknown;
}

const validateEnvelopeHead = buildValidator<EnvelopeHead>(
  'ContractEnvelope',
  ENVELOPE_HEAD_FIELDS,
);

/**
 * Builds an envelope validator pinned to one record type. The head is
 * validated first (closed fields, version, record type), then the payload
 * is validated by the supplied contract validator. Never throws.
 */
export function createEnvelopeValidator<TPayload>(
  recordType: RecordType,
  validatePayload: (input: unknown) => ValidationResult<TPayload>,
): (input: unknown) => ValidationResult<ContractEnvelope<TPayload>> {
  return (input: unknown): ValidationResult<ContractEnvelope<TPayload>> => {
    const head = validateEnvelopeHead(input);
    if (!head.ok) {
      return head;
    }
    if (head.value.recordType !== recordType) {
      return {
        ok: false,
        errors: [
          `ContractEnvelope.recordType: expected "${recordType}", received "${head.value.recordType}"`,
        ],
      };
    }
    const payload = validatePayload(head.value.payload);
    if (!payload.ok) {
      return { ok: false, errors: payload.errors.map((e) => `ContractEnvelope.payload: ${e}`) };
    }
    return {
      ok: true,
      value: {
        contractVersion: head.value.contractVersion as ContractVersion,
        recordType: head.value.recordType,
        emittedAt: head.value.emittedAt,
        environmentKey: head.value.environmentKey,
        payload: payload.value,
      },
    };
  };
}
