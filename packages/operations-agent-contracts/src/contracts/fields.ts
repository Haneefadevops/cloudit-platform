/**
 * Shared bounded-key field specs used across multiple contracts.
 *
 * Structural validation only: charset patterns + length caps +
 * control-character absence. The issue-code, runbook and event catalogues
 * are Phase A/coordinator deliverables; until they are fixed we validate
 * shape, never membership. Text-policy sanitization (URL/email/token
 * stripping) is Worker C's src/security and is applied upstream.
 */

import {
  ENVIRONMENT_KEY_MAX_LENGTH,
  FieldSpec,
  KEY_ID_MAX_LENGTH,
  requiredString,
  SHORT_CODE_MAX_LENGTH,
} from './validation';

export const ENVIRONMENT_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
export const KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
export const ISSUE_CODE_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
export const SAFE_CODE_PATTERN = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
export const RUNBOOK_REFERENCE_PATTERN = /^(?:none|RB-[A-Z0-9]+(?:-[A-Z0-9]+)*)$/;
export const RUNBOOK_KEY_PATTERN = /^RB-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
export const RUNBOOK_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
export const EVENT_TYPE_PATTERN = /^[a-z][a-z0-9_]*$/;
export const ACTOR_PATTERN = /^(?:system|agent|owner|controller)(?::[a-z0-9_-]+)?$/;

export const ENVIRONMENT_KEY_FIELD: FieldSpec = requiredString({
  pattern: ENVIRONMENT_KEY_PATTERN,
  maxLength: ENVIRONMENT_KEY_MAX_LENGTH,
});

export const KEY_ID_FIELD: FieldSpec = requiredString({
  pattern: KEY_ID_PATTERN,
  maxLength: KEY_ID_MAX_LENGTH,
});

export const ISSUE_CODE_FIELD: FieldSpec = requiredString({
  pattern: ISSUE_CODE_PATTERN,
  maxLength: SHORT_CODE_MAX_LENGTH,
});

export const SAFE_CODE_FIELD: FieldSpec = requiredString({
  pattern: SAFE_CODE_PATTERN,
  maxLength: SHORT_CODE_MAX_LENGTH,
});

/** 'none' or an approved runbook key (recommendations/assessments). */
export const RUNBOOK_REFERENCE_FIELD: FieldSpec = requiredString({
  pattern: RUNBOOK_REFERENCE_PATTERN,
  maxLength: SHORT_CODE_MAX_LENGTH,
});

/** Concrete runbook key only (repair requests must name a real runbook). */
export const RUNBOOK_KEY_FIELD: FieldSpec = requiredString({
  pattern: RUNBOOK_KEY_PATTERN,
  maxLength: SHORT_CODE_MAX_LENGTH,
});

export const RUNBOOK_VERSION_FIELD: FieldSpec = requiredString({
  pattern: RUNBOOK_VERSION_PATTERN,
  maxLength: 32,
});

export const EVENT_TYPE_FIELD: FieldSpec = requiredString({
  pattern: EVENT_TYPE_PATTERN,
  maxLength: SHORT_CODE_MAX_LENGTH,
});

export const ACTOR_FIELD: FieldSpec = requiredString({
  pattern: ACTOR_PATTERN,
  maxLength: SHORT_CODE_MAX_LENGTH,
});
