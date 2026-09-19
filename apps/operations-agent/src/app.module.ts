import { Module } from '@nestjs/common';
import { AgentConfigModule } from './config/agent-config.module';
import { PlatformModule } from './platform/platform.module';
import { SupervisorModule } from './supervisor/supervisor.module';
import { SyncModule } from './sync/sync.module';
import { TelegramCommandsModule } from './telegram/commands/telegram-commands.module';
import { TelegramWebhookModule } from './telegram/webhook/telegram-webhook.module';

/**
 * Application composition (coordinator-owned).
 *
 * PlatformModule is global and provides the append-only audit store, kill
 * switches, budget meter and job/outbox ports. SupervisorModule and SyncModule
 * bind their audit ports to that shared store via optional injection.
 *
 * The sync module's observation sources (manifest, live n8n, portal
 * catalogue) are intentionally unbound in Phase C: scans fail closed until
 * read-only adapters are added in a later gated phase.
 *
 * The Telegram composition (Phase D) is inert by default: the webhook service
 * is constructed but rejects every request while the kill switch is off, and
 * nothing opens a network listener or contacts Telegram. The evidence port
 * defaults to the synthetic in-memory implementation until a real read-only
 * adapter is bound under a later gate.
 */
@Module({
  imports: [
    AgentConfigModule,
    PlatformModule,
    SupervisorModule.register(),
    SyncModule,
    TelegramCommandsModule,
    TelegramWebhookModule.register({ imports: [TelegramCommandsModule] }),
  ],
})
export class AppModule {}
