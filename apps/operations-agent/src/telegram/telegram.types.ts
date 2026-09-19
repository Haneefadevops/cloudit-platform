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
