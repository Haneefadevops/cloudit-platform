import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentConfigService } from './agent-config.service';

/**
 * Central configuration. Coordinator-owned: workers consume AgentConfigService
 * and must not read process.env directly, so kill switches and budgets have
 * exactly one validated source.
 *
 * Every capability defaults to disabled (fail-closed). No secret values are
 * read here; secrets stay in protected runtime files outside source control.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // No .env file is loaded: configuration comes from the process
      // environment of the runtime, never from the repository.
      ignoreEnvFile: true,
    }),
  ],
  providers: [AgentConfigService],
  exports: [AgentConfigService],
})
export class AgentConfigModule {}
