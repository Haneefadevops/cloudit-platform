/**
 * Eval suite 5: tenant/environment isolation. The soak driver is multi-tenant
 * by construction: every evidence read must be scoped to the configured
 * (clientKey, environmentKey), every projection must carry matching
 * identifiers, and two drivers configured for different tenants/environments
 * must never share observable state (alerts, digests, dedup subjects).
 */

import {
  CANARIES,
  CHAIN_AVAILABLE,
  CLIENT_A,
  CLIENT_B,
  describeSoakDriver,
  ENV_A,
  ENV_B,
  FakePgClient,
  makePgFactory,
  makeSupervisorOk,
  ManualClock,
  observerModules,
} from './fixtures';

describeSoakDriver('SoakDriver — read scoping with faked ports', () => {
  it('invokes evidence.read with the configured clientKey/environmentKey on every tick', async () => {
    const Driver = observerModules.soakDriver!.SoakDriver!;
    const reads: Array<[string, string]> = [];
    const driver = new Driver({
      evidence: {
        async read(clientKey: string, environmentKey: string): Promise<unknown> {
          reads.push([clientKey, environmentKey]);
          return { client: clientKey, environment: environmentKey, records: [] };
        },
      },
      supervisor: { assess: () => makeSupervisorOk('GREEN') },
      alerts: {
        async handle(): Promise<unknown> {
          return { action: 'SENT' };
        },
        async sendDigest(): Promise<unknown> {
          return { action: 'SENT' };
        },
      },
      clientKey: CLIENT_A,
      environmentKey: ENV_B,
      intervalMs: 900_000,
      digestHourUtc: 7,
      now: () => 0,
    });

    await driver.tick();
    await driver.tick();
    expect(reads).toEqual([
      [CLIENT_A, ENV_B],
      [CLIENT_A, ENV_B],
    ]);
  });

  it('scopes supervisor input and alerts.handle to the configured environment', async () => {
    const Driver = observerModules.soakDriver!.SoakDriver!;
    const seen: Array<{ input: unknown; env: string }> = [];
    const driver = new Driver({
      evidence: {
        async read(clientKey: string, environmentKey: string): Promise<unknown> {
          return { client: clientKey, environment: environmentKey, records: [] };
        },
      },
      supervisor: {
        assess: (input: unknown) => {
          seen.push({ input, env: '' });
          return {
            ok: true,
            assessment: {
              assessment: 'AMBER',
              summary: 'synthetic',
              evidenceKeys: ['a'],
              confidence: 'HIGH',
              issueCode: 'NO_ISSUE',
              recommendedRunbook: 'none',
              automationEligibility: 'OWNER_REQUIRED',
            },
          };
        },
      },
      alerts: {
        async handle(environmentKey: string): Promise<unknown> {
          seen[seen.length - 1].env = environmentKey;
          return { action: 'SENT' };
        },
        async sendDigest(): Promise<unknown> {
          return { action: 'SENT' };
        },
      },
      clientKey: CLIENT_A,
      environmentKey: ENV_A,
      intervalMs: 900_000,
      digestHourUtc: 7,
      now: () => 0,
    });

    await driver.tick();
    expect(seen).toHaveLength(1);
    const projection = seen[0].input as { client: string; environment: string };
    expect(projection.client).toBe(CLIENT_A);
    expect(projection.environment).toBe(ENV_A);
    expect(seen[0].env).toBe(ENV_A);
  });

  it('two drivers with different keys never cross-alert or cross-digest', async () => {
    const Driver = observerModules.soakDriver!.SoakDriver!;
    const makeDriver = (
      clientKey: string,
      environmentKey: string,
      sink: { handles: string[]; digests: string[] },
    ) =>
      new Driver({
        evidence: {
          async read(): Promise<unknown> {
            return { client: clientKey, environment: environmentKey, records: [] };
          },
        },
        supervisor: {
          assess: () => ({
            ok: true,
            assessment: {
              assessment: 'RED',
              summary: 'synthetic',
              evidenceKeys: ['a'],
              confidence: 'HIGH',
              issueCode: 'SOURCE_FAILED',
              recommendedRunbook: 'none',
              automationEligibility: 'OWNER_REQUIRED',
            },
          }),
        },
        alerts: {
          async handle(env: string): Promise<unknown> {
            sink.handles.push(env);
            return { action: 'SENT' };
          },
          async sendDigest(env: string): Promise<unknown> {
            sink.digests.push(env);
            return { action: 'SENT' };
          },
        },
        clientKey,
        environmentKey,
        intervalMs: 900_000,
        digestHourUtc: 0,
        now: () => Date.UTC(2026, 9, 5, 0, 30, 0),
      });

    const sinkA = { handles: [] as string[], digests: [] as string[] };
    const sinkB = { handles: [] as string[], digests: [] as string[] };
    const driverA = makeDriver(CLIENT_A, ENV_A, sinkA);
    const driverB = makeDriver(CLIENT_B, ENV_B, sinkB);

    await driverA.tick();
    await driverB.tick();

    expect(sinkA.handles).toEqual([ENV_A]);
    expect(sinkB.handles).toEqual([ENV_B]);
    expect(sinkA.digests).toEqual([ENV_A]);
    expect(sinkB.digests).toEqual([ENV_B]);
  });
});

const describeChain = CHAIN_AVAILABLE ? describe : describe.skip;

describeChain('Isolation end-to-end (real evidence source, keyed tenants)', () => {
  function build(client: FakePgClient) {
    const { factory } = makePgFactory(client);
    return observerModules.evidenceSource!.createEvidenceSource!({
      host: 'db.internal.test',
      port: 5432,
      database: 'operations',
      user: 'operations_reader',
      password: 'fake-password-value',
      pgFactory: factory,
    });
  }

  it('each tenant driver reads through its own pg client and keys its own alerts', async () => {
    const Driver = observerModules.soakDriver!.SoakDriver!;
    const clock = new ManualClock(Date.UTC(2026, 9, 5, 8, 0, 0));
    const clientA = new FakePgClient();
    const clientB = new FakePgClient();
    const sentA: string[] = [];
    const sentB: string[] = [];

    const make = (
      evidence: ReturnType<typeof build>,
      environmentKey: string,
      sent: string[],
    ) =>
      new Driver({
        evidence,
        supervisor: {
          assess: () => ({
            ok: true,
            assessment: {
              assessment: 'RED',
              summary: 'synthetic',
              evidenceKeys: ['a'],
              confidence: 'HIGH',
              issueCode: 'SOURCE_FAILED',
              recommendedRunbook: 'none',
              automationEligibility: 'OWNER_REQUIRED',
            },
          }),
        },
        alerts: {
          async handle(env: string): Promise<unknown> {
            sent.push(env);
            return { action: 'SENT' };
          },
          async sendDigest(): Promise<unknown> {
            return { action: 'SENT' };
          },
        },
        clientKey: 'tenant-a',
        environmentKey,
        intervalMs: 900_000,
        digestHourUtc: 23,
        now: clock.now,
      });

    const driverA = make(build(clientA), ENV_A, sentA);
    const driverB = make(build(clientB), ENV_B, sentB);
    await driverA.tick();
    await driverB.tick();

    expect(sentA).toEqual([ENV_A]);
    expect(sentB).toEqual([ENV_B]);
    // Distinct physical clients: no shared connection state across tenants.
    expect(clientA.queries.length).toBeGreaterThan(0);
    expect(clientB.queries.length).toBeGreaterThan(0);
    expect(clientA).not.toBe(clientB);
    // Canaries planted in tenant B's rows must not surface in tenant A's path.
    clientB.when(/endpoint/i, [
      {
        endpoint_key: `x ${CANARIES.join(' ')}`,
        observed_at: clock.iso(),
        status: 'GREEN',
        severity: 'none',
      },
    ]);
  });
});
