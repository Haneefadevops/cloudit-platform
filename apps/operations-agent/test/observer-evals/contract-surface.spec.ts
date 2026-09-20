/**
 * Eval suite 1: contract surface. The sibling-owned modules must export
 * exactly the integration contract the programme agreed: a
 * `createEvidenceSource` factory and a `SoakDriver` class with
 * onModuleInit/onModuleDestroy/tick. A present-but-differently-shaped module
 * is a FINDING and fails here; an absent module skips (see fixtures).
 */

import {
  describeEvidenceSource,
  describeSoakDriver,
  makeSoakFakes,
  makeSoakOptions,
  ManualClock,
  FakeTimerHub,
  observerModules,
} from './fixtures';

describe('observer modules — contract surface', () => {
  describeEvidenceSource('evidence-source exports', () => {
    it('exposes createEvidenceSource(options) -> { read(clientKey, environmentKey) }', () => {
      const mod = observerModules.evidenceSource!;
      expect(typeof mod.createEvidenceSource).toBe('function');
    });

    it('createEvidenceSource returns an object with a read() function', () => {
      const mod = observerModules.evidenceSource!;
      const client = { connect: async () => {}, query: async () => ({ rows: [] }), end: async () => {} };
      const source = mod.createEvidenceSource!({
        host: 'h',
        port: 5432,
        database: 'operations',
        user: 'operations_reader',
        password: 'x',
        pgFactory: () => client,
      });
      expect(typeof source.read).toBe('function');
      expect(source.read.length).toBe(2);
    });
  });

  describeSoakDriver('soak-driver exports', () => {
    it('exposes a SoakDriver class constructible with SoakDriverOptions', () => {
      const Driver = observerModules.soakDriver!.SoakDriver!;
      const clock = new ManualClock(0);
      const timers = new FakeTimerHub();
      const driver = new Driver(makeSoakOptions(makeSoakFakes(), clock, timers));
      expect(typeof driver.onModuleInit).toBe('function');
      expect(typeof driver.onModuleDestroy).toBe('function');
      expect(typeof driver.tick).toBe('function');
    });

    it('tick() resolves to one of the three closed TickOutcome shapes', async () => {
      const Driver = observerModules.soakDriver!.SoakDriver!;
      const clock = new ManualClock(0);
      const timers = new FakeTimerHub();
      const driver = new Driver(makeSoakOptions(makeSoakFakes(), clock, timers));
      const outcome = await driver.tick();
      expect(['ASSESSED', 'DIGEST_SENT', 'SUPPRESSED']).toContain(outcome.status);
      if (outcome.status === 'ASSESSED') {
        expect(typeof outcome.red).toBe('boolean');
      } else if (outcome.status === 'SUPPRESSED') {
        expect(outcome.reason).toBe('TICK_IN_FLIGHT');
      }
      await driver.onModuleDestroy();
    });
  });
});
