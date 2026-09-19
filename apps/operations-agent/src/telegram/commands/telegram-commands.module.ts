import { Module, Provider } from '@nestjs/common';
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

/**
 * Read-only Telegram command module. Exports TELEGRAM_COMMAND_HANDLER bound
 * to {@link TelegramCommandService}; the evidence port is injectable via
 * TELEGRAM_EVIDENCE_PORT and defaults to {@link InMemoryReadOnlyEvidence}.
 */
@Module({
  providers: [defaultEvidencePort, commandHandler],
  exports: [TELEGRAM_COMMAND_HANDLER],
})
export class TelegramCommandsModule {}
