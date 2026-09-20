/**
 * Eval suite 7: canary leakage, end-to-end (operator-plan 11.2/14).
 *
 * The whole real chain is driven with canary-laced evidence rows:
 * fake pg -> REAL EvidenceSource -> REAL SoakDriver -> REAL SupervisorService
 * -> REAL AlertEngine -> fake sender. The canary tokens (AWS-shaped key,
 * bot-token-shaped string) must never appear in any alert text, digest text,
 * audit event, tick outcome, projection summary or error message. Suites that
 * compose the full chain are skipped until both sibling modules land.
 */

import {
  backupEvidenceRow,
  CANARIES,
  CHAIN_AVAILABLE,
  collectStrings,
  endpointObservationRow,
  FakePgClient,
  incidentRow,
  makePgFactory,
  makeRealAlertEngine,
  makeRealSupervisor,
  ManualClock,
  metricSampleRow,
  observerModules,
  providerConnectionRow,
  reportFindingRow,
  reportRow,
  restoreTestRow,
  workflowExecutionRow,
} from './fixtures';

const describeChain = CHAIN_AVAILABLE ? describe : describe.skip;

function seedLacedHappyRows(client: FakePgClient, clock: ManualClock): void {
  const fresh = { observed_at: clock.iso() };
  client.when(/endpoint/i, [endpointObservationRow(fresh)]);
  client.when(/metric/i, [metricSampleRow(fresh)]);
  client.when(/incident/i, [incidentRow(fresh)]);
  client.when(/backup/i, [backupEvidenceRow(fresh)]);
  client.when(/restore/i, [restoreTestRow(fresh)]);
  client.when(/workflow/i, [workflowExecutionRow(fresh)]);
  client.when(/report/i, [reportRow(fresh), reportFindingRow(fresh)]);
  client.when(/provider/i, [providerConnectionRow(fresh)]);
}

function expectCanaryFree(haystacks: string[]): void {
  for (const haystack of haystacks) {
    for (const canary of CANARIES) {
      expect(haystack).not.toContain(canary);
    }
  }
}

describeChain('Canary leakage end-to-end (real chain)', () => {
  function buildChain(clock: ManualClock) {
    const client = new FakePgClient();
    seedLacedHappyRows(client, clock);
    const { factory } = makePgFactory(client);
    const evidence = observerModules.evidenceSource!.createEvidenceSource!({
      host: 'db.internal.test',
      port: 5432,
      database: 'operations',
      user: 'operations_reader',
      password: `db-password-${CANARIES.join('-')}`,
      pgFactory: factory,
    });
    const { supervisor, audit: supervisorAudit } = makeRealSupervisor(clock);
    const sender = {
      sent: [] as Array<{ kind: string; text: string }>,
      async send(message: { kind: string; text: string }): Promise<void> {
        this.sent.push({ kind: message.kind, text: message.text });
      },
    };
    const driverAudit = { events: [] as unknown[], record(event: unknown): unknown { this.events.push(event); return event; } };
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
    return { client, driver, sender, driverAudit, supervisorAudit };
  }

  it('canaries in DB rows never reach alert or digest text', async () => {
    const clock = new ManualClock(Date.UTC(2026, 9, 5, 6, 59, 0));
    const { driver, sender } = buildChain(clock);

    // Pre-digest tick.
    await driver.tick();
    // Cross the digest boundary.
    clock.setUtc(2026, 9, 5, 7, 0, 0);
    await driver.tick();
    // A failing-tick tick for the error-message channel.
    clock.advance(900_000);
    await driver.tick();

    expectCanaryFree(sender.sent.map((message) => message.text));
  });

  it('canaries never reach driver or supervisor audit events', async () => {
    const clock = new ManualClock(Date.UTC(2026, 9, 5, 8, 0, 0));
    const { driver, driverAudit, supervisorAudit } = buildChain(clock);
    await driver.tick();
    expectCanaryFree(collectStrings(driverAudit.events));
    expectCanaryFree(collectStrings(supervisorAudit.events));
  });

  it('canaries never reach projection summaries and tick outcomes stay clean', async () => {
    const clock = new ManualClock(Date.UTC(2026, 9, 5, 8, 0, 0));
    const { driver, supervisorAudit } = buildChain(clock);
    // Supervisor audit events carry evidenceKeys/summaries derived from the
    // projection; they must stay canary-free.
    const outcome = await driver.tick();
    expect(['ASSESSED', 'DIGEST_SENT']).toContain(outcome.status);
    expectCanaryFree(collectStrings(supervisorAudit.events));
  });

  it('a DB outage error message never leaks the DB password or canaries', async () => {
    const clock = new ManualClock(Date.UTC(2026, 9, 5, 8, 0, 0));
    const { client, driver, driverAudit } = buildChain(clock);
    client.persistentError = new Error(
      `connection failed for user operations_reader password=${CANARIES.join(' ')}`,
    );
    await driver.tick();
    expectCanaryFree(collectStrings(driverAudit.events));
  });
});
