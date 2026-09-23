/**
 * OpenAI Responses API client — the real {@link LlmClient} HTTP
 * implementation (AI-brain phase, KIMI plan 7b Worker A).
 *
 * FROZEN PUBLIC SURFACE (coordinator skeleton). Worker A implements
 * `complete` behind this exact signature; Worker C writes blind evals
 * against it. Contract:
 *
 * - POST {baseUrl}/v1/responses, Bearer auth, `store: false`,
 *   `text.format.type: 'json_schema'` with strict structured output
 *   (operator-plan 8.1);
 * - bounded timeout via AbortController; at most `maxRetries` retries
 *   (default 0 = single attempt);
 * - token counting from the provider `usage` fields — total output tokens
 *   (reasoning tokens bill at the output rate on this generation);
 * - fixed error mapping, token-free: timeout/abort -> 'timeout',
 *   HTTP 429 -> 'rate_limited', HTTP 5xx -> 'server', transport failure ->
 *   'network', unusable/missing usage or body -> 'invalid_response';
 * - the key never appears in logs, errors, or thrown values; request and
 *   response bodies are never logged.
 *
 * Skeleton state: `complete` fails closed with `LlmError('refused')` until
 * Worker A lands the real implementation. No network in this state.
 */

import { LlmClient, LlmError, LlmRequest, LlmResponse } from '../llm';

export interface OpenAiResponsesClientOptions {
  /** Provider API key. Injected only; never logged or embedded in errors. */
  readonly apiKey: string;
  /** Fixed provider base URL. Default https://api.openai.com. */
  readonly baseUrl?: string;
  /** Bounded request timeout. Default 30_000 ms. */
  readonly requestTimeoutMs?: number;
  /** Maximum retries after the first attempt. Default 0. */
  readonly maxRetries?: number;
  /** Injectable fetch; tests always fake it — no real provider call in tests. */
  readonly fetchImpl?: typeof fetch;
}

export class OpenAiResponsesLlmClient implements LlmClient {
  constructor(private readonly options: OpenAiResponsesClientOptions) {
    if (!options.apiKey || options.apiKey.length < 8) {
      throw new LlmError('refused', 'provider client requires an injected API key');
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  complete(request: LlmRequest): Promise<LlmResponse> {
    // Skeleton: fail closed (same behavior as the previous app.module stub).
    // Worker A replaces this with the real Responses API call.
    return Promise.reject(new LlmError('refused'));
  }
}
