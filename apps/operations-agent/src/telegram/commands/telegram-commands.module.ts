import { DynamicModule, Module, Provider, Type } from '@nestjs/common';
import { InMemoryReadOnlyEvidence } from './in-memory-evidence';
import { TELEGRAM_COMMAND_HANDLER, TELEGRAM_EVIDENCE_PORT } from './tokens';
import type { ReadOnlyEvidencePort } from './evidence-views';
import { TelegramCommandService } from './telegram-command.service';

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
  useFactory: (evidence: ReadOnlyEvidencePort) => new TelegramCommandService(evidence),
  inject: [TELEGRAM_EVIDENCE_PORT],
};

export interface TelegramCommandsModuleOptions {
  /**
   * Evidence-port override (coordinator integration: the real observer-backed
   * adapter). When omitted the synthetic in-memory fixture is used.
   */
  evidence?: Provider;
  /**
   * Modules whose exports must be visible to the evidence provider's
   * injections (e.g. AgentConfigModule for AgentConfigService).
   */
  imports?: Array<Type<unknown> | DynamicModule>;
}

/**
 * Read-only Telegram command module. Exports TELEGRAM_COMMAND_HANDLER bound
 * to {@link TelegramCommandService}; the evidence port is injectable via
 * TELEGRAM_EVIDENCE_PORT and defaults to {@link InMemoryReadOnlyEvidence}.
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
      providers: [options.evidence ?? defaultEvidencePort, commandHandler],
      exports: [TELEGRAM_COMMAND_HANDLER],
    };
  }
}
