/**
 * Eval suite 8: timing. Interval scheduling with injectable timers, the
 * digest exactly once per UTC day at/after digestHourUtc, the tick overlap
 * guard, and onModuleDestroy awaiting in-flight work.
 */

import {
  describeSoakDriver,
  FakeTimerHub,
  makeSoakFakes,
  makeSoakOptions,
  ManualClock,
  observerModules,
} from './fixtures';

describeSoakDriver('SoakDriver — interval scheduling', () => {
  it('onModuleInit schedules tick at the configured intervalMs; destroy clears it', async () => {
    const Driver = observerModules.soakDriver!.SoakDriver!;
    const timers = new FakeTimerHub();
    const driver = new Driver(
      makeSoakOptions(makeSoakFakes(), new ManualClock(0), timers, { intervalMs: 60_000 }),
    );
    expect(timers.intervals).toHaveLength(0);
    driver.onModuleInit();
    expect(timers.intervals).toHaveLength(1);
    expect(timers.intervals[0].ms).toBe(60_000);
    expect(timers.activeIntervals).toHaveLength(1);

    await driver.onModuleDestroy();
    expect(timers.intervals[0].cleared).toBe(true);
    expect(timers.activeIntervals).toHaveLength(0);
  });

  it('the scheduled interval callback runs ticks', async () => {
    const Driver = observerModules.soakDriver!.SoakDriver!;
    const timers = new FakeTimerHub();
    const fakes = makeSoakFakes();
    let reads = 0;
    fakes.evidence = {
      async read(): Promise<unknown> {
        reads += 1;
        return { client: 'tenant-a', environment: 'production', records: [] };
      },
    };
    const driver = new Driver(makeSoakOptions(fakes, new ManualClock(0), timers));
    driver.onModuleInit();
    // Ticks are async: let each interval-driven tick finish before firing the
    // next callback, or the overlap guard legitimately suppresses it.
    for (let i = 0; i < 3; i += 1) {
      timers.fire(timers.intervals[0].handle, 1);
      await new Promise((resolve) => setImmediate(resolve));
    }
    expect(reads).toBe(3);
    await driver.onModuleDestroy();
  });
});

describeSoakDriver('SoakDriver — digest cadence (manual UTC clock)', () => {
  function digestProbe(digestHourUtc: number) {
    const Driver = observerModules.soakDriver!.SoakDriver!;
    // Start just before the digest hour on 2026-10-05 (UTC).
    const clock = new ManualClock(Date.UTC(2026, 9, 5, digestHourUtc - 1, 59, 0));
    const fakes = makeSoakFakes();
    const driver = new Driver(
      makeSoakOptions(fakes, clock, new FakeTimerHub(), { digestHourUtc }),
    );
    return { driver, fakes, clock };
  }

  it('sends no digest before digestHourUtc', async () => {
    const { driver, fakes } = digestProbe(7);
    const outcome = await driver.tick();
    expect(outcome.status).not.toBe('DIGEST_SENT');
    expect(fakes.alerts.digestCalls).toHaveLength(0);
  });

  it('sends exactly one digest on the first tick at/after digestHourUtc', async () => {
    const { driver, fakes, clock } = digestProbe(7);
    await driver.tick(); // 06:59
    expect(fakes.alerts.digestCalls).toHaveLength(0);

    clock.setUtc(2026, 9, 5, 7, 0, 0);
    const outcome = await driver.tick();
    expect(outcome.status).toBe('DIGEST_SENT');
    expect(fakes.alerts.digestCalls).toHaveLength(1);
    expect(fakes.alerts.digestCalls[0].environmentKey).toBe('production');
    expect(fakes.alerts.digestCalls[0].period).toBe('daily');

    // Same UTC day: never again, whatever the hour.
    for (const [h, m] of [[7, 15], [12, 0], [18, 30], [23, 59]] as const) {
      clock.setUtc(2026, 9, 5, h, m, 0);
      await driver.tick();
    }
    expect(fakes.alerts.digestCalls).toHaveLength(1);
  });

  it('sends the next digest on the following UTC day (day boundary, not 24h)', async () => {
    const { driver, fakes, clock } = digestProbe(7);
    clock.setUtc(2026, 9, 5, 7, 0, 0);
    await driver.tick();
    expect(fakes.alerts.digestCalls).toHaveLength(1);

    // 23 hours later is still the same UTC day: no digest.
    clock.setUtc(2026, 9, 5, 23, 59, 0);
    await driver.tick();
    expect(fakes.alerts.digestCalls).toHaveLength(1);

    // Next UTC day, before the hour: no digest.
    clock.setUtc(2026, 9, 6, 6, 30, 0);
    await driver.tick();
    expect(fakes.alerts.digestCalls).toHaveLength(1);

    // Next UTC day, at the hour: digest.
    clock.setUtc(2026, 9, 6, 7, 0, 0);
    const outcome = await driver.tick();
    expect(outcome.status).toBe('DIGEST_SENT');
    expect(fakes.alerts.digestCalls).toHaveLength(2);
  });

  it('handles digestHourUtc = 0 (first tick of the UTC day digests)', async () => {
    const { driver, fakes, clock } = digestProbe(0);
    clock.setUtc(2026, 9, 5, 0, 0, 0);
    const outcome = await driver.tick();
    expect(outcome.status).toBe('DIGEST_SENT');
    expect(fakes.alerts.digestCalls).toHaveLength(1);
    clock.setUtc(2026, 9, 5, 12, 0, 0);
    await driver.tick();
    expect(fakes.alerts.digestCalls).toHaveLength(1);
  });
});

describeSoakDriver('SoakDriver — overlap guard and destroy semantics', () => {
  it('a tick already in flight suppresses the next tick (TICK_IN_FLIGHT)', async () => {
    const Driver = observerModules.soakDriver!.SoakDriver!;
    let resolveRead: (() => void) | undefined;
    const fakes = makeSoakFakes();
    fakes.evidence = {
      async read(): Promise<unknown> {
        await new Promise<void>((resolve) => {
          resolveRead = resolve;
        });
        return { client: 'tenant-a', environment: 'production', records: [] };
      },
    };
    const driver = new Driver(makeSoakOptions(fakes, new ManualClock(0), new FakeTimerHub()));

    const first = driver.tick();
    const second = await driver.tick();
    expect(second).toEqual({ status: 'SUPPRESSED', reason: 'TICK_IN_FLIGHT' });

    resolveRead!();
    const firstOutcome = await first;
    expect(firstOutcome.status).toBe('ASSESSED');
  });

  it('onModuleDestroy awaits an in-flight tick before resolving', async () => {
    const Driver = observerModules.soakDriver!.SoakDriver!;
    let resolveRead: (() => void) | undefined;
    let handleCompleted = false;
    const fakes = makeSoakFakes();
    fakes.evidence = {
      async read(): Promise<unknown> {
        await new Promise<void>((resolve) => {
          resolveRead = resolve;
        });
        return { client: 'tenant-a', environment: 'production', records: [] };
      },
    };
    fakes.alerts.handle = async (): Promise<unknown> => {
      handleCompleted = true;
      return { action: 'SENT' };
    };
    const timers = new FakeTimerHub();
    const driver = new Driver(makeSoakOptions(fakes, new ManualClock(0), timers));
    driver.onModuleInit();

    void driver.tick();
    let destroyResolved = false;
    const destroying = driver.onModuleDestroy().then(() => {
      destroyResolved = true;
    });
    // The read is still pending: destroy must not have resolved.
    expect(destroyResolved).toBe(false);

    resolveRead!();
    await destroying;
    expect(destroyResolved).toBe(true);
    expect(handleCompleted).toBe(true);
    expect(timers.intervals[0].cleared).toBe(true);
  });
});
