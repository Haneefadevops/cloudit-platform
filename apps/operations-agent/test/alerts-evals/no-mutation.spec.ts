/**
 * Eval suite 9: no-mutation guarantees (operator-plan 7/14 — "structural
 * absence of repair action, backup restore/decrypt, credential,
 * client-notification, ticket, arbitrary HTTP, SQL and shell paths").
 *
 * The alert engine is a notification surface only: it exposes exactly
 * handle() and sendDigest(), carries no repair/mutation method, and never
 * mutates the input verdict object it is given.
 */

import { AlertEngine } from '../../src/alerts';
import {
  buildEngineOptions,
  deepFreeze,
  ENV_KEY,
  makeVerdict,
  RecordingSender,
  SUBJECT_BACKUP_STALE,
} from './fixtures';

const MUTATION_METHOD_PATTERN =
  /repair|remediat|execute|mutation|rollback|deploy|restart|restore|decrypt|credential|approve|reject|notify|ticket|shell|sql/i;

describe('AlertEngine — no-mutation evals', () => {
  it('exposes handle() and sendDigest() as its public capability surface', () => {
    const engine = new AlertEngine(buildEngineOptions({}));
    const record = engine as unknown as Record<string, unknown>;

    // TypeScript-private helpers still exist at runtime by design; the
    // security property is the PUBLIC surface: the two read-only entry
    // points are present, and no method matches the mutation denylist
    // (asserted explicitly in the tests below).
    expect(typeof record.handle).toBe('function');
    expect(typeof record.sendDigest).toBe('function');
  });

  it.each([
    'handleRepair',
    'executeRunbook',
    'restartService',
    'restoreBackup',
    'rotateCredentials',
    'approveReport',
    'sendClientNotification',
    'createTicket',
    'runSql',
    'execShell',
  ])('has no mutation method named "%s"', (name) => {
    const engine = new AlertEngine(buildEngineOptions({})) as unknown as Record<string, unknown>;
    expect(engine[name]).toBeUndefined();
  });

  it('no method name on the engine matches the mutation denylist', () => {
    const engine = new AlertEngine(buildEngineOptions({}));
    const names = new Set<string>([
      ...Object.getOwnPropertyNames(Object.getPrototypeOf(engine)),
      ...Object.getOwnPropertyNames(engine),
    ]);

    for (const name of names) {
      expect(name).not.toMatch(MUTATION_METHOD_PATTERN);
    }
  });

  it('handle() does not mutate the input verdict object (deep-frozen input)', async () => {
    const sender = new RecordingSender();
    const engine = new AlertEngine(buildEngineOptions({ sender }));
    const verdict = deepFreeze(
      makeVerdict('RED', {
        issueCode: SUBJECT_BACKUP_STALE,
        evidenceKeys: ['ev.synthetic.1', 'ev.synthetic.2'],
      }),
    );
    const snapshot = JSON.stringify(verdict);

    await engine.handle(ENV_KEY, verdict);
    await engine.handle(ENV_KEY, verdict); // suppression path too

    expect(JSON.stringify(verdict)).toBe(snapshot);
  });

  it('handle() does not mutate the verdict even on the sender-outage path', async () => {
    const engine = new AlertEngine(
      buildEngineOptions({
        sender: {
          async send(): Promise<void> {
            throw new Error('synthetic sender outage');
          },
        },
      }),
    );
    const verdict = deepFreeze(makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE }));
    const snapshot = JSON.stringify(verdict);

    await engine.handle(ENV_KEY, verdict);

    expect(JSON.stringify(verdict)).toBe(snapshot);
  });

  it('sendDigest() does not mutate the input entries array', async () => {
    const engine = new AlertEngine(buildEngineOptions({}));
    const entries = deepFreeze([
      {
        subjectKey: SUBJECT_BACKUP_STALE,
        category: 'AMBER' as const,
        summary: 'synthetic digest entry summary',
        lastOccurredAt: '2026-10-05T12:00:00.000Z',
      },
    ]);
    const snapshot = JSON.stringify(entries);

    await engine.sendDigest(ENV_KEY, 'daily', entries);

    expect(JSON.stringify(entries)).toBe(snapshot);
  });
});
