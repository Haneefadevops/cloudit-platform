import { ManualClock } from '../../src/platform/clock';
import { InMemoryJobScheduler } from '../../src/platform/jobs/in-memory-job-scheduler';
import { JobRunResult, JobScheduler } from '../../src/platform/jobs/job-scheduler';

const T0 = '2026-09-21T12:00:00.000Z';

function at(clock: ManualClock, offsetMs: number): Date {
  return new Date(clock.now().getTime() + offsetMs);
}

async function runAndCollect(scheduler: JobScheduler): Promise<JobRunResult[]> {
  return scheduler.tick();
}

describe('InMemoryJobScheduler (Worker C)', () => {
  it('runs due jobs on tick and skips jobs not yet due', async () => {
    const clock = new ManualClock(new Date(T0));
    const scheduler = new InMemoryJobScheduler({ clock });
    const ran: string[] = [];
    scheduler.schedule({ key: 'due', runAt: at(clock, -1), handler: async () => { ran.push('due'); return { status: 'SUCCESS' }; } });
    scheduler.schedule({ key: 'future', runAt: at(clock, 60_000), handler: async () => { ran.push('future'); return { status: 'SUCCESS' }; } });

    const results = await runAndCollect(scheduler);
    expect(ran).toEqual(['due']);
    expect(results.map((r) => r.status)).toEqual(['COMPLETED']);
    await scheduler.dispose();
  });

  it('re-scheduling the same key replaces the pending job (idempotent keys, no duplicates)', async () => {
    const clock = new ManualClock(new Date(T0));
    const scheduler = new InMemoryJobScheduler({ clock });
    const ran: string[] = [];
    const first = scheduler.schedule({
      key: 'sync-observe',
      runAt: at(clock, 0),
      handler: async () => { ran.push('first'); return { status: 'SUCCESS' }; },
    });
    expect(first.replaced).toBe(false);
    const second = scheduler.schedule({
      key: 'sync-observe',
      runAt: at(clock, 0),
      handler: async () => { ran.push('second'); return { status: 'SUCCESS' }; },
    });
    expect(second.replaced).toBe(true);

    await runAndCollect(scheduler);
    expect(ran).toEqual(['second']);
    await scheduler.dispose();
  });

  it('never runs the same key twice concurrently and enforces the concurrency limit', async () => {
    const clock = new ManualClock(new Date(T0));
    const scheduler = new InMemoryJobScheduler({ clock, concurrency: 2 });
    const started: string[] = [];
    let active = 0;
    let maxActive = 0;
    let resolveBarrier: () => void = () => undefined;
    const barrier = new Promise<void>((resolve) => { resolveBarrier = resolve; });

    const makeHandler = (key: string) => async () => {
      started.push(key);
      active += 1;
      maxActive = Math.max(maxActive, active);
      if (started.length === 2) resolveBarrier();
      await barrier;
      active -= 1;
      return { status: 'SUCCESS' as const };
    };

    scheduler.schedule({ key: 'a', runAt: at(clock, 0), handler: makeHandler('a') });
    scheduler.schedule({ key: 'b', runAt: at(clock, 0), handler: makeHandler('b') });
    scheduler.schedule({ key: 'c', runAt: at(clock, 0), handler: makeHandler('c') });

    const firstTick = await runAndCollect(scheduler);
    expect(started.sort()).toEqual(['a', 'b']);
    expect(maxActive).toBe(2);
    expect(firstTick.filter((r) => r.status === 'DEFERRED_CONCURRENCY').length).toBe(1);
    expect(started.filter((k) => k === 'a').length).toBe(1);

    clock.advance(1);
    await runAndCollect(scheduler);
    expect(started.sort()).toEqual(['a', 'b', 'c']);
    await scheduler.dispose();
  });

  it('fails a job safely when it exceeds its timeout (measured on the injected clock)', async () => {
    const clock = new ManualClock(new Date(T0));
    const scheduler = new InMemoryJobScheduler({ clock });
    scheduler.schedule({
      key: 'slow-check',
      runAt: at(clock, 0),
      timeoutMs: 100,
      handler: async () => {
        clock.advance(200); // the job "ran" for 200ms of injected time
        return { status: 'SUCCESS' };
      },
    });
    const results = await runAndCollect(scheduler);
    expect(results[0].status).toBe('JOB_TIMEOUT');
    expect(results[0].errorCode).toBe('JOB_TIMEOUT');
    // A safely-timed-out job is still fully settled: nothing stays running.
    clock.advance(1);
    const next = await runAndCollect(scheduler);
    expect(next).toEqual([]);
    await scheduler.dispose();
  });

  it('captures handler rejections as safe failure codes without leaking messages', async () => {
    const clock = new ManualClock(new Date(T0));
    const scheduler = new InMemoryJobScheduler({ clock });
    scheduler.schedule({
      key: 'throws',
      runAt: at(clock, 0),
      handler: async () => {
        throw new Error('sensitive internal detail: /home/owner/secret-path');
      },
    });
    const results = await runAndCollect(scheduler);
    expect(results[0].status).toBe('FAILED');
    expect(results[0].errorCode).toBe('JOB_HANDLER_THREW');
    expect(JSON.stringify(results[0])).not.toContain('secret-path');
    await scheduler.dispose();
  });

  it('opens the circuit breaker after N consecutive failures and rejects runs while open', async () => {
    const clock = new ManualClock(new Date(T0));
    const scheduler = new InMemoryJobScheduler({
      clock,
      circuitBreaker: { failureThreshold: 3, cooldownMs: 1_000 },
    });
    const failing = async () => ({ status: 'FAILED' as const, errorCode: 'SYNTHETIC_FAILURE' });

    for (let i = 0; i < 3; i += 1) {
      scheduler.schedule({ key: `job-${i}`, runAt: at(clock, 0), handler: failing });
      const results = await runAndCollect(scheduler);
      expect(results[0].status).toBe('FAILED');
    }

    scheduler.schedule({ key: 'blocked', runAt: at(clock, 0), handler: async () => ({ status: 'SUCCESS' as const }) });
    const blocked = await runAndCollect(scheduler);
    expect(blocked[0].status).toBe('REJECTED_BREAKER_OPEN');
    await scheduler.dispose();
  });

  it('recovers after the cooldown via a half-open trial run (injected time)', async () => {
    const clock = new ManualClock(new Date(T0));
    const scheduler = new InMemoryJobScheduler({
      clock,
      circuitBreaker: { failureThreshold: 2, cooldownMs: 5_000 },
    });
    const failing = async () => ({ status: 'FAILED' as const, errorCode: 'SYNTHETIC_FAILURE' });
    scheduler.schedule({ key: 'f1', runAt: at(clock, 0), handler: failing });
    await runAndCollect(scheduler);
    scheduler.schedule({ key: 'f2', runAt: at(clock, 0), handler: failing });
    await runAndCollect(scheduler);

    scheduler.schedule({ key: 'blocked', runAt: at(clock, 0), handler: async () => ({ status: 'SUCCESS' as const }) });
    expect((await runAndCollect(scheduler))[0].status).toBe('REJECTED_BREAKER_OPEN');

    clock.advance(5_000); // cooldown elapsed
    const trial = await runAndCollect(scheduler);
    expect(trial[0].status).toBe('COMPLETED'); // half-open trial succeeded -> closed

    // Closed again: normal runs proceed.
    scheduler.schedule({ key: 'after-recovery', runAt: at(clock, 0), handler: async () => ({ status: 'SUCCESS' as const }) });
    expect((await runAndCollect(scheduler))[0].status).toBe('COMPLETED');
    await scheduler.dispose();
  });

  it('re-opens immediately when the half-open trial fails', async () => {
    const clock = new ManualClock(new Date(T0));
    const scheduler = new InMemoryJobScheduler({
      clock,
      circuitBreaker: { failureThreshold: 1, cooldownMs: 1_000 },
    });
    scheduler.schedule({ key: 'f1', runAt: at(clock, 0), handler: async () => ({ status: 'FAILED' as const, errorCode: 'X' }) });
    expect((await runAndCollect(scheduler))[0].status).toBe('FAILED');

    clock.advance(1_000);
    scheduler.schedule({ key: 'trial', runAt: at(clock, 0), handler: async () => ({ status: 'FAILED' as const, errorCode: 'X' }) });
    expect((await runAndCollect(scheduler))[0].status).toBe('FAILED');

    scheduler.schedule({ key: 'blocked', runAt: at(clock, 0), handler: async () => ({ status: 'SUCCESS' as const }) });
    expect((await runAndCollect(scheduler))[0].status).toBe('REJECTED_BREAKER_OPEN');
    await scheduler.dispose();
  });

  it('cancel removes a pending job; dispose stops the scheduler and uses no real timers', async () => {
    const clock = new ManualClock(new Date(T0));
    const scheduler = new InMemoryJobScheduler({ clock });
    let ran = 0;
    scheduler.schedule({ key: 'cancelled', runAt: at(clock, 0), handler: async () => { ran += 1; return { status: 'SUCCESS' as const }; } });
    expect(scheduler.cancel('cancelled')).toBe(true);
    expect(scheduler.cancel('missing')).toBe(false);

    await scheduler.dispose();
    expect(scheduler.disposed).toBe(true);
    expect(await scheduler.tick()).toEqual([]);
    expect(ran).toBe(0);
    expect(() => scheduler.schedule({
      key: 'late',
      runAt: at(clock, 0),
      handler: async () => ({ status: 'SUCCESS' as const }),
    })).toThrow();
    // Manual-tick scheduler created no interval handles; jest exits cleanly.
  });
});
