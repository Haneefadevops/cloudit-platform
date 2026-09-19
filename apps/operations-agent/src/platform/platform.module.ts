/**
 * PlatformModule - deterministic Phase C runtime controls.
 *
 * Provides the append-only audit sink, capability kill switches, the EUR
 * budget meter, and the job/outbox ports bound to their offline in-memory
 * implementations. Everything fails closed by default; the scheduler is
 * created timer-free (manual tick() only) so no background interval ever
 * runs in tests or until a coordinator-owned component calls start().
 */

import { Module } from '@nestjs/common';
import { AgentConfigModule } from '../config/agent-config.module';
import { AuditService } from './audit/audit.service';
import { BudgetService } from './budget/budget.service';
import { KillSwitchService } from './kill-switch/kill-switch.service';
import { InMemoryJobScheduler } from './jobs/in-memory-job-scheduler';
import { JOB_SCHEDULER } from './jobs/job-scheduler';
import { DURABLE_OUTBOX } from './outbox/durable-outbox';
import { InMemoryOutbox } from './outbox/in-memory-outbox';

@Module({
  imports: [AgentConfigModule],
  providers: [
    AuditService,
    KillSwitchService,
    BudgetService,
    {
      provide: JOB_SCHEDULER,
      useFactory: () => new InMemoryJobScheduler({ concurrency: 2 }),
    },
    {
      provide: DURABLE_OUTBOX,
      useClass: InMemoryOutbox,
    },
  ],
  exports: [AuditService, KillSwitchService, BudgetService, JOB_SCHEDULER, DURABLE_OUTBOX],
})
export class PlatformModule {}
