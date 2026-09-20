/**
 * Eval suite 9: no-write end-to-end. Driving the complete REAL chain over
 * many ticks — healthy reads, an outage stretch, restore, and a digest
 * boundary — the fake pg client must observe ONLY SELECT statements and only
 * the connect/query/end methods, and no evidence-row content may appear in
 * any outbound message.
 */

import {
  CANARIES,
  CHAIN_AVAILABLE,
  collectStrings,
  endpointObservationRow,
  FakePgClient,
  makePgFactory,
  makeRealAlertEngine,
  makeRealSupervisor,
  ManualClock,
  metricSampleRow,
  observerModules,
} from './fixtures';

const describeChain = CHAIN_AVAILABLE ? describe : describe.skip;

const SELECT_ONLY = /^\s*select\b/i;

describeChain('No-write end-to-end (real chain, multi-tick soak)', () => {
  it('every query across 8 mixed ticks is a SELECT; only connect/query/end are called', async () => {
    const clock = new ManualClock(Date.UTC(2026, 9, 5, 5, 30, 0));
    const client = new FakePgClient();
    const { factory } = makePgFactory(client);
    const evidence = observerModules.evidenceSource!.createEvidenceSource!({
      host: 'db.internal.test',
      port: 5432,
      database: 'operations',
      user: 'operations_reader',
      password: 'fake-password-value',
      pgFactory: factory,
    });
    const { supervisor, audit: supervisorAudit } = makeRealSupervisor(clock);
    const sender = {
      sent: [] as Array<{ kind: string; text: string }>,
      async send(message: { kind: string; text: string }): Promise<void> {
        this.sent.push({ kind: message.kind, text: message.text });
      },
    };
    const driverAudit = {
      events: [] as unknown[],
      record(event: unknown): unknown {
        this.events.push(event);
        return event;
      },
    };
    const alerts = makeRealAlertEngine(clock, sender, driverAudit);
    const Driver = observerModules.soakDriver!.SoakDriver!;
    const driver = new Driver({
      evidence,
      supervisor: supervisor as unknown as { assess(input: unknown): never },
      alerts: alerts as unknown as {
        handle(environmentKey: string, verdict: unknown): Promise<unknown>;
        sendDigest(environmentKey: string, period: 'daily', entries: unknown[]): Promise<unknown>;
      },
      audit: driverAudit,
      clientKey: 'tenant-a',
      environmentKey: 'production',
      intervalMs: 900_000,
      digestHourUtc: 7,
      now: clock.now,
    });

    // Ticks 1-2: healthy, canary-laced rows.
    const fresh = { observed_at: clock.iso() };
    client.when(/endpoint/i, [endpointObservationRow(fresh)]);
    client.when(/metric/i, [metricSampleRow(fresh)]);
    await driver.tick();
    clock.advance(900_000);
    await driver.tick();

    // Ticks 3-5: outage (fail-closed path).
    client.persistentError = new Error('synthetic outage mid-soak');
    for (let i = 0; i < 3; i += 1) {
      clock.advance(900_000);
      await driver.tick();
    }

    // Tick 6: restore.
    client.persistentError = undefined;
    clock.advance(900_000);
    await driver.tick();

    // Ticks 7-8: cross the digest boundary (07:00 UTC).
    clock.setUtc(2026, 9, 5, 6, 59, 0);
    await driver.tick();
    clock.setUtc(2026, 9, 5, 7, 0, 0);
    await driver.tick();

    // The no-write guarantee on the wire.
    expect(client.queries.length).toBeGreaterThan(0);
    for (const query of client.queries) {
      expect(query.text).toMatch(SELECT_ONLY);
    }
    for (const name of client.methodCalls) {
      expect(['connect', 'query', 'end']).toContain(name);
    }

    // Nothing that crossed an outbound boundary may carry row content.
    for (const message of sender.sent) {
      for (const canary of CANARIES) {
        expect(message.text).not.toContain(canary);
      }
    }
    for (const text of collectStrings(driverAudit.events)) {
      for (const canary of CANARIES) {
        expect(text).not.toContain(canary);
      }
    }
    for (const text of collectStrings(supervisorAudit.events)) {
      for (const canary of CANARIES) {
        expect(text).not.toContain(canary);
      }
    }
  });
});
