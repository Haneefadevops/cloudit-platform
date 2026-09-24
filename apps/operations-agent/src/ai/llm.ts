/**
 * LLM port types for the AI shadow-mode adapter (Phase E).
 *
 * Construction only: there is NO HTTP implementation here. The injected
 * {@link LlmClient} is a narrow structural port; the real provider call is a
 * later, separately gated piece and tests bind fakes. No network, no keys.
 */

export type LlmResponseFormat = 'plain_text' | 'health_assessment';

export interface LlmRequest {
  model: string;
  system: string;
  input: string;
  maxOutputTokens: number;
  /**
   * Response-shape steering for structured-output clients. 'health_assessment'
   * (the default) lets the provider apply the closed assessment JSON schema;
   * 'plain_text' forbids it so free-text surfaces (chat) get natural language.
   * Validation of the returned text stays with the caller either way.
   */
  responseFormat?: LlmResponseFormat;
}

export interface LlmResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export type LlmErrorCode =
  | 'timeout'
  | 'rate_limited'
  | 'server'
  | 'refused'
  | 'network'
  | 'invalid_response';

const DEFAULT_MESSAGES: Readonly<Record<LlmErrorCode, string>> = Object.freeze({
  timeout: 'LLM request timed out',
  rate_limited: 'LLM provider rate limit reached',
  server: 'LLM provider server error',
  refused: 'LLM request refused by provider',
  network: 'LLM network error',
  invalid_response: 'LLM response failed structural validation',
});

/** Typed, safe LLM failure. Carries a closed reason code, never raw internals. */
export class LlmError extends Error {
  readonly code: LlmErrorCode;

  constructor(code: LlmErrorCode, message?: string) {
    super(message ?? DEFAULT_MESSAGES[code]);
    this.name = 'LlmError';
    this.code = code;
    Object.freeze(this);
  }
}

/** Injected port. The real HTTP implementation is a later gated piece; tests use fakes. */
export interface LlmClient {
  complete(request: LlmRequest): Promise<LlmResponse>;
}
