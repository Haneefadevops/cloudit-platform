/**
 * TelegramPollingService - the chat phase's outbound update poller
 * (operator-plan chat phase): the headless agent receives operator commands
 * by polling Telegram's Bot API (getUpdates) over outbound HTTPS. No inbound
 * port or reverse-proxy route is ever opened, keeping the watchdog headless.
 *
 * Hard rules enforced here:
 *  - Reuse, never re-implement: every raw update JSON is handed to the
 *    existing fail-closed inbound pipeline (TelegramWebhookService.handle)
 *    with the configured webhook secret header. Body-size limit, secret
 *    verification, kill switch, strict validation, replay dedup, rate limit,
 *    allow-list authorization, command parsing and the one-event-per-call
 *    audit contract therefore apply to polled updates exactly as they do to
 *    web-delivered ones.
 *  - At-least-once offset semantics: the in-memory offset advances to
 *    update_id + 1 only after an update has been processed. A cycle that
 *    fails mid-batch leaves the offset before the unprocessed update so the
 *    next cycle refetches it; the webhook's replay dedup makes redelivery
 *    safe, so no command can be silently dropped.
 *  - Gated (fail closed): when the commands kill switch is off or no bot
 *    token is configured, a cycle makes no network calls at all (inert).
 *  - Never throws: getUpdates, handle and sendMessage rejections are caught
 *    and counted through the injectable onError callback with safe reason
 *    codes only; raw errors never propagate and never enter logs with the
 *    token. The interval loop always schedules the next cycle.
 *  - Sequential: updates within one cycle are processed one at a time.
 *  - Bounded: at most MAX_UPDATES_PER_CYCLE updates per cycle; a
 *    non-array/malformed getUpdates result is treated as "no updates".
 */

import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { TelegramBotApiClient, WebhookOutcome } from '../telegram.types';

/** Header the inbound pipeline expects; carries the webhook secret. */
const SECRET_TOKEN_HEADER = 'x-telegram-bot-api-secret-token';

/** Default poll interval (matches AgentConfig telegram.pollIntervalMs). */
const DEFAULT_INTERVAL_MS = 10_000;

/** Upper bound on updates processed per cycle. */
const DEFAULT_MAX_UPDATES_PER_CYCLE = 100;

/** Safe, bounded observability codes; never carry raw errors or tokens. */
export type TelegramPollingErrorCode =
  | 'GET_UPDATES_FAILED'
  | 'HANDLE_FAILED'
  | 'SEND_MESSAGE_FAILED'
  | 'INTERNAL_ERROR';

export interface TelegramPollingOptions {
  /** Worker B's Bot API port (getUpdates / sendMessage). */
  botApi: TelegramBotApiClient;
  /** The existing fail-closed inbound pipeline, reused unchanged. */
  webhook: {
    handle(rawBody: string, headers: Record<string, string>): Promise<WebhookOutcome>;
  };
  /** Telegram settings (shape: AgentConfig['telegram']). */
  telegram: {
    botToken: string | undefined;
    webhookSecret: string | undefined;
  };
  /** Commands master switch; false makes every cycle inert. */
  commandsEnabled: boolean;
  /** Optional observability port; receives safe reason codes only. */
  onError?: (code: TelegramPollingErrorCode) => void;
  /** Poll interval. Default 10_000. */
  intervalMs?: number;
  /** Per-cycle update cap. Default 100. */
  maxUpdatesPerCycle?: number;
  /** ms epoch; default Date.now. */
  now?: () => number;
  timers?: {
    setInterval(fn: () => void, ms: number): unknown;
    clearInterval(handle: unknown): void;
  };
}

export type PollCycleOutcome =
  | { status: 'INERT' }
  | { status: 'SUPPRESSED'; reason: 'CYCLE_IN_FLIGHT' }
  | { status: 'FETCH_FAILED' }
  | { status: 'INTERNAL_ERROR' }
  | { status: 'COMPLETED'; fetched: number; processed: number; repliesSent: number }
  | {
      status: 'BATCH_INTERRUPTED';
      processed: number;
      repliesSent: number;
      failedUpdateId: number | undefined;
    };

/** Defensively extracts update.message.chat.id (numeric) from a raw update. */
function extractChatId(update: unknown): number | undefined {
  if (typeof update !== 'object' || update === null) return undefined;
  const message = (update as Record<string, unknown>).message;
  if (typeof message !== 'object' || message === null) return undefined;
  const chat = (message as Record<string, unknown>).chat;
  if (typeof chat !== 'object' || chat === null) return undefined;
  const id = (chat as Record<string, unknown>).id;
  return typeof id === 'number' && Number.isSafeInteger(id) ? id : undefined;
}

/** Defensively extracts a valid Telegram update_id from a raw update. */
function extractUpdateId(update: unknown): number | undefined {
  if (typeof update !== 'object' || update === null) return undefined;
  const updateId = (update as Record<string, unknown>).update_id;
  return typeof updateId === 'number' && Number.isSafeInteger(updateId) && updateId > 0
    ? updateId
    : undefined;
}

export class TelegramPollingService implements OnModuleInit, OnModuleDestroy {
  private readonly botApi: TelegramBotApiClient;
  private readonly webhook: TelegramPollingOptions['webhook'];
  private readonly commandsEnabled: boolean;
  private readonly botToken: string | undefined;
  private readonly webhookSecret: string | undefined;
  private readonly onError: TelegramPollingOptions['onError'];
  private readonly intervalMs: number;
  private readonly maxUpdatesPerCycle: number;
  private readonly now: () => number;
  private readonly timers: NonNullable<TelegramPollingOptions['timers']>;
  private timerHandle: unknown;
  private inFlight = false;
  private currentCycle: Promise<void> | null = null;
  /** Next getUpdates offset; advances only past fully processed updates. */
  private offset = 0;

  constructor(options: TelegramPollingOptions) {
    if (!options || typeof options !== 'object') {
      throw new Error('telegram polling: options are required');
    }
    if (!options.botApi || typeof options.botApi.getUpdates !== 'function') {
      throw new Error('telegram polling: botApi.getUpdates is required');
    }
    if (typeof options.botApi.sendMessage !== 'function') {
      throw new Error('telegram polling: botApi.sendMessage is required');
    }
    if (!options.webhook || typeof options.webhook.handle !== 'function') {
      throw new Error('telegram polling: webhook.handle is required');
    }
    const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
    const maxUpdatesPerCycle = options.maxUpdatesPerCycle ?? DEFAULT_MAX_UPDATES_PER_CYCLE;
    if (!Number.isInteger(intervalMs) || intervalMs <= 0) {
      throw new Error('telegram polling: intervalMs must be a positive integer');
    }
    if (!Number.isInteger(maxUpdatesPerCycle) || maxUpdatesPerCycle <= 0) {
      throw new Error('telegram polling: maxUpdatesPerCycle must be a positive integer');
    }
    this.botApi = options.botApi;
    this.webhook = options.webhook;
    this.commandsEnabled = options.commandsEnabled;
    this.botToken = options.telegram?.botToken;
    this.webhookSecret = options.telegram?.webhookSecret;
    this.onError = options.onError;
    this.intervalMs = intervalMs;
    this.maxUpdatesPerCycle = maxUpdatesPerCycle;
    this.now = options.now ?? (() => Date.now());
    this.timers = options.timers ?? {
      setInterval: (fn: () => void, ms: number) => setInterval(fn, ms),
      clearInterval: (handle: unknown) => clearInterval(handle as ReturnType<typeof setInterval>),
    };
  }

  onModuleInit(): void {
    if (this.timerHandle !== undefined) return;
    this.timerHandle = this.timers.setInterval(() => {
      void this.cycle();
    }, this.intervalMs);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timerHandle !== undefined) {
      this.timers.clearInterval(this.timerHandle);
      this.timerHandle = undefined;
    }
    const pending = this.currentCycle;
    if (pending) await pending;
  }

  /** Current offset; exposed read-only for tests and diagnostics. */
  getOffset(): number {
    return this.offset;
  }

  /** One poll cycle. Never throws; failures are counted with safe codes. */
  async cycle(): Promise<PollCycleOutcome> {
    if (this.inFlight) return { status: 'SUPPRESSED', reason: 'CYCLE_IN_FLIGHT' };
    this.inFlight = true;
    const run = this.runCycle();
    this.currentCycle = run.then(
      () => undefined,
      () => undefined,
    );
    try {
      return await run;
    } finally {
      this.inFlight = false;
      this.currentCycle = null;
    }
  }

  private async runCycle(): Promise<PollCycleOutcome> {
    try {
      return await this.poll();
    } catch {
      this.countError('INTERNAL_ERROR');
      return { status: 'INTERNAL_ERROR' };
    }
  }

  private async poll(): Promise<PollCycleOutcome> {
    // Gate at the start of every cycle: no network calls while disabled
    // or unconfigured (fail closed).
    if (!this.commandsEnabled || !this.botToken) {
      return { status: 'INERT' };
    }

    let updates: unknown[];
    try {
      const result = await this.botApi.getUpdates(this.offset);
      updates = Array.isArray(result) ? result : [];
    } catch {
      this.countError('GET_UPDATES_FAILED');
      return { status: 'FETCH_FAILED' };
    }

    const batch = updates.slice(0, this.maxUpdatesPerCycle);
    let processed = 0;
    let repliesSent = 0;

    for (const update of batch) {
      const updateId = extractUpdateId(update);
      const rawBody = JSON.stringify(update);
      let outcome: WebhookOutcome;
      try {
        outcome = await this.webhook.handle(rawBody, {
          [SECRET_TOKEN_HEADER]: this.webhookSecret ?? '',
        });
      } catch {
        // At-least-once: stop the batch WITHOUT advancing past this update;
        // the next cycle refetches from the same offset and the webhook's
        // replay dedup absorbs the already-processed prefix.
        this.countError('HANDLE_FAILED');
        return {
          status: 'BATCH_INTERRUPTED',
          processed,
          repliesSent,
          failedUpdateId: updateId,
        };
      }
      // The update reached the pipeline and produced an outcome; it is now
      // safe to acknowledge.
      if (updateId !== undefined) this.offset = updateId + 1;
      processed += 1;

      if (outcome && outcome.status === 'handled' && outcome.reply) {
        const chatId = extractChatId(update);
        if (chatId !== undefined) {
          try {
            await this.botApi.sendMessage(chatId, outcome.reply.text);
            repliesSent += 1;
          } catch {
            // The command was handled (audited); the outbound reply is
            // best-effort. Count and keep the batch moving.
            this.countError('SEND_MESSAGE_FAILED');
          }
        }
      }
    }

    return { status: 'COMPLETED', fetched: updates.length, processed, repliesSent };
  }

  private countError(code: TelegramPollingErrorCode): void {
    if (!this.onError) return;
    try {
      this.onError(code);
    } catch {
      // Observability must never break the poller.
    }
  }
}
