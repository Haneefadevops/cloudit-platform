/**
 * Shared synthetic fixtures for the chat-phase polling acceptance tests.
 * All tokens, ids and updates are fake; nothing here touches a network or
 * the wall clock (timers and now are injected).
 */
import { TelegramPollingService } from '../../src/telegram/polling';
import { TelegramWebhookService } from '../../src/telegram/webhook';
import type {
  CommandRequest,
  CommandResponse,
  TelegramBotApiClient,
} from '../../src/telegram/telegram.types';
import type {
  TelegramPollingErrorCode,
  TelegramPollingOptions,
} from '../../src/telegram/polling';

export const TEST_BOT_TOKEN = 'test-bot-token-1';
export const TEST_SECRET = 'test-webhook-secret-1';
export const USER_ID = 424242424;
export const CHAT_ID = 424242425;
export const REPLY_TEXT = 'synthetic status: ok';

export function commandUpdate(updateId: number, text = '/status'): Record<string, unknown> {
  return {
    update_id: updateId,
    message: {
      message_id: updateId + 1,
      from: { id: USER_ID, is_bot: false, first_name: 'Synthetic' },
      chat: { id: CHAT_ID, type: 'private' },
      date: 1_727_000_000,
      text,
    },
  };
}

export interface FakeBotApi extends TelegramBotApiClient {
  /** getUpdates results in call order; each call shifts one entry. */
  queueUpdates(...results: unknown[]): void;
  getUpdatesMock: jest.Mock<Promise<unknown[]>, [number]>;
  sendMessageMock: jest.Mock<Promise<void>, [number, string]>;
  /** Deferred gate for the NEXT getUpdates call (lifecycle tests). */
  holdNextGetUpdates(): { resolve(result: unknown[]): void; reject(err: unknown): void };
}

interface HoldGate {
  resolve?: (result: unknown[]) => void;
  reject?: (err: unknown) => void;
}

export function makeBotApi(): FakeBotApi {
  const batches: unknown[] = [];
  const getUpdatesMock = jest.fn((_offset: number): Promise<unknown[]> => {
    const next = batches.shift();
    if (
      next !== undefined &&
      typeof next === 'object' &&
      next !== null &&
      (next as { __hold?: unknown }).__hold === true
    ) {
      const gate = (next as { __hold: true; gate: HoldGate }).gate;
      return new Promise<unknown[]>((resolve, reject) => {
        gate.resolve = resolve;
        gate.reject = reject;
      });
    }
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(next as unknown[]);
  });
  const sendMessageMock = jest.fn((_chatId: number, _text: string): Promise<void> =>
    Promise.resolve(),
  );
  return {
    getUpdates: getUpdatesMock,
    sendMessage: sendMessageMock,
    getUpdatesMock,
    sendMessageMock,
    queueUpdates: (...results: unknown[]) => {
      batches.push(...results);
    },
    holdNextGetUpdates: () => {
      const gate: HoldGate = {};
      batches.push({ __hold: true, gate });
      return {
        resolve: (result: unknown[]) => gate.resolve?.(result),
        reject: (err: unknown) => gate.reject?.(err),
      };
    },
  };
}

export interface FakeTimers {
  timers: {
    setInterval(fn: () => void, ms: number): unknown;
    clearInterval(handle: unknown): void;
  };
  scheduledMs: () => number | undefined;
  isScheduled: () => boolean;
  fire: () => void;
  clearedHandles: unknown[];
}

export function makeTimers(): FakeTimers {
  let fn: (() => void) | null = null;
  let ms: number | undefined;
  const clearedHandles: unknown[] = [];
  return {
    timers: {
      setInterval: (f: () => void, interval: number) => {
        fn = f;
        ms = interval;
        return 'timer-handle-1';
      },
      clearInterval: (handle: unknown) => {
        clearedHandles.push(handle);
        fn = null;
        ms = undefined;
      },
    },
    scheduledMs: () => ms,
    isScheduled: () => fn !== null,
    fire: () => {
      if (!fn) throw new Error('fake timers: no interval scheduled');
      fn();
    },
    clearedHandles,
  };
}

export interface Harness {
  service: TelegramPollingService;
  botApi: FakeBotApi;
  timers: FakeTimers;
  errors: TelegramPollingErrorCode[];
  commandHandler: {
    execute: jest.Mock<CommandResponse | Promise<CommandResponse>, [CommandRequest]>;
  };
  /** The real webhook pipeline instance the poller is wired to (when built). */
  webhookService: TelegramWebhookService | null;
}

export interface HarnessOverrides {
  commandsEnabled?: boolean;
  /** Omit the key for the default synthetic token; pass undefined for absent. */
  botToken?: string | undefined;
  webhookSecret?: string | undefined;
  /** Per-user sliding-window limit of the real pipeline. Default 20. */
  rateLimitPerMinute?: number;
  intervalMs?: number;
  maxUpdatesPerCycle?: number;
  webhook?: TelegramPollingOptions['webhook'];
  /** Replaces the default error collector (which appends to harness.errors). */
  onError?: (code: TelegramPollingErrorCode) => void;
}

/**
 * Builds the real TelegramWebhookService (synthetic telegram options) wired
 * to the real poller - an offline integration of the two seams.
 */
export function makeHarness(overrides: HarnessOverrides = {}): Harness {
  const botApi = makeBotApi();
  const timers = makeTimers();
  const errors: TelegramPollingErrorCode[] = [];
  const commandHandler: Harness['commandHandler'] = {
    execute: jest.fn(async (_request: CommandRequest): Promise<CommandResponse> => ({
      text: REPLY_TEXT,
    })),
  };
  const webhook = overrides.webhook;
  const botToken =
    overrides.botToken === undefined && !('botToken' in overrides)
      ? TEST_BOT_TOKEN
      : overrides.botToken;
  const webhookSecret =
    overrides.webhookSecret === undefined && !('webhookSecret' in overrides)
      ? TEST_SECRET
      : overrides.webhookSecret;
  const webhookService =
    webhook instanceof TelegramWebhookService
      ? webhook
      : webhook
        ? null
        : new TelegramWebhookService({
            telegram: {
              botToken,
              webhookSecret,
              allowedUserIds: [USER_ID],
              allowedChatIds: [CHAT_ID],
              maxBodyBytes: 4096,
              maxCommandArgs: 8,
              rateLimitPerMinute: overrides.rateLimitPerMinute ?? 20,
            },
            commandsEnabled: overrides.commandsEnabled ?? true,
            commandHandler,
          });
  const webhookPort = webhook ?? webhookService!;
  const service = new TelegramPollingService({
    botApi,
    webhook: webhookPort,
    telegram: {
      botToken,
      webhookSecret,
    },
    commandsEnabled: overrides.commandsEnabled ?? true,
    intervalMs: overrides.intervalMs ?? 10_000,
    maxUpdatesPerCycle: overrides.maxUpdatesPerCycle,
    onError:
      overrides.onError ??
      ((code: TelegramPollingErrorCode) => {
        errors.push(code);
      }),
    timers: timers.timers,
    now: () => 1_727_000_000_000,
  });
  return { service, botApi, timers, errors, commandHandler, webhookService };
}

/** Flushes the microtask queue so in-flight promises settle. */
export async function flush(times = 10): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
}
