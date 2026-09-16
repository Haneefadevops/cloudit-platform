import { BadRequestException } from '@nestjs/common';
import { createHash, createHmac } from 'crypto';

export type ReportCommandType = 'APPROVE_AND_SEND' | 'REJECT' | 'RETRY_SEND';

// Recipient policy applied by n8n when executing APPROVE_AND_SEND / RETRY_SEND
// for the Cavetta monthly report; REJECT carries '-' (no delivery involved).
export const REPORT_RECIPIENT_POLICY_KEY = 'cavetta-monthly-report';

export type ReportCommandDenialCode =
  | 'denied_role'
  | 'rejected_replay'
  | 'rejected_expired'
  | 'rejected_stale_version'
  | 'rejected_state'
  | 'rejected_pdf_unavailable'
  | 'rejected_recipient_policy'
  | 'failed_safe';

export type ReportCommandAckCode =
  | 'acknowledged'
  | 'rejected_state'
  | 'rejected_stale_version'
  | 'rejected_pdf_unavailable'
  | 'rejected_recipient_policy'
  | 'failed_safe';

const COMMAND_KEY_PATTERN = /^[a-f0-9]{32}$/;
const CLIENT_KEY_PATTERN = /^[a-z0-9][a-z0-9_.-]{1,120}$/;
const NONCE_PATTERN = /^[a-f0-9]{64}$/;

// Control characters stripped from reject reasons: C0, DEL and C1
// ranges. The explicit control ranges are the whole point of the pattern.

// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F-\u009F]/g;

const ACK_CODES: readonly ReportCommandAckCode[] = [
  'acknowledged',
  'rejected_state',
  'rejected_stale_version',
  'rejected_pdf_unavailable',
  'rejected_recipient_policy',
  'failed_safe',
];

export function expectedStateForCommand(
  type: ReportCommandType,
): 'DRAFT' | 'SEND_FAILED' {
  return type === 'RETRY_SEND' ? 'SEND_FAILED' : 'DRAFT';
}

export function normalizeRejectReason(input: unknown): string | null {
  if (input === undefined || input === null || input === '') {
    return null;
  }
  if (typeof input !== 'string') {
    throw new BadRequestException('Invalid request');
  }
  const normalized = input
    .normalize('NFC')
    .replace(CONTROL_CHAR_PATTERN, '')
    .trim()
    .replace(/\s+/g, ' ');
  if (normalized.length === 0) {
    return null;
  }
  if (normalized.length > 300) {
    throw new BadRequestException('Invalid request');
  }
  return normalized;
}

export function rejectReasonDigest(normalized: string | null): string {
  return normalized === null
    ? '-'
    : createHash('sha256').update(normalized).digest('hex');
}

export interface ReportCommandCanonicalFields {
  commandKey: string;
  commandType: ReportCommandType;
  reportKey: string;
  clientKey: string;
  expectedRowVersion: number;
  expectedState: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  correlationId: string;
  recipientPolicyKey: string;
  reasonDigest: string;
}

export function buildReportCommandCanonical(
  fields: ReportCommandCanonicalFields,
): string {
  return [
    'v1',
    fields.commandKey,
    fields.commandType,
    fields.reportKey,
    fields.clientKey,
    String(fields.expectedRowVersion),
    fields.expectedState,
    fields.nonce,
    String(fields.issuedAt),
    String(fields.expiresAt),
    fields.correlationId,
    fields.recipientPolicyKey,
    fields.reasonDigest,
  ].join('\n');
}

export function signReportCommandCanonical(
  canonical: string,
  secret: string | undefined,
): string {
  if (!secret || secret.length < 32) {
    throw new BadRequestException('Invalid request');
  }
  return createHmac('sha256', secret).update(canonical).digest('hex');
}

export interface ReportCommandClaimBody {
  commandKey: string;
  clientKey: string;
  nonce: string;
}

export interface ReportCommandAckBody {
  commandKey: string;
  clientKey: string;
  resultCode: ReportCommandAckCode;
}

function readStringField(
  body: unknown,
  field: string,
  pattern: RegExp,
): string {
  const value =
    body !== null && typeof body === 'object'
      ? (body as Record<string, unknown>)[field]
      : undefined;
  if (typeof value !== 'string' || !pattern.test(value)) {
    throw new BadRequestException('Invalid request');
  }
  return value;
}

export function verifyReportCommandClaimBody(
  body: unknown,
): ReportCommandClaimBody {
  return {
    commandKey: readStringField(body, 'commandKey', COMMAND_KEY_PATTERN),
    clientKey: readStringField(body, 'clientKey', CLIENT_KEY_PATTERN),
    nonce: readStringField(body, 'nonce', NONCE_PATTERN),
  };
}

export function verifyReportCommandAckBody(
  body: unknown,
): ReportCommandAckBody {
  const commandKey = readStringField(body, 'commandKey', COMMAND_KEY_PATTERN);
  const clientKey = readStringField(body, 'clientKey', CLIENT_KEY_PATTERN);
  const resultCode = readStringField(
    body,
    'resultCode',
    /^[a-z_]+$/,
  ) as ReportCommandAckCode;
  if (!ACK_CODES.includes(resultCode)) {
    throw new BadRequestException('Invalid request');
  }
  return { commandKey, clientKey, resultCode };
}
