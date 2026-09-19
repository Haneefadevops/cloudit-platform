import { Module } from '@nestjs/common';
import { AgentConfigModule } from './config/agent-config.module';
import { PlatformModule } from './platform/platform.module';
import { SupervisorModule } from './supervisor/supervisor.module';
import { SyncModule } from './sync/sync.module';

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
 */
@Module({
  imports: [AgentConfigModule, PlatformModule, SupervisorModule.register(), SyncModule],
})
export class AppModule {}
