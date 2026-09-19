import { Module } from '@nestjs/common';
import { AgentConfigModule } from './config/agent-config.module';

/**
 * Root module. Feature modules (supervisor, sync, platform) are added here by
 * the coordinator during Phase C integration; each worker owns its module
 * under its assigned path.
 */
@Module({
  imports: [AgentConfigModule],
})
export class AppModule {}
