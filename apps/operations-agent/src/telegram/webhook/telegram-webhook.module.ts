/**
 * TelegramWebhookModule - NestJS wiring for the Phase D read-only webhook
 * service (for later coordinator integration; nothing here contacts Telegram).
 *
 * The service is constructed from the coordinator-owned AgentConfigService
 * (single validated source for the Telegram settings and the commands kill
 * switch) and a command-handler bound to the TELEGRAM_COMMAND_HANDLER token
 * by the commands module (Worker B). When PlatformModule is present the audit
 * port binds to its global append-only AuditService; an explicit audit option
 * overrides that binding.
 */
import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { AgentConfigModule } from '../../config/agent-config.module';
import { AgentConfigService } from '../../config/agent-config.service';
import { AuditService } from '../../platform/audit/audit.service';
import type { CommandRequest, CommandResponse } from '../telegram.types';
import {
  TelegramWebhookOptions,
  TelegramWebhookService,
} from './telegram-webhook.service';

/** Injection token for the commands-module command handler (Worker B). */
export const TELEGRAM_COMMAND_HANDLER = Symbol('TELEGRAM_COMMAND_HANDLER');

export type TelegramCommandHandler = {
  execute(request: CommandRequest): CommandResponse | Promise<CommandResponse>;
};

export interface TelegramWebhookModuleOptions {
  /**
   * Command-handler binding. When omitted the module expects
   * TELEGRAM_COMMAND_HANDLER to be provided by one of the imported modules
   * (the commands module); resolution fails fast if neither exists.
   */
  commandHandler?: TelegramCommandHandler;
  /**
   * Modules whose exports are visible inside this module, e.g. the commands
   * module that provides TELEGRAM_COMMAND_HANDLER. Accepts dynamic modules
   * so the coordinator can share one registered commands composition between
   * the webhook pipeline and the polling composition.
   */
  imports?: Array<Type<unknown> | DynamicModule>;
  /** Explicit audit-port binding; overrides the optional AuditService lookup. */
  audit?: TelegramWebhookOptions['audit'];
}

@Module({})
export class TelegramWebhookModule {
  static register(options: TelegramWebhookModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [
      {
        provide: TelegramWebhookService,
        useFactory: (
          config: AgentConfigService,
          commandHandler: TelegramCommandHandler,
          auditService: AuditService | undefined,
        ): TelegramWebhookService => {
          const agentConfig = config.get();
          return new TelegramWebhookService({
            telegram: agentConfig.telegram,
            commandsEnabled: agentConfig.telegramCommandsEnabled,
            commandHandler,
            audit: options.audit ?? auditService,
          });
        },
        inject: [AgentConfigService, TELEGRAM_COMMAND_HANDLER, { token: AuditService, optional: true }],
      },
    ];

    if (options.commandHandler) {
      providers.push({ provide: TELEGRAM_COMMAND_HANDLER, useValue: options.commandHandler });
    }

    return {
      module: TelegramWebhookModule,
      imports: [AgentConfigModule, ...(options.imports ?? [])],
      providers,
      exports: [TelegramWebhookService],
    };
  }
}
