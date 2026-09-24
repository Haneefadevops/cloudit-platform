/**
 * Shared Telegram interface types (coordinator-owned contract between the
 * webhook owner, the commands owner and the security test owner).
 *
 * Phase D accepts text commands only. Callback queries, documents, images,
 * voice notes, contacts, locations and arbitrary URLs are rejected upstream
 * (operator-plan section 6.1). Every value here is untrusted inbound data
 * until validated by the webhook layer.
 */

/** Parsed, validated shape of an accepted Telegram update. */
export interface ParsedTelegramUpdate {
  /** Telegram update_id; used for replay deduplication. */
  updateId: number;
  kind: 'message' | 'callback_query';
  chatId: number;
  userId: number;
  /** Present for message updates; may be a command with arguments. */
  text?: string;
  /** Present for callback queries. Phase D rejects callbacks. */
  callbackData?: string;
}

/** Normalized request handed from the webhook layer to the command layer. */
export interface CommandRequest {
  /** Command name without the leading slash, e.g. 'status'. */
  command: string;
  args: string[];
  userId: number;
  chatId: number;
  /** Safe correlation id (no secrets, no PII) for audit and support. */
  correlationId: string;
  /**
   * Chat-bind phase: the full original message text for free-text (non-slash)
   * messages routed to the AI chat handler as command 'chat'. Undefined for
   * slash commands; set verbatim by the webhook layer (never split or
   * capped like args).
   */
  rawText?: string;
}

/** Bounded, safe reply payload suitable for Telegram sendMessage. */
export interface CommandResponse {
  /** Plain or HTML text; MUST be sanitized and <= 4000 chars. */
  text: string;
}

/** Result of processing one inbound webhook invocation. */
export interface WebhookOutcome {
  status: 'handled' | 'ignored' | 'unauthorized' | 'rejected' | 'rate_limited';
  /** Suggested HTTP status code for the webhook endpoint. */
  statusCode: number;
  /** Reply to send via sendMessage, when a reply is safe and warranted. */
  reply?: CommandResponse;
}

/**
 * Chat phase (outbound polling): minimal Telegram Bot API port. The agent
 * polls getUpdates over outbound HTTPS - no inbound port or reverse-proxy
 * route is ever opened, keeping the watchdog headless.
 *
 * Coordinator-owned contract: Worker B (bot-api owner) implements it;
 * Worker A (polling owner) consumes it; Worker C's blind evals probe both
 * through this seam. Implementations MUST:
 *  - never place the bot token in thrown errors, logs or return values
 *    (it appears only inside the request URL);
 *  - bound every response (updates array length, message text length);
 *  - return raw update JSON as `unknown` - all validation happens in the
 *    webhook pipeline (TelegramWebhookService.handle), which the poller
 *    reuses unchanged.
 */
export interface TelegramBotApiClient {
  /**
   * Fetch pending updates at/after `offset` (Telegram getUpdates,
   * timeout=0 short poll). Returns raw update objects; empty array when
   * there is nothing new. Rejects on transport/HTTP errors - the caller
   * (poller) treats a rejection as "try again next cycle", never fatal.
   */
  getUpdates(offset: number): Promise<unknown[]>;
  /** Send one sanitized, bounded reply text to a chat. Rejects on failure. */
  sendMessage(chatId: number, text: string): Promise<void>;
}
