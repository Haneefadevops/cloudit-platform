import { AlertEngine, AlertDecision, DigestEntry } from '../../src/alerts';
import {
  makeEngine,
  verdict,
  ENV,
  FIXED_NOW_MS,
  RecordingSender,
  RecordingOutbox,
  StubGate,
} from './fakes';

const ACTIONS: AlertDecision['action'][] = [
  'SENT',
  'SUPPRESSED_DUPLICATE',
  'SUPPRESSED_RATE_LIMITED',
  'SUPPRESSED_OUTAGE_BOUND',
  'QUEUED_OUTAGE',
  'SKIPPED_NOT_RED',
  'BLOCKED_KILL_SWITCH',
];

describe('AlertEngine never-throws property pass', () => {
  it('always resolves with a valid decision action across adversarial ports', async () => {
    const scenarios: Array<{
      name: string;
      engine: AlertEngine;
      run: (engine: AlertEngine) => Promise<AlertDecision>;
    }> = [
      {
        name: 'sender rejects synchronously-ish',
        engine: new AlertEngine({
          gate: new StubGate(true),
          sender: { send: () => Promise.reject(new Error('down')) },
          outbox: new RecordingOutbox(),
          maxAlertsPerHour: 6,
          outageRetryMaxAttempts: 3,
          now: () => FIXED_NOW_MS,
        }),
        run: (e) => e.handle(ENV, verdict()),
      },
      {
        name: 'outbox append throws while sender is down',
        engine: new AlertEngine({
          gate: new StubGate(true),
          sender: new RecordingSender(true),
          outbox: new RecordingOutbox(true),
          maxAlertsPerHour: 6,
          outageRetryMaxAttempts: 3,
          now: () => FIXED_NOW_MS,
        }),
        run: (e) => e.handle(ENV, verdict()),
      },
      {
        name: 'audit record throws',
        engine: new AlertEngine({
          gate: new StubGate(true),
          sender: new RecordingSender(),
          audit: { record: () => { throw new Error('audit down'); } },
          maxAlertsPerHour: 6,
          outageRetryMaxAttempts: 3,
          now: () => FIXED_NOW_MS,
        }),
        run: (e) => e.handle(ENV, verdict()),
      },
      {
        name: 'malformed verdict (null)',
        engine: makeEngine().engine,
        run: (e) => e.handle(ENV, null as never),
      },
      {
        name: 'malformed verdict (missing fields)',
        engine: makeEngine().engine,
        run: (e) => e.handle(ENV, { assessment: 'RED' } as never),
      },
      {
        name: 'non-string issueCode',
        engine: makeEngine().engine,
        run: (e) => e.handle(ENV, verdict({ issueCode: 42 as never })),
      },
      {
        name: 'negative clock drift under rate window',
        engine: new AlertEngine({
          gate: new StubGate(true),
          sender: new RecordingSender(),
          maxAlertsPerHour: 6,
          outageRetryMaxAttempts: 3,
          now: () => Number.NEGATIVE_INFINITY,
        }),
        run: (e) => e.handle(ENV, verdict()),
      },
      {
        name: 'digest with empty entries on a down sender and no outbox',
        engine: new AlertEngine({
          gate: new StubGate(true),
          sender: new RecordingSender(true),
          maxAlertsPerHour: 6,
          outageRetryMaxAttempts: 3,
          now: () => FIXED_NOW_MS,
        }),
        run: (e) => e.sendDigest(ENV, 'monthly', [] as DigestEntry[]),
      },
    ];

    for (const scenario of scenarios) {
      const decision = await scenario.run(scenario.engine);
      expect(ACTIONS).toContain(decision.action);
    }
  });

  it('handles a randomized sequence of verdicts without throwing', async () => {
    const { engine } = makeEngine({ maxAlertsPerHour: 4, outageRetryMaxAttempts: 2 });
    let seed = 42;
    const rand = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    const categories = ['RED', 'AMBER', 'GREEN', 'NO_DATA', 'UNKNOWN'] as const;
    for (let i = 0; i < 100; i += 1) {
      const category = categories[Math.floor(rand() * categories.length)];
      const issueCode = `WF_${Math.floor(rand() * 5)}`;
      const decision = await engine.handle(
        ENV,
        verdict({ assessment: category, issueCode }),
      );
      expect(ACTIONS).toContain(decision.action);
    }
    await expect(engine.sendDigest(ENV, 'daily', [])).resolves.toBeDefined();
  });
});
