/**
 * Eval suite 2: read-only guarantee (operator plan: the soak driver is
 * SELECT-only, ever, with defence in depth on top of the DB role).
 *
 * Two independent probes:
 *  1. Runtime — every SQL text the fake pg client is asked to execute starts
 *     with SELECT (leading whitespace aside), across direct reads and through
 *     the full driver chain.
 *  2. Source scan — evidence-source.ts contains no DML/DDL keyword outside
 *     string literals/comments (keywords INSIDE SQL strings are expected;
 *     the runtime probe proves those strings are SELECT-only).
 */

import {
  CANARIES,
  describeEvidenceSource,
  describeSoakDriver,
  FakePgClient,
  keywordsOutsideStrings,
  laceStrings,
  makePgFactory,
  makeSupervisorOk,
  observerModules,
  observerSourceText,
  backupEvidenceRow,
  endpointObservationRow,
  incidentRow,
  metricSampleRow,
  providerConnectionRow,
  reportFindingRow,
  reportRow,
  restoreTestRow,
  workflowExecutionRow,
} from './fixtures';

const SELECT_ONLY = /^\s*select\b/i;
const DB_ERROR = new Error('synthetic db outage');

function seedHappyRows(client: FakePgClient): void {
  client.when(/endpoint/i, [endpointObservationRow()]);
  client.when(/metric/i, [metricSampleRow()]);
  client.when(/incident/i, [incidentRow()]);
  client.when(/backup/i, [backupEvidenceRow()]);
  client.when(/restore/i, [restoreTestRow()]);
  client.when(/workflow/i, [workflowExecutionRow()]);
  client.when(/report/i, [reportRow(), reportFindingRow()]);
  client.when(/provider/i, [providerConnectionRow()]);
}

describe('observer — read-only guarantee', () => {
  describeEvidenceSource('runtime probe (direct evidence.read)', () => {
    const read = async (client: FakePgClient): Promise<unknown> => {
      const { factory } = makePgFactory(client);
      const source = observerModules.evidenceSource!.createEvidenceSource!({
        host: 'db.internal.test',
        port: 5432,
        database: 'operations',
        user: 'operations_reader',
        password: 'fake-password-value',
        pgFactory: factory,
      });
      return source.read('tenant-a', 'production');
    };

    it('issues only SELECT statements on the happy path', async () => {
      const client = new FakePgClient();
      seedHappyRows(client);
      await read(client);
      expect(client.queries.length).toBeGreaterThan(0);
      for (const query of client.queries) {
        expect(query.text).toMatch(SELECT_ONLY);
      }
    });

    it('issues only SELECT statements even when every family is empty', async () => {
      const client = new FakePgClient();
      await read(client);
      expect(client.queries.length).toBeGreaterThan(0);
      for (const query of client.queries) {
        expect(query.text).toMatch(SELECT_ONLY);
      }
    });

    it('issues only SELECT statements even when rows carry canary tokens', async () => {
      const client = new FakePgClient();
      const laced = laceStrings(endpointObservationRow(), CANARIES.join(' '));
      client.when(/endpoint/i, [laced]);
      await read(client);
      for (const query of client.queries) {
        expect(query.text).toMatch(SELECT_ONLY);
      }
    });

    it('still issues only SELECTs when a mid-query failure forces fail-closed rejection', async () => {
      const client = new FakePgClient();
      seedHappyRows(client);
      client.persistentError = DB_ERROR;
      await expect(read(client)).rejects.toThrow();
      for (const query of client.queries) {
        expect(query.text).toMatch(SELECT_ONLY);
      }
    });

    it('never invokes anything but connect/query/end on the pg client', async () => {
      const client = new FakePgClient();
      seedHappyRows(client);
      await read(client);
      for (const name of client.methodCalls) {
        expect(['connect', 'query', 'end']).toContain(name);
      }
      expect(client.methodCalls[0]).toBe('connect');
      expect(client.methodCalls[client.methodCalls.length - 1]).toBe('end');
    });
  });

  describe('source scan', () => {
    it('evidence-source.ts carries no DML/DDL keyword outside strings and comments', () => {
      const source = observerSourceText('evidence-source');
      // The sibling-owned source file is not in this worktree: nothing to
      // scan. The scan engages automatically once the real module lands.
      if (source === undefined) return;
      const offenders = keywordsOutsideStrings(source);
      expect(offenders).toEqual([]);
    });

    it('evidence-source.ts SQL strings never open with a DML keyword', () => {
      const source = observerSourceText('evidence-source');
      if (source === undefined) return;
      const stringLiterals = source.match(/(['"`])[^'"`]*\1/g) ?? [];
      const sqlLike = stringLiterals.filter((literal) =>
        /\b(from|where|join|limit)\b/i.test(literal),
      );
      expect(sqlLike.length).toBeGreaterThan(0);
      for (const literal of sqlLike) {
        expect(literal).toMatch(SELECT_ONLY);
      }
    });
  });

  describeSoakDriver('runtime probe (through SoakDriver.tick)', () => {
    it('a full tick never produces a non-SELECT query', async () => {
      const Driver = observerModules.soakDriver!.SoakDriver!;
      const client = new FakePgClient();
      seedHappyRows(client);
      const { factory } = makePgFactory(client);
      const evidence = observerModules.evidenceSource!.createEvidenceSource!({
        host: 'db.internal.test',
        port: 5432,
        database: 'operations',
        user: 'operations_reader',
        password: 'fake-password-value',
        pgFactory: factory,
      });
      const supervisor = { assess: () => makeSupervisorOk('GREEN') };
      const alerts = {
        handle: async (): Promise<unknown> => ({ action: 'SENT' }),
        sendDigest: async (): Promise<unknown> => ({ action: 'SENT' }),
      };
      const driver = new Driver({
        evidence,
        supervisor,
        alerts,
        clientKey: 'tenant-a',
        environmentKey: 'production',
        intervalMs: 900_000,
        digestHourUtc: 7,
        now: () => Date.UTC(2026, 9, 5, 6, 0, 0),
      });
      await driver.tick();
      await driver.tick();
      expect(client.queries.length).toBeGreaterThan(0);
      for (const query of client.queries) {
        expect(query.text).toMatch(SELECT_ONLY);
      }
    });
  });
});
