/**
 * Shared synthetic fixtures for the Phase D webhook acceptance tests.
 * All ids, tokens and updates are fake; nothing here touches a network.
 */
import type { CommandRequest, CommandResponse } from '../../src/telegram/telegram.types';
import type { TelegramWebhookOptions } from '../../src/telegram/webhook';

export const TEST_SECRET = 'test-webhook-secret-1';
export const TEST_BOT_TOKEN = 'test-bot-token-1';
export const USER_ID = 424242424;
export const CHAT_ID = 424242425;
export const OTHER_USER_ID = 434343434;
export const UNKNOWN_USER_ID = 999999999;
export const WRONG_CHAT_ID = 999999998;
export const BASE_NOW_MS = 1_727_000_000_000;

export function baseTelegramSettings(): TelegramWebhookOptions['telegram'] {
  return {
    botToken: TEST_BOT_TOKEN,
    webhookSecret: TEST_SECRET,
    allowedUserIds: [USER_ID],
    allowedChatIds: [CHAT_ID],
    maxBodyBytes: 4096,
    maxCommandArgs: 8,
    rateLimitPerMinute: 20,
  };
}

export interface Harness {
  options: TelegramWebhookOptions;
  auditEvents: unknown[];
  commandHandler: {
    execute: jest.Mock<CommandResponse | Promise<CommandResponse>, [CommandRequest]>;
  };
  setNow(ms: number): void;
  advance(ms: number): void;
}

export function makeHarness(overrides: Partial<TelegramWebhookOptions> = {}): Harness {
  let current = BASE_NOW_MS;
  const auditEvents: unknown[] = [];
  const commandHandler: Harness['commandHandler'] = {
    execute: jest.fn(async (_request: CommandRequest): Promise<CommandResponse> => ({
      text: 'synthetic status: ok',
    })),
  };
  const baseTelegram: TelegramWebhookOptions['telegram'] = baseTelegramSettings();
  const options: TelegramWebhookOptions = {
    ...overrides,
    telegram: { ...baseTelegram, ...overrides.telegram },
    commandsEnabled: overrides.commandsEnabled ?? true,
    commandHandler: overrides.commandHandler ?? commandHandler,
    audit: overrides.audit ?? { record: (event: unknown) => void auditEvents.push(event) },
    now: overrides.now ?? (() => current),
  };
  return {
    options,
    auditEvents,
    commandHandler,
    setNow: (ms: number) => {
      current = ms;
    },
    advance: (ms: number) => {
      current += ms;
    },
  };
}

export function secretHeaders(secret: string): Record<string, string> {
  return { 'X-Telegram-Bot-Api-Secret-Token': secret };
}

export interface MessageOptions {
  userId?: number;
  chatId?: number;
  /** Omit the text field entirely when null. Defaults to '/status'. */
  text?: string | null;
  extraMessageFields?: Record<string, unknown>;
}

export function messageUpdate(updateId: number, opts: MessageOptions = {}): string {
  const { userId = USER_ID, chatId = CHAT_ID, text = '/status', extraMessageFields = {} } = opts;
  const message: Record<string, unknown> = {
    message_id: updateId + 1,
    from: { id: userId, is_bot: false, first_name: 'Synthetic' },
    chat: { id: chatId, type: 'private' },
    date: 1_727_000_000,
    ...extraMessageFields,
  };
  if (text !== null) message.text = text;
  return JSON.stringify({ update_id: updateId, message });
}

export function callbackQueryUpdate(updateId: number): string {
  return JSON.stringify({
    update_id: updateId,
    callback_query: {
      id: `callback-${updateId}`,
      from: { id: USER_ID, is_bot: false, first_name: 'Synthetic' },
      message: {
        message_id: 7,
        from: { id: 111111, is_bot: true },
        chat: { id: CHAT_ID, type: 'private' },
        date: 1_727_000_000,
        text: '/status',
      },
      data: 'synthetic-callback-data',
    },
  });
}
