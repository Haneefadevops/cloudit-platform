/**
 * Phase D acceptance tests: NestJS module wiring for later coordinator
 * integration. The module builds the service from AgentConfigService plus a
 * TELEGRAM_COMMAND_HANDLER binding; everything stays offline and synthetic.
 */
import { Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AgentConfigModule } from '../../src/config/agent-config.module';
import {
  TELEGRAM_COMMAND_HANDLER,
  TelegramWebhookModule,
  TelegramWebhookService,
} from '../../src/telegram/webhook';
import type { CommandResponse } from '../../src/telegram/telegram.types';
import {
  CHAT_ID,
  messageUpdate,
  secretHeaders,
  TEST_SECRET,
  USER_ID,
} from './helpers';

const ENV_KEYS = [
  'TELEGRAM_COMMANDS_ENABLED',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_WEBHOOK_SECRET',
  'TELEGRAM_ALLOWED_USER_IDS',
  'TELEGRAM_ALLOWED_CHAT_IDS',
] as const;

function enableTelegramEnv(): void {
  process.env.TELEGRAM_COMMANDS_ENABLED = 'true';
  process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token-1';
  process.env.TELEGRAM_WEBHOOK_SECRET = TEST_SECRET;
  process.env.TELEGRAM_ALLOWED_USER_IDS = String(USER_ID);
  process.env.TELEGRAM_ALLOWED_CHAT_IDS = String(CHAT_ID);
}

function restoreEnv(): void {
  for (const key of ENV_KEYS) delete process.env[key];
}

describe('TelegramWebhookModule', () => {
  afterEach(() => {
    restoreEnv();
  });

  it('constructs the service from AgentConfigService and an option-bound handler', async () => {
    enableTelegramEnv();
    const handler = { execute: jest.fn(async (): Promise<CommandResponse> => ({ text: 'ok' })) };

    const moduleRef = await Test.createTestingModule({
      imports: [AgentConfigModule, TelegramWebhookModule.register({ commandHandler: handler })],
    }).compile();

    const service = moduleRef.get(TelegramWebhookService);
    const outcome = await service.handle(messageUpdate(4001), secretHeaders(TEST_SECRET));

    expect(outcome.status).toBe('handled');
    expect(outcome.statusCode).toBe(200);
    expect(handler.execute).toHaveBeenCalledTimes(1);
    await moduleRef.close();
  });

  it('resolves the handler from an external TELEGRAM_COMMAND_HANDLER provider', async () => {
    enableTelegramEnv();
    const handler = { execute: jest.fn(async (): Promise<CommandResponse> => ({ text: 'ok' })) };

    @Module({
      providers: [{ provide: TELEGRAM_COMMAND_HANDLER, useValue: handler }],
      exports: [TELEGRAM_COMMAND_HANDLER],
    })
    class CommandsStubModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        AgentConfigModule,
        TelegramWebhookModule.register({ imports: [CommandsStubModule] }),
      ],
    }).compile();

    const service = moduleRef.get(TelegramWebhookService);
    const outcome = await service.handle(messageUpdate(4002), secretHeaders(TEST_SECRET));

    expect(outcome.status).toBe('handled');
    expect(handler.execute).toHaveBeenCalledTimes(1);
    await moduleRef.close();
  });

  it('fails closed through the module when the commands switch is off', async () => {
    // Commands switch stays off (default); secrets are configured so the
    // pipeline reaches the kill switch rather than the secret check.
    process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token-1';
    process.env.TELEGRAM_WEBHOOK_SECRET = TEST_SECRET;
    process.env.TELEGRAM_ALLOWED_USER_IDS = String(USER_ID);
    process.env.TELEGRAM_ALLOWED_CHAT_IDS = String(CHAT_ID);
    const handler = { execute: jest.fn(async (): Promise<CommandResponse> => ({ text: 'ok' })) };

    const moduleRef = await Test.createTestingModule({
      imports: [AgentConfigModule, TelegramWebhookModule.register({ commandHandler: handler })],
    }).compile();

    const service = moduleRef.get(TelegramWebhookService);
    const outcome = await service.handle(messageUpdate(4003), secretHeaders(TEST_SECRET));

    expect(outcome).toEqual({ status: 'rejected', statusCode: 403 });
    expect(handler.execute).not.toHaveBeenCalled();
    await moduleRef.close();
  });
});
