/**
 * Eval suite 6: audit trail and never-throws behavior.
 *
 * The soak driver must record exactly ONE bounded, closed audit event per
 * internal failure — no stack traces, no projection content, no secrets —
 * and tick() must resolve under every adversarial failure mode (sync throws,
 * rejecting promises, throwing assess, rejecting handle/sendDigest, even a
 * throwing audit sink).
 */

import {
  collectStrings,
  describeSoakDriver,
  eventTypeOf,
  makeSoakFakes,
  makeSoakOptions,
  ManualClock,
  FakeTimerHub,
  observerModules,
  reasonOf,
} from './fixtures';

const STACK_TRACE_PATTERN = /\n\s+at\s+\S+/;
const CLOSED_EVENT_TYPES = ['observer_read', 'observer_internal'];

function expectClosedEvent(event: unknown, eventType: string, reason: string): void {
  expect(eventTypeOf(event)).toBe(eventType);
  expect(reasonOf(event)).toBe(reason);
  const strings = collectStrings(event);
  for (const text of strings) {
    expect(text.length).toBeLessThanOrEqual(500);
    expect(text).not.toMatch(STACK_TRACE_PATTERN);
  }
  // Closed shape: no raw projection content may ride along.
  const serialized = JSON.stringify(event);
  expect(serialized).not.toContain('observer blind');
  expect(serialized).not.toContain('safeSummary');
  expect(serialized).not.toContain('records');
}

describeSoakDriver('SoakDriver — audit trail', () => {
  it('read failure records exactly one closed observer_read/EVIDENCE_READ_FAILED event', async () => {
    const Driver = observerModules.soakDriver!.SoakDriver!;
    const fakes = makeSoakFakes();
    fakes.evidence = {
      async read(): Promise<unknown> {
        throw new Error('synthetic db outage');
      },
    };
    const driver = new Driver(
      makeSoakOptions(fakes, new ManualClock(0), new FakeTimerHub()),
    );
    await driver.tick();

    const observerEvents = fakes.audit.events.filter(
      (event) => CLOSED_EVENT_TYPES.includes(String(eventTypeOf(event))) ,
    );
    expect(observerEvents).toHaveLength(1);
    expectClosedEvent(observerEvents[0], 'observer_read', 'EVIDENCE_READ_FAILED');
  });

  it('assessment rejected (ok:false) records one observer_internal/ASSESSMENT_REJECTED event and skips alerts', async () => {
    const Driver = observerModules.soakDriver!.SoakDriver!;
    const fakes = makeSoakFakes();
    fakes.supervisor.results.push({ ok: false, errors: ['synthetic projection rejected'] });
    const driver = new Driver(
      makeSoakOptions(fakes, new ManualClock(0), new FakeTimerHub()),
    );
    const outcome = await driver.tick();

    expect(outcome.status).toBe('ASSESSED');
    expect(fakes.alerts.handleCalls).toHaveLength(0);
    const observerEvents = fakes.audit.events.filter((event) =>
      CLOSED_EVENT_TYPES.includes(String(eventTypeOf(event))),
    );
    expect(observerEvents).toHaveLength(1);
    expectClosedEvent(observerEvents[0], 'observer_internal', 'ASSESSMENT_REJECTED');
  });

  it('alert dispatch failure records one bounded event and still resolves', async () => {
    const Driver = observerModules.soakDriver!.SoakDriver!;
    const fakes = makeSoakFakes();
    fakes.alerts.handleError = new Error('synthetic sender outage');
    const driver = new Driver(
      makeSoakOptions(fakes, new ManualClock(0), new FakeTimerHub()),
    );
    const outcome = await driver.tick();

    expect(outcome.status).toBe('ASSESSED');
    const observerEvents = fakes.audit.events.filter((event) =>
      CLOSED_EVENT_TYPES.includes(String(eventTypeOf(event))),
    );
    expect(observerEvents).toHaveLength(1);
    const strings = collectStrings(observerEvents[0]);
    for (const text of strings) {
      expect(text.length).toBeLessThanOrEqual(500);
      expect(text).not.toMatch(STACK_TRACE_PATTERN);
    }
  });

  it('digest failure records a bounded event and the tick resolves', async () => {
    const Driver = observerModules.soakDriver!.SoakDriver!;
    const clock = new ManualClock(Date.UTC(2026, 9, 5, 7, 0, 0));
    const fakes = makeSoakFakes();
    fakes.alerts.digestError = new Error('synthetic digest failure');
    const driver = new Driver(makeSoakOptions(fakes, clock, new FakeTimerHub()));
    const outcome = await driver.tick();

    expect(['DIGEST_SENT', 'ASSESSED']).toContain(outcome.status);
    // Exactly one observer-level failure event; the digest attempt itself
    // must not throw out of tick().
    const observerEvents = fakes.audit.events.filter((event) =>
      CLOSED_EVENT_TYPES.includes(String(eventTypeOf(event))),
    );
    expect(observerEvents).toHaveLength(1);
  });
});

describeSoakDriver('SoakDriver — never throws', () => {
  it('resolves when evidence.read throws synchronously', async () => {
    const Driver = observerModules.soakDriver!.SoakDriver!;
    const fakes = makeSoakFakes();
    fakes.evidence = {
      read(): Promise<unknown> {
        throw new Error('sync throw from read');
      },
    };
    const driver = new Driver(
      makeSoakOptions(fakes, new ManualClock(0), new FakeTimerHub()),
    );
    await expect(driver.tick()).resolves.toBeDefined();
  });

  it('resolves when evidence.read resolves to garbage (null / string / number)', async () => {
    const Driver = observerModules.soakDriver!.SoakDriver!;
    for (const garbage of [null, 'garbage', 42, undefined]) {
      const fakes = makeSoakFakes();
      fakes.evidence = {
        async read(): Promise<unknown> {
          return garbage;
        },
      };
      const driver = new Driver(
        makeSoakOptions(fakes, new ManualClock(0), new FakeTimerHub()),
      );
      await expect(driver.tick()).resolves.toBeDefined();
    }
  });

  it('resolves when supervisor.assess throws', async () => {
    const Driver = observerModules.soakDriver!.SoakDriver!;
    const fakes = makeSoakFakes();
    fakes.supervisor.throwOnAssess = new Error('sync throw from assess');
    const driver = new Driver(
      makeSoakOptions(fakes, new ManualClock(0), new FakeTimerHub()),
    );
    const outcome = await driver.tick();
    // Fallback contract: unexpected internal error -> {ASSESSED, red:false}.
    expect(outcome).toEqual({ status: 'ASSESSED', red: false });
  });

  it('resolves when alerts.handle rejects', async () => {
    const Driver = observerModules.soakDriver!.SoakDriver!;
    const fakes = makeSoakFakes();
    fakes.alerts.handleError = new Error('async reject from handle');
    const driver = new Driver(
      makeSoakOptions(fakes, new ManualClock(0), new FakeTimerHub()),
    );
    await expect(driver.tick()).resolves.toBeDefined();
  });

  it('resolves when the audit sink itself throws', async () => {
    const Driver = observerModules.soakDriver!.SoakDriver!;
    const fakes = makeSoakFakes();
    fakes.evidence = {
      async read(): Promise<unknown> {
        throw new Error('read failed and audit will too');
      },
    };
    fakes.audit.throwOnRecord = true;
    const driver = new Driver(
      makeSoakOptions(fakes, new ManualClock(0), new FakeTimerHub()),
    );
    await expect(driver.tick()).resolves.toBeDefined();
  });
});
