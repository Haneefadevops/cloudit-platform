/**
 * TelegramPollingModule - NestJS wiring for the outbound getUpdates poller
 * (for later coordinator integration; nothing here contacts Telegram until
 * the commands kill switch and a bot token are configured).
 *
 * The service is constructed from the coordinator-owned AgentConfigService
 * (single validated source for the Telegram settings, the poll interval and
 * the commands kill switch), the exported TelegramWebhookService (the reused
 * fail-closed inbound pipeline) and a TelegramBotApiClient bound to the
 * TELEGRAM_BOT_API_CLIENT token by the bot-api module (Worker B).
 */
import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { AgentConfigModule } from '../../config/agent-config.module';
import { AgentConfigService } from '../../config/agent-config.service';
import type { TelegramBotApiClient } from '../telegram.types';
import { TelegramWebhookService } from '../webhook/telegram-webhook.service';
import {
  TelegramPollingOptions,
  TelegramPollingService,
} from './telegram-polling.service';

/** Injection token for Worker B's Bot API client (getUpdates / sendMessage). */
export const TELEGRAM_BOT_API_CLIENT = Symbol('TELEGRAM_BOT_API_CLIENT');

export interface TelegramPollingModuleOptions {
  /**
   * Bot-API binding. When omitted the module expects TELEGRAM_BOT_API_CLIENT
   * to be provided by one of the imported modules (the bot-api module);
   * resolution fails fast if neither exists.
   */
  botApi?: TelegramBotApiClient;
  /**
   * Modules whose exports are visible inside this module, e.g. the webhook
   * module (exports TelegramWebhookService) and the bot-api module
   * (provides TELEGRAM_BOT_API_CLIENT).
   */
  imports?: Type<unknown>[];
  /** Optional observability port; receives safe reason codes only. */
  onError?: TelegramPollingOptions['onError'];
}

@Module({})
export class TelegramPollingModule {
  static register(options: TelegramPollingModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [
      {
        provide: TelegramPollingService,
        useFactory: (
          config: AgentConfigService,
          webhook: TelegramWebhookService,
          botApi: TelegramBotApiClient | undefined,
        ): TelegramPollingService => {
          if (!botApi) {
            throw new Error(
              'TelegramPollingModule: no botApi option and no TELEGRAM_BOT_API_CLIENT provider',
            );
          }
          const agentConfig = config.get();
          return new TelegramPollingService({
            botApi,
            webhook,
            telegram: agentConfig.telegram,
            commandsEnabled: agentConfig.telegramCommandsEnabled,
            intervalMs: agentConfig.telegram.pollIntervalMs,
            onError: options.onError,
          });
        },
        inject: [
          AgentConfigService,
          TelegramWebhookService,
          { token: TELEGRAM_BOT_API_CLIENT, optional: true },
        ],
      },
    ];

    if (options.botApi) {
      providers.push({ provide: TELEGRAM_BOT_API_CLIENT, useValue: options.botApi });
    }

    return {
      module: TelegramPollingModule,
      imports: [AgentConfigModule, ...(options.imports ?? [])],
      providers,
      exports: [TelegramPollingService],
    };
  }
}
