/**
 * TelegramBotApiModule - coordinator-owned DI binding for Worker B's
 * outbound Bot API client.
 *
 * Binds TELEGRAM_BOT_API_CLIENT (the token TelegramPollingModule injects) to
 * a real client only when the runtime config carries a bot token; otherwise
 * to a fail-closed stand-in whose every call rejects. The poller is inert
 * while unconfigured anyway (commands kill switch / no token), so the
 * stand-in is defence in depth: even a miswired caller can never open a
 * network concept without an explicit token on the server.
 */
import { DynamicModule, Module } from '@nestjs/common';
import { AgentConfigModule } from '../../config/agent-config.module';
import { AgentConfigService } from '../../config/agent-config.service';
import type { TelegramBotApiClient } from '../telegram.types';
import { TELEGRAM_BOT_API_CLIENT } from '../polling/telegram-polling.module';
import { createTelegramBotApiClient } from './telegram-bot-api-client';

export const failClosedBotApiClient: TelegramBotApiClient = {
  getUpdates: () =>
    Promise.reject(new Error('telegram bot api client is not bound (fail closed)')),
  sendMessage: () =>
    Promise.reject(new Error('telegram bot api client is not bound (fail closed)')),
};

@Module({})
export class TelegramBotApiModule {
  static register(): DynamicModule {
    return {
      module: TelegramBotApiModule,
      imports: [AgentConfigModule],
      providers: [
        {
          provide: TELEGRAM_BOT_API_CLIENT,
          useFactory: (config: AgentConfigService): TelegramBotApiClient => {
            const telegram = config.get().telegram;
            return telegram.botToken
              ? createTelegramBotApiClient({ token: telegram.botToken })
              : failClosedBotApiClient;
          },
          inject: [AgentConfigService],
        },
      ],
      exports: [TELEGRAM_BOT_API_CLIENT],
    };
  }
}
