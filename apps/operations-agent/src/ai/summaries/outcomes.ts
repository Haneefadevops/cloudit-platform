/**
 * Closed outcome codes for the summaries/answers service (mirrors the
 * shadow-mode adapter's AiOutcomeCode union). Every failure mode collapses
 * to the deterministic fallback with costEur 0; codes are the only machine
 * readable reason ever recorded — never raw errors or model text.
 */

import { LlmError } from '../llm';

export type SummariesOutcomeCode =
  | 'AI_ACCEPTED'
  | 'AI_DISABLED'
  | 'BUDGET_DENIED'
  | 'LLM_TIMEOUT'
  | 'LLM_RATE_LIMITED'
  | 'LLM_SERVER_ERROR'
  | 'LLM_REFUSED'
  | 'LLM_NETWORK_ERROR'
  | 'LLM_INVALID_RESPONSE'
  | 'LLM_MALFORMED_JSON'
  | 'LLM_INVALID_ASSESSMENT'
  | 'LLM_CONTRADICTS_DETERMINISTIC'
  | 'LLM_SECRET_CANARY'
  | 'UNEXPECTED_ERROR';

/** Internal control-flow signal; carries a safe outcome code, never raw text. */
export class SummariesAborted extends Error {
  constructor(readonly outcome: Exclude<SummariesOutcomeCode, 'AI_ACCEPTED'>) {
    super(outcome);
    this.name = 'SummariesAborted';
  }
}

/** Map an arbitrary thrown value to a closed, safe outcome code. */
export function outcomeOf(error: unknown): Exclude<SummariesOutcomeCode, 'AI_ACCEPTED'> {
  if (error instanceof LlmError) {
    switch (error.code) {
      case 'timeout':
        return 'LLM_TIMEOUT';
      case 'rate_limited':
        return 'LLM_RATE_LIMITED';
      case 'server':
        return 'LLM_SERVER_ERROR';
      case 'refused':
        return 'LLM_REFUSED';
      case 'network':
        return 'LLM_NETWORK_ERROR';
      case 'invalid_response':
        return 'LLM_INVALID_RESPONSE';
    }
  }
  if (error instanceof SummariesAborted) return error.outcome;
  return 'UNEXPECTED_ERROR';
}

/** Closed, safe audit record for one getExplanation() invocation. No raw errors. */
export interface SummariesAuditEvent {
  eventType: 'ai_explanation';
  actor: 'agent:summaries';
  occurredAt: string;
  /** Safe machine-readable outcome code. */
  reasonCode: SummariesOutcomeCode;
  resultCode: 'AI_ACCEPTED' | 'AI_FALLBACK_DETERMINISTIC';
  /** Fixed bounded template; never contains model free text or errors. */
  summary: string;
  evidenceKeys: string[];
  model: string;
  fallback: boolean;
  tokensIn: number;
  tokensOut: number;
  costEur: number;
}
