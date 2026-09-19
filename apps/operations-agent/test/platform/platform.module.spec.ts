import { Test } from '@nestjs/testing';
import { PlatformModule } from '../../src/platform/platform.module';
import { AuditService } from '../../src/platform/audit/audit.service';
import { KillSwitchService } from '../../src/platform/kill-switch/kill-switch.service';
import { BudgetService } from '../../src/platform/budget/budget.service';
import { JOB_SCHEDULER, JobScheduler } from '../../src/platform/jobs/job-scheduler';
import { DURABLE_OUTBOX, DurableOutbox } from '../../src/platform/outbox/durable-outbox';

describe('PlatformModule (Worker C)', () => {
  it('compiles, resolves every control and fails closed with default config', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PlatformModule],
    }).compile();

    const audit = moduleRef.get(AuditService);
    const killSwitch = moduleRef.get(KillSwitchService);
    const budget = moduleRef.get(BudgetService);
    const scheduler = moduleRef.get<JobScheduler>(JOB_SCHEDULER);
    const outbox = moduleRef.get<DurableOutbox>(DURABLE_OUTBOX);

    // Kill switches override everything by default.
    expect(killSwitch.check('ai').allowed).toBe(false);
    expect(killSwitch.check('telegram').allowed).toBe(false);
    expect(killSwitch.check('auto-remediation').allowed).toBe(false);
    expect(killSwitch.check('repair').allowed).toBe(false);

    // Budget starts empty and open (default: 10 calls/day, EUR 7/month).
    const check = budget.checkBudget();
    expect(check.allowed).toBe(true);
    if (check.allowed) {
      expect(check.day.calls).toBe(0);
      expect(check.month.estimatedEur).toBe(0);
    }

    // Audit records through the contract validator.
    const recorded = audit.record({
      eventId: 'audit-0001',
      environmentKey: 'test-env',
      eventType: 'scheduler_tick',
      actor: 'system',
      occurredAt: '2026-09-21T10:00:00.000Z',
      reasonCode: 'SYNTHETIC_REASON',
      resultCode: 'ACCEPTED',
      summary: 'synthetic module wiring check',
      evidenceKeys: [],
    });
    expect(recorded.ok).toBe(true);

    // Ports are bound to their offline implementations; no timers by default.
    expect(scheduler).toBeDefined();
    expect(scheduler.disposed).toBe(false);
    expect(outbox).toBeDefined();
    expect(outbox.pendingEntries().length).toBe(0);

    await scheduler.dispose();
    await moduleRef.close();
  });
});
