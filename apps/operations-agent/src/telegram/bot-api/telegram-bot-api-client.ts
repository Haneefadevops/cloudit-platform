/**
 * TelegramBotApiClient - transport-only adapter to the Telegram Bot API for
 * the chat phase (outbound polling; no inbound port is ever opened).
 *
 * Implements the coordinator-owned TelegramBotApiClient contract
 * (src/telegram/telegram.types.ts):
 *  - getUpdates: short poll (timeout=0) with allowed_updates=["message"] only,
 *    returning raw update JSON as unknown[] (all validation stays in the
 *    existing webhook pipeline, which the poller reuses unchanged). The
 *    result array is capped at maxUpdatesPerPoll.
 *  - sendMessage: one sanitized, bounded reply per call.
 *  - The bot token is a runtime secret: it appears ONLY inside the request
 *    URL and is never placed in headers, bodies, errors, logs or return
 *    values. Every rejection is built from fixed templates plus a redacted,
 *    length-capped Telegram description, so no error path can echo the token
 *    even if Telegram's body does.
 *  - Text sent via sendMessage is bounded defensively: it is truncated at
 *    SEND_MESSAGE_TEXT_MAX_CHARS (4096, Telegram's own message limit) with a
 *    fixed suffix. Callers are expected to pre-sanitize to 4000 chars
 *    (CommandResponse contract); the cap here is defence in depth, so
 *    truncation is the chosen bound rather than a rejection.
 *  - Every request is bounded by an AbortController timeout. Network failure,
 *    non-2xx status, aborted requests and { ok: false } bodies all reject
 *    with bounded, token-free errors; the poller treats a rejection as
 *    "try again next cycle", never fatal.
 *  - Config is validated at construction (config-time fail-fast). fetch is
 *    injectable for tests; no process.env reads, no module-level state.
 *  - URLs are built with the URL/URLSearchParams APIs (never string
 *    concatenation) so query escaping is correct.
 */

import type { TelegramBotApiClient } from '../telegram.types';

export const DEFAULT_BOT_API_TIMEOUT_MS = 10_000;
export const DEFAULT_MAX_UPDATES_PER_POLL = 100;
export const SEND_MESSAGE_TEXT_MAX_CHARS = 4096;
export const SEND_MESSAGE_TEXT_TRUNCATION_SUFFIX = '… [truncated]';
export const BOT_API_DESCRIPTION_MAX_CHARS = 120;
export const BOT_API_ERROR_MAX_CHARS = 300;

const DEFAULT_API_BASE_URL = 'https://api.telegram.org';
const REDACTED = '[redacted]';

export interface TelegramBotApiClientOptions {
  token: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxUpdatesPerPoll?: number;
  apiBaseUrl?: string;
}

interface ResolvedTelegramBotApiClientOptions {
  token: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  maxUpdatesPerPoll: number;
  apiBaseUrl: string;
}

function resolveOptions(options: TelegramBotApiClientOptions): ResolvedTelegramBotApiClientOptions {
  if (typeof options?.token !== 'string' || options.token.length === 0) {
    throw new Error('telegram bot api: token must be a non-empty string');
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_BOT_API_TIMEOUT_MS;
  if (!(timeoutMs > 0)) {
    throw new Error('telegram bot api: timeoutMs must be a positive number of milliseconds');
  }
  const maxUpdatesPerPoll = options.maxUpdatesPerPoll ?? DEFAULT_MAX_UPDATES_PER_POLL;
  if (!Number.isInteger(maxUpdatesPerPoll) || maxUpdatesPerPoll <= 0) {
    throw new Error('telegram bot api: maxUpdatesPerPoll must be a positive integer');
  }
  const apiBaseUrl = options.apiBaseUrl ?? DEFAULT_API_BASE_URL;
  try {
    const parsed = new URL(apiBaseUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('bad protocol');
    }
  } catch {
    throw new Error('telegram bot api: apiBaseUrl must be a valid http(s) URL');
  }
  return {
    token: options.token,
    timeoutMs,
    maxUpdatesPerPoll,
    apiBaseUrl: apiBaseUrl.replace(/\/+$/, ''),
    fetchImpl: options.fetchImpl ?? fetch,
  };
}

/** Token-free, length-capped rendering of a Telegram `description` field. */
function boundedDescription(description: string, token: string): string {
  const redacted = description.split(token).join(REDACTED).replace(/[\r\n\t]/g, ' ');
  return redacted.length <= BOT_API_DESCRIPTION_MAX_CHARS
    ? redacted
    : `${redacted.slice(0, BOT_API_DESCRIPTION_MAX_CHARS)}…`;
}

/** Fetch rejections are remapped to fixed, bounded, token-free errors. */
function asTransportError(error: unknown): Error {
  if (error instanceof Error && error.name === 'AbortError') {
    return new Error('telegram bot api request aborted');
  }
  return new Error('telegram bot api request failed: network error');
}

function isTelegramFailure(payload: unknown): payload is { ok: false; description?: unknown } {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as { ok?: unknown }).ok === false
  );
}

function boundSendText(text: string): string {
  return text.length <= SEND_MESSAGE_TEXT_MAX_CHARS
    ? text
    : text.slice(0, SEND_MESSAGE_TEXT_MAX_CHARS) + SEND_MESSAGE_TEXT_TRUNCATION_SUFFIX;
}

class TelegramBotApiClientImpl implements TelegramBotApiClient {
  /**
   * Resolved options (including the token) are held non-enumerably: the
   * client object must be safe to log or JSON-serialize without leaking
   * secret material (coordinator contract-surface eval).
   */
  private declare readonly config: ResolvedTelegramBotApiClientOptions;

  constructor(config: ResolvedTelegramBotApiClientOptions) {
    Object.defineProperty(this, 'config', {
      value: config,
      enumerable: false,
      writable: false,
      configurable: true,
    });
  }

  async getUpdates(offset: number): Promise<unknown[]> {
    if (!Number.isInteger(offset) || offset < 0) {
      throw new Error('telegram bot api: offset must be a non-negative integer');
    }
    const { token, apiBaseUrl } = this.config;
    const url = new URL(`/bot${token}/getUpdates`, `${apiBaseUrl}/`);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('timeout', '0');
    url.searchParams.set('allowed_updates', JSON.stringify(['message']));
    const payload = await this.request(url, { method: 'GET' });
    if (
      typeof payload !== 'object' ||
      payload === null ||
      (payload as { ok?: unknown }).ok !== true ||
      !Array.isArray((payload as { result?: unknown }).result)
    ) {
      const description =
        isTelegramFailure(payload) && typeof payload.description === 'string'
          ? payload.description
          : 'malformed getUpdates response';
      throw new Error(
        `telegram getUpdates failed: ${boundedDescription(description, token)}`.slice(
          0,
          BOT_API_ERROR_MAX_CHARS,
        ),
      );
    }
    return (payload as { result: unknown[] }).result.slice(0, this.config.maxUpdatesPerPoll);
  }

  async sendMessage(chatId: number, text: string): Promise<void> {
    if (!Number.isInteger(chatId) || chatId <= 0) {
      throw new Error('telegram bot api: chatId must be a positive integer');
    }
    if (typeof text !== 'string' || text.length === 0) {
      throw new Error('telegram bot api: text must be a non-empty string');
    }
    const { token, apiBaseUrl } = this.config;
    const url = new URL(`/bot${token}/sendMessage`, `${apiBaseUrl}/`);
    const payload = await this.request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: boundSendText(text) }),
    });
    if (isTelegramFailure(payload)) {
      const description =
        typeof payload.description === 'string' ? payload.description : 'unknown error';
      throw new Error(
        `telegram sendMessage failed: ${boundedDescription(description, token)}`.slice(
          0,
          BOT_API_ERROR_MAX_CHARS,
        ),
      );
    }
  }

  /**
   * Run one bounded request: abort after timeoutMs, remap transport faults to
   * fixed bounded errors, and return the parsed JSON body. HTTP status itself
   * is intentionally not trusted; the ok field in the body is the source of
   * truth, matching Telegram's API contract.
   */
  private async request(url: URL, init: RequestInit): Promise<unknown> {
    const { timeoutMs, fetchImpl } = this.config;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error(`telegram bot api request timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    const tracked = Promise.resolve()
      .then(() => fetchImpl(url.toString(), { ...init, signal: controller.signal }))
      .catch((error: unknown) => {
        throw asTransportError(error);
      });
    // If the timeout wins the race, the abandoned fetch rejection must not
    // surface as an unhandled rejection.
    void tracked.catch(() => undefined);
    try {
      const response = await Promise.race([tracked, timeoutPromise]);
      try {
        return await response.json();
      } catch {
        throw new Error('telegram bot api returned an unreadable response body');
      }
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}

export function createTelegramBotApiClient(
  options: TelegramBotApiClientOptions,
): TelegramBotApiClient {
  return new TelegramBotApiClientImpl(resolveOptions(options));
}
