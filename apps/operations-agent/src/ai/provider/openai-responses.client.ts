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
 */

import {
  AUTOMATION_ELIGIBILITIES,
  CONFIDENCE_LEVELS,
  EVIDENCE_KEYS_MAX_ITEMS,
  HEALTH_STATUSES,
  HealthAssessment,
  SHORT_CODE_MAX_LENGTH,
  SUMMARY_MAX_LENGTH,
} from '@cloudit/operations-agent-contracts';
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

const DEFAULT_BASE_URL = 'https://api.openai.com';
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 0;

const RETRYABLE_CODES: ReadonlySet<string> = new Set(['server', 'network']);

/**
 * Provider-side structured-output hint mirroring the closed
 * {@link HealthAssessment} contract (operator-plan 8.1). The server-side
 * `validateHealthAssessment` remains the authority; this schema only steers
 * the provider's strict json_schema mode toward the right property names.
 */
const HEALTH_ASSESSMENT_JSON_SCHEMA: Readonly<Record<string, unknown>> = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: Object.freeze({
    assessment: Object.freeze({ type: 'string', enum: [...HEALTH_STATUSES] }),
    summary: Object.freeze({ type: 'string', maxLength: SUMMARY_MAX_LENGTH }),
    evidenceKeys: Object.freeze({
      type: 'array',
      maxItems: EVIDENCE_KEYS_MAX_ITEMS,
      items: Object.freeze({ type: 'string' }),
    }),
    confidence: Object.freeze({ type: 'string', enum: [...CONFIDENCE_LEVELS] }),
    issueCode: Object.freeze({ type: 'string', maxLength: SHORT_CODE_MAX_LENGTH }),
    recommendedRunbook: Object.freeze({ type: 'string', maxLength: SHORT_CODE_MAX_LENGTH }),
    automationEligibility: Object.freeze({ type: 'string', enum: [...AUTOMATION_ELIGIBILITIES] }),
  }),
  required: Object.freeze([
    'assessment',
    'summary',
    'evidenceKeys',
    'confidence',
    'issueCode',
    'recommendedRunbook',
    'automationEligibility',
  ]),
});

function isTokenCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

interface ResponsesOutputText {
  readonly type: string;
  readonly text?: unknown;
}

interface ResponsesOutputItem {
  readonly type?: unknown;
  readonly content?: unknown;
}

function parseResponsesPayload(payload: unknown): LlmResponse {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw new LlmError('invalid_response');
  }
  const body = payload as Record<string, unknown>;

  const output = body.output;
  if (!Array.isArray(output)) {
    throw new LlmError('invalid_response');
  }
  const texts: string[] = [];
  for (const item of output as ResponsesOutputItem[]) {
    if (typeof item !== 'object' || item === null || item.type !== 'message') continue;
    if (!Array.isArray(item.content)) continue;
    for (const part of item.content as ResponsesOutputText[]) {
      if (typeof part !== 'object' || part === null) continue;
      if (part.type === 'output_text' && typeof part.text === 'string') {
        texts.push(part.text);
      }
    }
  }
  const text = texts.join('');
  if (text.length === 0) {
    throw new LlmError('invalid_response');
  }

  const usage = body.usage;
  if (typeof usage !== 'object' || usage === null || Array.isArray(usage)) {
    throw new LlmError('invalid_response');
  }
  const { input_tokens: inputTokens, output_tokens: outputTokens } = usage as Record<string, unknown>;
  if (!isTokenCount(inputTokens) || !isTokenCount(outputTokens)) {
    throw new LlmError('invalid_response');
  }
  return { text, inputTokens, outputTokens };
}

export class OpenAiResponsesLlmClient implements LlmClient {
  private readonly baseUrl: string;
  private readonly requestTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: OpenAiResponsesClientOptions) {
    if (!options.apiKey || options.apiKey.length < 8) {
      throw new LlmError('refused', 'provider client requires an injected API key');
    }
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async complete(request: LlmRequest): Promise<LlmResponse> {
    const attempts = this.maxRetries + 1;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await this.attemptOnce(request);
      } catch (error) {
        // Only typed, token-free failures leave this client; anything
        // unexpected is collapsed to a fixed message so no provider or
        // key material can leak through a raw error.
        const mapped = error instanceof LlmError ? error : new LlmError('network');
        if (attempt >= attempts || !RETRYABLE_CODES.has(mapped.code)) {
          throw mapped;
        }
      }
    }
    // Unreachable: the loop always returns or throws.
    throw new LlmError('network');
  }

  private async attemptOnce(request: LlmRequest): Promise<LlmResponse> {
    const controller = new AbortController();
    const fetchPromise = this.fetchImpl(`${this.baseUrl}/v1/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.buildBody(request)),
      signal: controller.signal,
    });
    // Keep the losing side of the race from surfacing as an unhandled
    // rejection when the timeout wins.
    void fetchPromise.catch(() => undefined);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new LlmError('timeout'));
      }, this.requestTimeoutMs);
      timer.unref?.();
    });

    let response: Response;
    try {
      response = await Promise.race([fetchPromise, timeout]);
    } catch (error) {
      if (error instanceof LlmError) throw error;
      if (controller.signal.aborted || isAbortError(error)) throw new LlmError('timeout');
      throw new LlmError('network');
    } finally {
      if (timer) clearTimeout(timer);
    }

    if (!response.ok) {
      // Status-only mapping: the provider error body is never read, so no
      // provider text (which could echo request material) can leak.
      if (response.status === 429) throw new LlmError('rate_limited');
      if (response.status >= 500 && response.status <= 599) throw new LlmError('server');
      throw new LlmError('refused');
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new LlmError('invalid_response');
    }
    return parseResponsesPayload(payload);
  }

  private buildBody(request: LlmRequest): Record<string, unknown> {
    return {
      model: request.model,
      store: false,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: request.system }] },
        { role: 'user', content: [{ type: 'input_text', text: request.input }] },
      ],
      max_output_tokens: request.maxOutputTokens,
      text: this.buildTextFormat(request),
    };
  }

  /**
   * Structured output is per-request, not global: the explanation flow asks
   * for the closed health-assessment schema, free-text chat explicitly asks
   * for plain text (a global schema once forced chat answers into raw
   * assessment JSON — chat-bind bugfix). The default preserves the
   * explanation behavior for every existing caller.
   */
  private buildTextFormat(request: LlmRequest): Record<string, unknown> {
    if (request.responseFormat === 'plain_text') {
      return { format: { type: 'text' } };
    }
    return {
      format: {
        type: 'json_schema',
        name: 'health_assessment',
        strict: true,
        schema: HEALTH_ASSESSMENT_JSON_SCHEMA,
      },
    };
  }
}
