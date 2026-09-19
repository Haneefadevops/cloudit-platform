/**
 * TelegramWebhookService - read-only, fully offline webhook processing for
 * the Phase D Telegram test-bot interface (operator-plan section 6.2).
 *
 * Pipeline (fail-closed, in order): body-size limit, constant-time webhook
 * secret verification, commands kill switch, strict JSON/update validation,
 * update-type gate, replay deduplication, per-user sliding-window rate limit,
 * user/chat allowlist authorization, command parsing, then a sanitized and
 * bounded reply. Every invocation records exactly one contract-validated
 * AuditEvent through the injected audit port; summaries are static safe
 * strings and never contain inbound text, tokens or secrets.
 *
 * No network, no Telegram client and no wall-clock dependency: all time
 * comes from the injectable `now()` epoch-ms clock.
 */
import { createHash, timingSafeEqual } from 'crypto';
import {
  AuditEvent,
  sanitizeSafeText,
  validateAuditEvent,
} from '@cloudit/operations-agent-contracts';
import type {
  CommandRequest,
  CommandResponse,
  WebhookOutcome,
} from '../telegram.types';

/** Header Telegram sends when a webhook secret_token is configured. */
const SECRET_TOKEN_HEADER = 'x-telegram-bot-api-secret-token';

/** Sliding-window length for the per-user rate limit. */
const RATE_WINDOW_MS = 60_000;

/** Telegram sendMessage hard limit; replies are capped below it. */
const MAX_REPLY_CHARS = 4000;

/** Lowercase command names: 1-32 chars of [a-z0-9_]. */
const COMMAND_NAME_PATTERN = /^[a-z0-9_]{1,32}$/;

const DEFAULT_RECEIPT_TTL_MS = 24 * 60 * 60 * 1000;

export const TELEGRAM_WEBHOOK_ACTOR = 'system:telegram-webhook';
export const TELEGRAM_WEBHOOK_EVENT_TYPE = 'telegram_webhook';
/**
 * Phase D is a single test-bot deployment; the agent config carries no
 * environment dimension, so the webhook environment key is a fixed safe
 * constant rather than something derived from untrusted inbound data.
 */
export const TELEGRAM_WEBHOOK_ENVIRONMENT_KEY = 'env-telegram';

export interface TelegramWebhookOptions {
  /** Telegram settings (shape: AgentConfig['telegram']) + master switch. */
  telegram: {
    botToken: string | undefined;
    webhookSecret: string | undefined;
    allowedUserIds: readonly number[];
    allowedChatIds: readonly number[];
    maxBodyBytes: number;
    maxCommandArgs: number;
    rateLimitPerMinute: number;
  };
  commandsEnabled: boolean;
  /** Routes accepted command requests; the commands module (Worker B) implements it. */
  commandHandler: {
    execute(request: CommandRequest): CommandResponse | Promise<CommandResponse>;
  };
  /** Optional audit port; every decision recorded as one safe AuditEvent. */
  audit?: { record(event: unknown): unknown };
  /** Injectable epoch-ms clock. Defaults to Date.now. */
  now?: () => number;
  /** Replay receipt retention. Default 24h. */
  receiptTtlMs?: number;
}

interface AuditDecision {
  reasonCode: string;
  resultCode: string;
  summary: string;
}

/** Structural subset of an inbound Telegram message used by the pipeline. */
interface InboundMessage {
  userId: number | undefined;
  chatId: number | undefined;
  text: string | undefined;
}

export class TelegramWebhookService {
  private readonly telegram: TelegramWebhookOptions['telegram'];
  private readonly commandsEnabled: boolean;
  private readonly commandHandler: TelegramWebhookOptions['commandHandler'];
  private readonly audit: TelegramWebhookOptions['audit'];
  private readonly now: () => number;
  private readonly receiptTtlMs: number;

  /** update_id -> receipt timestamp (epoch ms), pruned lazily. */
  private readonly receipts = new Map<number, number>();
  /** userId -> accepted-request timestamps within the rate window. */
  private readonly rateWindows = new Map<number, number[]>();
  private auditSequence = 0;

  constructor(options: TelegramWebhookOptions) {
    if (!options || typeof options !== 'object') {
      throw new Error('TelegramWebhookOptions are required');
    }
    if (!options.commandHandler || typeof options.commandHandler.execute !== 'function') {
      throw new Error('TelegramWebhookOptions.commandHandler.execute is required');
    }
    this.telegram = options.telegram;
    this.commandsEnabled = options.commandsEnabled;
    this.commandHandler = options.commandHandler;
    this.audit = options.audit;
    this.now = options.now ?? Date.now;
    this.receiptTtlMs = options.receiptTtlMs ?? DEFAULT_RECEIPT_TTL_MS;
  }

  async handle(rawBody: string, headers: Record<string, string>): Promise<WebhookOutcome> {
    const nowMs = this.now();

    // 1. Body-size limit (bytes), before any parsing or secret work.
    if (Buffer.byteLength(rawBody, 'utf8') > this.telegram.maxBodyBytes) {
      return this.finish(
        { status: 'rejected', statusCode: 413 },
        {
          reasonCode: 'BODY_TOO_LARGE',
          resultCode: 'WEBHOOK_REJECTED',
          summary: 'inbound webhook body exceeded the configured size limit',
        },
        nowMs,
      );
    }

    // 2. Webhook secret, constant-time on equal-length SHA-256 digests.
    if (!this.verifySecret(headers)) {
      return this.finish(
        { status: 'unauthorized', statusCode: 401 },
        {
          reasonCode: 'SECRET_TOKEN_INVALID',
          resultCode: 'WEBHOOK_UNAUTHORIZED',
          summary: 'inbound webhook failed secret-token verification',
        },
        nowMs,
      );
    }

    // 3. Master switch: fail closed.
    if (!this.commandsEnabled) {
      return this.finish(
        { status: 'rejected', statusCode: 403 },
        {
          reasonCode: 'COMMANDS_DISABLED',
          resultCode: 'WEBHOOK_REJECTED',
          summary: 'telegram commands are disabled by the kill switch',
        },
        nowMs,
      );
    }

    // 4. Strict JSON parse and update_id validation (fail-closed).
    let update: unknown;
    try {
      update = JSON.parse(rawBody);
    } catch {
      return this.finish(
        { status: 'rejected', statusCode: 400 },
        {
          reasonCode: 'MALFORMED_JSON',
          resultCode: 'WEBHOOK_REJECTED',
          summary: 'inbound webhook body was not valid JSON',
        },
        nowMs,
      );
    }
    if (typeof update !== 'object' || update === null || Array.isArray(update)) {
      return this.finish(
        { status: 'rejected', statusCode: 400 },
        {
          reasonCode: 'UPDATE_INVALID',
          resultCode: 'WEBHOOK_REJECTED',
          summary: 'inbound webhook payload was not an update object',
        },
        nowMs,
      );
    }
    const updateId = (update as Record<string, unknown>).update_id;
    if (typeof updateId !== 'number' || !Number.isInteger(updateId)) {
      return this.finish(
        { status: 'rejected', statusCode: 400 },
        {
          reasonCode: 'UPDATE_INVALID',
          resultCode: 'WEBHOOK_REJECTED',
          summary: 'inbound webhook update was missing a valid update_id',
        },
        nowMs,
      );
    }
    const correlationId = `tg-${updateId}`;

    // 5. Update-type gate: Phase D has no callback path and no service-message
    // handling; both are acknowledged and dropped without operational detail.
    const body = update as Record<string, unknown>;
    if (body.callback_query !== undefined && body.callback_query !== null) {
      return this.finish(
        { status: 'ignored', statusCode: 200 },
        {
          reasonCode: 'UNSUPPORTED_UPDATE',
          resultCode: 'WEBHOOK_IGNORED',
          summary: 'callback queries are not supported in this phase and were ignored',
        },
        nowMs,
        correlationId,
      );
    }
    if (typeof body.message !== 'object' || body.message === null) {
      return this.finish(
        { status: 'ignored', statusCode: 200 },
        {
          reasonCode: 'UNSUPPORTED_UPDATE',
          resultCode: 'WEBHOOK_IGNORED',
          summary: 'unsupported update type was ignored',
        },
        nowMs,
        correlationId,
      );
    }
    const message = this.readMessage(body.message as Record<string, unknown>);
    if (message.text === undefined || !message.text.startsWith('/')) {
      return this.finish(
        { status: 'ignored', statusCode: 200 },
        {
          reasonCode: 'NON_COMMAND_MESSAGE',
          resultCode: 'WEBHOOK_IGNORED',
          summary: 'non-command message was ignored',
        },
        nowMs,
        correlationId,
      );
    }

    // 6. Replay protection: deduplicate update_id within the receipt TTL.
    this.pruneReceipts(nowMs);
    if (this.receipts.has(updateId)) {
      return this.finish(
        { status: 'rejected', statusCode: 409 },
        {
          reasonCode: 'REPLAY_DETECTED',
          resultCode: 'WEBHOOK_REJECTED',
          summary: 'inbound update_id was already processed within the receipt window',
        },
        nowMs,
        correlationId,
      );
    }
    this.receipts.set(updateId, nowMs);

    // 7. Per-user sliding-window rate limit.
    if (message.userId !== undefined && !this.allowRequest(message.userId, nowMs)) {
      return this.finish(
        { status: 'rate_limited', statusCode: 429 },
        {
          reasonCode: 'RATE_LIMIT_EXCEEDED',
          resultCode: 'WEBHOOK_RATE_LIMITED',
          summary: 'inbound user exceeded the per-minute request limit',
        },
        nowMs,
        correlationId,
      );
    }

    // 8. Authorization: exact userId AND chatId allowlists; the denial is
    // generic and never reveals which check failed.
    const authorized =
      message.userId !== undefined &&
      message.chatId !== undefined &&
      this.telegram.allowedUserIds.includes(message.userId) &&
      this.telegram.allowedChatIds.includes(message.chatId);
    if (!authorized) {
      return this.finish(
        { status: 'unauthorized', statusCode: 403, reply: { text: 'Not authorized.' } },
        {
          reasonCode: 'ALLOWLIST_DENIED',
          resultCode: 'WEBHOOK_UNAUTHORIZED',
          summary: 'inbound user or chat was not on the allowlist',
        },
        nowMs,
        correlationId,
      );
    }

    // 9. Command parsing: lowercase name, whitespace-split args capped at
    // maxCommandArgs (extras dropped), strict command-name charset.
    const parsed = this.parseCommand(message.text);
    if (parsed === undefined) {
      return this.finish(
        { status: 'rejected', statusCode: 400 },
        {
          reasonCode: 'COMMAND_INVALID',
          resultCode: 'WEBHOOK_REJECTED',
          summary: 'inbound command name was not a valid identifier',
        },
        nowMs,
        correlationId,
      );
    }
    const request: CommandRequest = {
      command: parsed.command,
      args: parsed.args,
      userId: message.userId as number,
      chatId: message.chatId as number,
      correlationId,
    };

    // 10. Execute and sanitize the reply (no URL allowlist, 4000-char cap).
    let response: CommandResponse;
    try {
      response = await this.commandHandler.execute(request);
    } catch {
      return this.finish(
        { status: 'rejected', statusCode: 500 },
        {
          reasonCode: 'COMMAND_ERROR',
          resultCode: 'COMMAND_FAILED',
          summary: 'command handler failed to produce a safe reply',
        },
        nowMs,
        correlationId,
      );
    }
    if (typeof response !== 'object' || response === null || typeof response.text !== 'string') {
      return this.finish(
        { status: 'rejected', statusCode: 500 },
        {
          reasonCode: 'COMMAND_ERROR',
          resultCode: 'COMMAND_FAILED',
          summary: 'command handler returned an invalid response shape',
        },
        nowMs,
        correlationId,
      );
    }
    const safeReply = sanitizeSafeText(response.text, { urlAllowlist: [] }).slice(
      0,
      MAX_REPLY_CHARS,
    );
    return this.finish(
      { status: 'handled', statusCode: 200, reply: { text: safeReply } },
      {
        reasonCode: 'COMMAND_EXECUTED',
        resultCode: 'COMMAND_HANDLED',
        summary: 'command was executed and a sanitized reply was produced',
      },
      nowMs,
      correlationId,
    );
  }

  /** Constant-time comparison of the configured secret against the header. */
  private verifySecret(headers: Record<string, string>): boolean {
    const secret = this.telegram.webhookSecret;
    if (typeof secret !== 'string' || secret.length === 0) return false;
    const presented = this.readSecretHeader(headers);
    if (typeof presented !== 'string' || presented.length === 0) return false;
    const expectedDigest = createHash('sha256').update(secret, 'utf8').digest();
    const presentedDigest = createHash('sha256').update(presented, 'utf8').digest();
    return timingSafeEqual(expectedDigest, presentedDigest);
  }

  private readSecretHeader(headers: Record<string, string>): string | undefined {
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === SECRET_TOKEN_HEADER) return value;
    }
    return undefined;
  }

  private readMessage(message: Record<string, unknown>): InboundMessage {
    const from = message.from;
    const chat = message.chat;
    const userId =
      typeof from === 'object' && from !== null && Number.isInteger((from as { id?: unknown }).id)
        ? ((from as { id: number }).id as number)
        : undefined;
    const chatId =
      typeof chat === 'object' && chat !== null && Number.isInteger((chat as { id?: unknown }).id)
        ? ((chat as { id: number }).id as number)
        : undefined;
    const text = typeof message.text === 'string' ? message.text : undefined;
    return { userId, chatId, text };
  }

  private parseCommand(text: string): { command: string; args: string[] } | undefined {
    const match = /^(\S+)(?:\s+([\s\S]*))?$/.exec(text.slice(1));
    const command = (match?.[1] ?? '').toLowerCase();
    if (!COMMAND_NAME_PATTERN.test(command)) return undefined;
    const rest = match?.[2] ?? '';
    const args = rest
      .split(/\s+/)
      .filter((part) => part.length > 0)
      .slice(0, this.telegram.maxCommandArgs);
    return { command, args };
  }

  private pruneReceipts(nowMs: number): void {
    const cutoff = nowMs - this.receiptTtlMs;
    for (const [updateId, receivedAtMs] of this.receipts) {
      if (receivedAtMs < cutoff) this.receipts.delete(updateId);
    }
  }

  /** Returns false when the user already has `limit` requests in the window. */
  private allowRequest(userId: number, nowMs: number): boolean {
    const limit = this.telegram.rateLimitPerMinute;
    const cutoff = nowMs - RATE_WINDOW_MS;
    const window = (this.rateWindows.get(userId) ?? []).filter((ts) => ts >= cutoff);
    if (window.length >= limit) {
      this.rateWindows.set(userId, window);
      return false;
    }
    window.push(nowMs);
    this.rateWindows.set(userId, window);
    return true;
  }

  /** Records exactly one contract-validated AuditEvent, then returns the outcome. */
  private finish(
    outcome: WebhookOutcome,
    decision: AuditDecision,
    nowMs: number,
    correlationId?: string,
  ): WebhookOutcome {
    this.recordAudit(decision, nowMs, correlationId);
    return outcome;
  }

  private recordAudit(decision: AuditDecision, nowMs: number, correlationId?: string): void {
    if (!this.audit) return;
    this.auditSequence += 1;
    const candidate: AuditEvent = {
      eventId: `evt-tg-${this.auditSequence}`,
      environmentKey: TELEGRAM_WEBHOOK_ENVIRONMENT_KEY,
      eventType: TELEGRAM_WEBHOOK_EVENT_TYPE,
      actor: TELEGRAM_WEBHOOK_ACTOR,
      occurredAt: new Date(nowMs).toISOString(),
      reasonCode: decision.reasonCode,
      resultCode: decision.resultCode,
      summary: decision.summary.slice(0, 1000),
      evidenceKeys: correlationId === undefined ? [] : [correlationId],
    };
    const validated = validateAuditEvent(candidate);
    if (!validated.ok) return;
    try {
      this.audit?.record(validated.value);
    } catch {
      // The decision must stand even if the audit port is misbehaving.
    }
  }
}
