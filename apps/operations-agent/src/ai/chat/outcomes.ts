/**
 * Closed outcome codes for the chat engine (mirrors summaries/outcomes.ts).
 * Every failure mode collapses to a deterministic, caller-safe answer with
 * costEur 0; codes are the only machine-readable reason ever recorded —
 * never raw errors or model text.
 */

import { LlmError } from '../llm';

export type ChatOutcomeCode =
  | 'AI_ACCEPTED'
  | 'AI_DISABLED'
  | 'BUDGET_DENIED'
  | 'LLM_TIMEOUT'
  | 'LLM_RATE_LIMITED'
  | 'LLM_SERVER_ERROR'
  | 'LLM_REFUSED'
  | 'LLM_NETWORK_ERROR'
  | 'LLM_INVALID_RESPONSE'
  | 'LLM_EMPTY_RESPONSE'
  | 'LLM_OVERSIZED_RESPONSE'
  | 'LLM_SECRET_CANARY'
  | 'UNEXPECTED_ERROR';

/** Internal control-flow signal; carries a safe outcome code, never raw text. */
export class ChatAborted extends Error {
  constructor(readonly outcome: Exclude<ChatOutcomeCode, 'AI_ACCEPTED'>) {
    super(outcome);
    this.name = 'ChatAborted';
  }
}

/** Map an arbitrary thrown value to a closed, safe outcome code. */
export function outcomeOf(error: unknown): Exclude<ChatOutcomeCode, 'AI_ACCEPTED'> {
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
  if (error instanceof ChatAborted) return error.outcome;
  return 'UNEXPECTED_ERROR';
}

/** Closed, safe audit record for one ask() invocation. No raw errors or model text. */
export interface ChatAuditEvent {
  eventType: 'ai_chat';
  actor: 'agent:chat';
  occurredAt: string;
  /** Safe machine-readable outcome code. */
  reasonCode: ChatOutcomeCode;
  resultCode: 'AI_ACCEPTED' | 'AI_FALLBACK_DETERMINISTIC';
  /** Fixed bounded template; never contains model free text or errors. */
  summary: string;
  /** Bounded opaque conversation correlation key (chatId:userId), truncated. */
  userKey: string;
  /** Chat performs no evidence lookups; always empty, kept for schema parity. */
  evidenceKeys: string[];
  model: string;
  fallback: boolean;
  tokensIn: number;
  tokensOut: number;
  costEur: number;
}
