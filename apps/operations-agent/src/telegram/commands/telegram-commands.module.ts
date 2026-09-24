import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { InMemoryReadOnlyEvidence } from './in-memory-evidence';
import { TELEGRAM_COMMAND_HANDLER, TELEGRAM_EVIDENCE_PORT } from './tokens';
import type { ChatResponder } from './chat-responder';
import type { ReadOnlyEvidencePort } from './evidence-views';
import { TelegramCommandService } from './telegram-command.service';

/**
 * Injection token for the optional AI chat responder (chat-bind phase). The
 * coordinator binds the real `src/ai/chat` ChatService to this token at
 * integration; when nothing is bound, free-text messages degrade to the help
 * text (fail-closed).
 */
export const TELEGRAM_CHAT_RESPONDER = 'TELEGRAM_CHAT_RESPONDER';

/**
 * Default evidence binding: an in-memory fixture so the module compiles and
 * runs standalone without touching real systems. The coordinator overrides
 * TELEGRAM_EVIDENCE_PORT with a read-only adapter at integration.
 */
const defaultEvidencePort: Provider = {
  provide: TELEGRAM_EVIDENCE_PORT,
  useClass: InMemoryReadOnlyEvidence,
};

const commandHandler: Provider = {
  provide: TELEGRAM_COMMAND_HANDLER,
  useFactory: (evidence: ReadOnlyEvidencePort, chat?: ChatResponder) =>
    new TelegramCommandService(evidence, chat),
  inject: [TELEGRAM_EVIDENCE_PORT, { token: TELEGRAM_CHAT_RESPONDER, optional: true }],
};

export interface TelegramCommandsModuleOptions {
  /**
   * Evidence-port override (coordinator integration: the real observer-backed
   * adapter). When omitted the synthetic in-memory fixture is used.
   */
  evidence?: Provider;
  /**
   * Chat-responder override (coordinator integration: the AI ChatService
   * bound to TELEGRAM_CHAT_RESPONDER). When omitted the module still
   * compiles and free-text requests render the help text.
   */
  chat?: Provider;
  /**
   * Modules whose exports must be visible to the evidence provider's
   * injections (e.g. AgentConfigModule for AgentConfigService).
   */
  imports?: Array<Type<unknown> | DynamicModule>;
}

/**
 * Read-only Telegram command module. Exports TELEGRAM_COMMAND_HANDLER bound
 * to {@link TelegramCommandService}; the evidence port is injectable via
 * TELEGRAM_EVIDENCE_PORT and defaults to {@link InMemoryReadOnlyEvidence};
 * the AI chat responder is injectable via TELEGRAM_CHAT_RESPONDER and is
 * optional (absent = degrade to help).
 */
@Module({
  providers: [defaultEvidencePort, commandHandler],
  exports: [TELEGRAM_COMMAND_HANDLER],
})
export class TelegramCommandsModule {
  static register(options: TelegramCommandsModuleOptions = {}): DynamicModule {
    return {
      module: TelegramCommandsModule,
      imports: options.imports ?? [],
      providers: [
        options.evidence ?? defaultEvidencePort,
        ...(options.chat ? [options.chat] : []),
        commandHandler,
      ],
      exports: [TELEGRAM_COMMAND_HANDLER],
    };
  }
}
