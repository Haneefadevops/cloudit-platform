/**
 * Eval suite 3: fail-closed behavior (soak-driver spec: "Rejects on ANY
 * database error — fail closed"; the driver maps a rejection to an
 * all-UNKNOWN assessment path and "a sustained DB outage produces ONE deduped
 * alert and a recovery message after restore — honest watchdog behavior").
 *
 * Probed end-to-end with the REAL chain: fake pg -> REAL EvidenceSource ->
 * REAL SoakDriver -> REAL SupervisorService -> REAL AlertEngine -> fake
 * sender. Nothing is stubbed between the module under test and the alert
 * text; engine-level dedup is observed on the sender.
 *
 * CONTRACT TENSION (reported as a finding): a literal all-UNKNOWN synthetic
 * projection with freshUntil = now classifies as verdict UNKNOWN, which the
 * AlertEngine skips (SKIPPED_NOT_RED) — zero alerts. The contract's "ONE
 * deduped alert + recovery" promise therefore requires the blind path to
 * produce a RED-classified verdict (e.g. stale/failed blind records). These
 * evals assert the contract promise; a compliant implementation must satisfy
 * it.
 */

import {
  CHAIN_AVAILABLE,
  describeEvidenceSource,
  describeSoakDriver,
  FakePgClient,
  makeBlindProjection,
  makePgFactory,
  makeRealAlertEngine,
  makeRealSupervisor,
  ManualClock,
  observerModules,
} from './fixtures';

const DB_ERROR = new Error('synthetic db outage: connection reset');

describeEvidenceSource('EvidenceSource — fail-closed reads', () => {
  const buildSource = (client: FakePgClient) => {
    const { factory } = makePgFactory(client);
    return observerModules.evidenceSource!.createEvidenceSource!({
      host: 'db.internal.test',
      port: 5432,
      database: 'operations',
      user: 'operations_reader',
      password: 'fake-password-value',
      pgFactory: factory,
    });
  };

  it('rejects on connect/query failure and never returns partial data', async () => {
    const client = new FakePgClient();
    client.persistentError = DB_ERROR;
    const source = buildSource(client);
    await expect(source.read('tenant-a', 'production')).rejects.toThrow();
  });

  it('rejects when a mid-family query fails (no silently partial projection)', async () => {
    const client = new FakePgClient();
    client.when(/endpoint/i, [{ endpoint_key: 'x', observed_at: '2026-10-05T06:00:00.000Z' }]);
    let calls = 0;
    client.onQuery = () => {
      calls += 1;
      if (calls === 3) throw DB_ERROR;
    };
    const source = buildSource(client);
    await expect(source.read('tenant-a', 'production')).rejects.toThrow();
  });

  it('ends the pg client even on failure (finally)', async () => {
    const client = new FakePgClient();
    client.persistentError = DB_ERROR;
    const source = buildSource(client);
    await expect(source.read('tenant-a', 'production')).rejects.toThrow();
    expect(client.ended).toBe(true);
  });

  it('rejection message is bounded and credential-free', async () => {
    const client = new FakePgClient();
    client.persistentError = new Error('synthetic failure detail');
    const { factory, capturedConfigs } = makePgFactory(client);
    const source = observerModules.evidenceSource!.createEvidenceSource!({
      host: 'db.internal.test',
      port: 5432,
      database: 'operations',
      user: 'operations_reader',
      password: 's0ak-super-secret-password-VALUE',
      pgFactory: factory,
    });
    const failure = await source.read('tenant-a', 'production').then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(failure).toBeDefined();
    const message = failure instanceof Error ? failure.message : String(failure);
    expect(message).not.toContain('s0ak-super-secret-password-VALUE');
    expect(message).not.toContain('operations_reader');
    expect(message.length).toBeLessThanOrEqual(300);
    // The password went to the pg factory config only.
    expect(JSON.stringify(capturedConfigs)).toContain('s0ak-super-secret-password-VALUE');
  });
});

const describeChain = CHAIN_AVAILABLE ? describe : describe.skip;

describeChain('Fail-closed end-to-end (real chain) — outage, dedup, recovery', () => {
  function buildChain(clock: ManualClock) {
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
    const { supervisor } = makeRealSupervisor(clock);
    const sender = { sent: [] as Array<{ kind: string; text: string }>, async send(m: { kind: string; text: string }) { this.sent.push({ kind: m.kind, text: m.text }); } };
    const alerts = makeRealAlertEngine(clock, sender);
    const audit = { events: [] as unknown[], record(event: unknown): unknown { this.events.push(event); return event; } };
    const Driver = observerModules.soakDriver!.SoakDriver!;
    const driver = new Driver({
      evidence,
      supervisor: supervisor as unknown as { assess(input: unknown): never },
      alerts: alerts as unknown as {
        handle(environmentKey: string, verdict: unknown): Promise<unknown>;
        sendDigest(environmentKey: string, period: 'daily', entries: unknown[]): Promise<unknown>;
      },
      audit,
      clientKey: 'tenant-a',
      environmentKey: 'production',
      intervalMs: 900_000,
      // Late digest hour: these evals isolate alert behavior from digest sends.
      digestHourUtc: 23,
      now: clock.now,
    });
    return { client, driver, sender, audit };
  }

  it('a sustained DB outage produces exactly ONE red alert across many failing ticks', async () => {
    const clock = new ManualClock(Date.UTC(2026, 9, 5, 8, 0, 0));
    const { client, driver, sender } = buildChain(clock);
    client.persistentError = DB_ERROR;

    const outcomes = [];
    for (let i = 0; i < 5; i += 1) {
      clock.advance(60_000);
      outcomes.push(await driver.tick());
    }

    for (const outcome of outcomes) {
      expect(['ASSESSED', 'SUPPRESSED']).toContain(outcome.status);
    }
    const redAlerts = sender.sent.filter((message) => message.kind === 'red_alert');
    // Contract promise: honest watchdog — the operator is paged once, not
    // every 15 minutes, and not zero times.
    expect(redAlerts).toHaveLength(1);
  });

  it('audits the read failure (observer_read / EVIDENCE_READ_FAILED) on failing ticks', async () => {
    const clock = new ManualClock(Date.UTC(2026, 9, 5, 8, 0, 0));
    const { client, driver, audit } = buildChain(clock);
    client.persistentError = DB_ERROR;
    await driver.tick();

    const reasons = audit.events
      .map((event) => {
        const record = event as Record<string, unknown>;
        return record.reasonCode ?? record.reason;
      })
      .filter(Boolean);
    expect(reasons).toContain('EVIDENCE_READ_FAILED');
  });

  it('recovery after restore sends exactly ONE recovery message', async () => {
    const clock = new ManualClock(Date.UTC(2026, 9, 5, 8, 0, 0));
    const { client, driver, sender } = buildChain(clock);
    client.persistentError = DB_ERROR;
    await driver.tick();
    await driver.tick();
    expect(sender.sent.filter((message) => message.kind === 'red_alert')).toHaveLength(1);

    // DB back: every evidence family returns fresh GREEN rows so the
    // supervisor can clear the alerted subject and the engine emits recovery.
    client.persistentError = undefined;
    const fresh = {
      observed_at: clock.iso(),
      status: 'GREEN',
      severity: 'none',
    };
    client.when(/endpoint/i, [
      {
        endpoint_key: 'public-site',
        endpoint_url: 'https://example.test',
        monitor_kind: 'http',
        confirmation_state: 'confirmed',
        ...fresh,
      },
    ]);
    client.when(/metric/i, [
      { metric_key: 'postgresql.connections', freshness_seconds: 3600, ...fresh },
    ]);
    client.when(/incident/i, [{ incident_key: 'none', state: 'resolved', ...fresh }]);
    client.when(/backup/i, [{ backup_key: 'daily', backup_timestamp: clock.iso(), ...fresh }]);
    client.when(/restore/i, [{ restore_test_key: 'restore', result: 'passed', ...fresh }]);
    client.when(/workflow/i, [{ workflow_key: 'nightly', outcome: 'success', ...fresh }]);
    client.when(/report/i, [{ report_key: 'monthly', overall_status: 'GREEN', ...fresh }]);
    client.when(/provider/i, [{ provider: 'supabase', reachable: true, ...fresh }]);
    clock.advance(900_000);
    await driver.tick();

    const recoveries = sender.sent.filter((message) => message.kind === 'recovery');
    // Contract promise: one recovery message after restore.
    expect(recoveries).toHaveLength(1);
    // And no second red alert fired after restore.
    expect(sender.sent.filter((message) => message.kind === 'red_alert')).toHaveLength(1);
  });
});

describeSoakDriver('SoakDriver — fail-closed mapping (faked ports)', () => {
  it('feeds the synthetic all-UNKNOWN blind projection to the supervisor on read failure', async () => {
    const Driver = observerModules.soakDriver!.SoakDriver!;
    const now = Date.UTC(2026, 9, 5, 8, 0, 0);
    const supervisorInputs: unknown[] = [];
    const handled: string[] = [];
    const driver = new Driver({
      evidence: {
        async read(): Promise<unknown> {
          throw DB_ERROR;
        },
      },
      supervisor: {
        assess(input: unknown) {
          supervisorInputs.push(input);
          return {
            ok: true,
            assessment: {
              assessment: 'UNKNOWN',
              summary: 'synthetic',
              evidenceKeys: [],
              confidence: 'HIGH',
              issueCode: 'STATUS_UNKNOWN',
              recommendedRunbook: 'none',
              automationEligibility: 'OWNER_REQUIRED',
            },
          };
        },
      },
      alerts: {
        async handle(environmentKey: string): Promise<unknown> {
          handled.push(environmentKey);
          return { action: 'SENT' };
        },
        async sendDigest(): Promise<unknown> {
          return { action: 'SENT' };
        },
      },
      clientKey: 'tenant-a',
      environmentKey: 'production',
      intervalMs: 900_000,
      // Late digest hour: this eval isolates the blind-mapping path from the
      // digest path.
      digestHourUtc: 23,
      now: () => now,
    });

    const outcome = await driver.tick();
    expect(outcome.status).toBe('ASSESSED');

    // The supervisor must see the contract-shaped blind projection: all core
    // required sources UNKNOWN/'required' with the fixed safe summary and
    // now-based ISO timestamps.
    const expected = makeBlindProjection('tenant-a', 'production', now);
    expect(supervisorInputs).toHaveLength(1);
    expect(supervisorInputs[0]).toEqual(expected);
    // ...and the resulting verdict is still pushed through alerts.handle.
    expect(handled).toEqual(['production']);
  });
});
