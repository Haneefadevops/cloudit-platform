/**
 * Telegram Bot API sender binding (Phase F).
 *
 * Transport-only adapter between the alert engine's sender port and the
 * Telegram Bot API:
 *  - The host is fixed; the only URL interpolation is the bot token. The token
 *    is a runtime secret: it is never logged, and every rejection is built
 *    from fixed templates plus a redacted, length-capped Telegram description,
 *    so no error path can echo the token even if Telegram's body does.
 *  - Text is bounded defensively (4000 chars + fixed truncation suffix) on top
 *    of the engine's own template caps.
 *  - Every send is bounded by an AbortController timeout. Network failure,
 *    non-2xx status and `{ ok: false }` bodies all reject with bounded,
 *    token-free errors.
 *  - Config is validated at construction (config-time fail-fast). send()
 *    never throws synchronously; transport faults reject the returned promise
 *    so the engine's outage path can queue.
 *  - Pure: no process.env reads, no module-level state; all config arrives via
 *    options, fetch is injectable for tests.
 */

import type { AlertMessage } from './alert-engine';

export const TELEGRAM_TEXT_MAX_CHARS = 4000;
export const TELEGRAM_TEXT_TRUNCATION_SUFFIX = '… [truncated]';
export const TELEGRAM_DESCRIPTION_MAX_CHARS = 120;
export const DEFAULT_TELEGRAM_TIMEOUT_MS = 10_000;

const TELEGRAM_API_ORIGIN = 'https://api.telegram.org';
const REDACTED = '[redacted]';

export interface TelegramSenderOptions {
  token: string;
  chatId: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface TelegramSender {
  send(message: AlertMessage): Promise<void>;
}

interface ResolvedTelegramSenderOptions {
  token: string;
  chatId: number;
  timeoutMs: number;
  fetchImpl: typeof fetch;
}

function boundText(text: string): string {
  return text.length <= TELEGRAM_TEXT_MAX_CHARS
    ? text
    : text.slice(0, TELEGRAM_TEXT_MAX_CHARS) + TELEGRAM_TEXT_TRUNCATION_SUFFIX;
}

/** Token-free, length-capped rendering of a Telegram `description` field. */
function boundedDescription(description: string, token: string): string {
  const redacted = description.split(token).join(REDACTED);
  return redacted.length <= TELEGRAM_DESCRIPTION_MAX_CHARS
    ? redacted
    : `${redacted.slice(0, TELEGRAM_DESCRIPTION_MAX_CHARS)}…`;
}

/** Fetch rejections are remapped to fixed, bounded, token-free errors. */
function asSendError(error: unknown): Error {
  if (error instanceof Error && error.name === 'AbortError') {
    return new Error('telegram send aborted');
  }
  return new Error('telegram send failed: network error');
}

function isTelegramFailure(payload: unknown): payload is { ok: false; description?: unknown } {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as { ok?: unknown }).ok === false
  );
}

class TelegramSenderImpl implements TelegramSender {
  constructor(private readonly config: ResolvedTelegramSenderOptions) {}

  async send(message: AlertMessage): Promise<void> {
    const { token, chatId, timeoutMs, fetchImpl } = this.config;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error(`telegram send timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
    const tracked = Promise.resolve()
      .then(() =>
        fetchImpl(`${TELEGRAM_API_ORIGIN}/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: boundText(message.text),
            disable_web_page_preview: true,
          }),
          signal: controller.signal,
        }),
      )
      .catch((error: unknown) => {
        throw asSendError(error);
      });
    // If the timeout wins the race, the abandoned fetch rejection must not
    // surface as an unhandled rejection.
    void tracked.catch(() => undefined);
    try {
      const response = await Promise.race([tracked, timeoutPromise]);
      if (!response.ok) {
        throw new Error(`telegram send rejected with status ${response.status}`);
      }
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error('telegram send returned an unreadable response body');
      }
      if (isTelegramFailure(payload)) {
        const description =
          typeof payload.description === 'string' ? payload.description : 'unknown error';
        throw new Error(`telegram send failed: ${boundedDescription(description, token)}`);
      }
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }
}

export function createTelegramSender(options: TelegramSenderOptions): TelegramSender {
  if (typeof options?.token !== 'string' || options.token.length < 8) {
    throw new Error('telegram sender: token must be a string of at least 8 characters');
  }
  if (!Number.isInteger(options.chatId) || options.chatId <= 0) {
    throw new Error('telegram sender: chatId must be a positive integer');
  }
  const timeoutMs = options.timeoutMs ?? DEFAULT_TELEGRAM_TIMEOUT_MS;
  if (!(timeoutMs > 0)) {
    throw new Error('telegram sender: timeoutMs must be a positive number of milliseconds');
  }
  return new TelegramSenderImpl({
    token: options.token,
    chatId: options.chatId,
    timeoutMs,
    fetchImpl: options.fetchImpl ?? fetch,
  });
}
