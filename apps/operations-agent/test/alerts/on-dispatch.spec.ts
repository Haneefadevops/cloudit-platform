import { HealthAssessment } from '@cloudit/operations-agent-contracts';
import { AlertDecision, AlertEngine } from '../../src/alerts';
import {
  makeEngine,
  verdict,
  ENV,
  RecordingSender,
  StubGate,
} from './fakes';
import {
  buildEngineOptions,
  ENV_KEY,
  makeVerdict,
  RecordingSender as EvalRecordingSender,
  SUBJECT_BACKUP_STALE,
} from '../alerts-evals/fixtures';

interface DispatchInfo {
  environmentKey: string;
  verdict: HealthAssessment;
  decision: AlertDecision;
}

function recordingHook(into: DispatchInfo[]): (info: DispatchInfo) => void {
  return (info) => into.push(info);
}

describe('AlertEngine onDispatch hook (Phase H)', () => {
  it('invokes the hook once with SENT red_alert on the first RED verdict', async () => {
    const observed: DispatchInfo[] = [];
    const input = verdict();
    const { engine, sender } = makeEngine({ onDispatch: recordingHook(observed) });

    const decision = await engine.handle(ENV, input);

    expect(decision.action).toBe('SENT');
    expect(decision.message?.kind).toBe('red_alert');
    expect(observed).toHaveLength(1);
    expect(observed[0].environmentKey).toBe(ENV);
    expect(observed[0].verdict).toEqual(input);
    expect(observed[0].decision).toBe(decision);
    expect(sender.sent).toHaveLength(1);
  });

  it('invokes the hook once with SUPPRESSED_DUPLICATE on a repeat RED', async () => {
    const observed: DispatchInfo[] = [];
    const { engine } = makeEngine({ onDispatch: recordingHook(observed) });

    await engine.handle(ENV, verdict());
    const decision = await engine.handle(ENV, verdict());

    expect(decision.action).toBe('SUPPRESSED_DUPLICATE');
    expect(observed).toHaveLength(2);
    expect(observed[1].decision).toBe(decision);
    expect(observed[1].decision.action).toBe('SUPPRESSED_DUPLICATE');
  });

  it('invokes the hook once with SENT recovery on GREEN after RED', async () => {
    const observed: DispatchInfo[] = [];
    const input = verdict({ assessment: 'GREEN' });
    const { engine } = makeEngine({ onDispatch: recordingHook(observed) });

    await engine.handle(ENV, verdict());
    const decision = await engine.handle(ENV, input);

    expect(decision.action).toBe('SENT');
    expect(decision.message?.kind).toBe('recovery');
    expect(observed).toHaveLength(2);
    expect(observed[1].verdict).toEqual(input);
    expect(observed[1].decision).toBe(decision);
    expect(observed[1].decision.message?.kind).toBe('recovery');
  });

  it('invokes the hook once with SKIPPED_NOT_RED for a non-RED verdict with no alert state', async () => {
    const observed: DispatchInfo[] = [];
    const { engine, sender } = makeEngine({ onDispatch: recordingHook(observed) });

    const decision = await engine.handle(ENV, verdict({ assessment: 'AMBER' }));

    expect(decision.action).toBe('SKIPPED_NOT_RED');
    expect(observed).toHaveLength(1);
    expect(observed[0].decision).toBe(decision);
    expect(sender.sent).toHaveLength(0);
  });

  it('invokes the hook once with BLOCKED_KILL_SWITCH when the gate denies (before any send)', async () => {
    const observed: DispatchInfo[] = [];
    const sender = new RecordingSender();
    const { engine } = makeEngine({
      gate: new StubGate(false),
      sender,
      onDispatch: recordingHook(observed),
    });

    const decision = await engine.handle(ENV, verdict());

    expect(decision.action).toBe('BLOCKED_KILL_SWITCH');
    expect(observed).toHaveLength(1);
    expect(observed[0].environmentKey).toBe(ENV);
    expect(observed[0].decision).toBe(decision);
    expect(sender.sent).toHaveLength(0);
  });

  it('invokes the hook once with QUEUED_OUTAGE when the sender is down and an outbox exists', async () => {
    const observed: DispatchInfo[] = [];
    const { engine, outbox } = makeEngine({
      sender: new RecordingSender(true),
      onDispatch: recordingHook(observed),
    });

    const decision = await engine.handle(ENV, verdict());

    expect(decision.action).toBe('QUEUED_OUTAGE');
    expect(observed).toHaveLength(1);
    expect(observed[0].decision).toBe(decision);
    expect(outbox.entries).toHaveLength(1);
  });

  it('invokes the hook once with SUPPRESSED_RATE_LIMITED when the hourly budget is exhausted', async () => {
    const observed: DispatchInfo[] = [];
    const { engine } = makeEngine({
      maxAlertsPerHour: 1,
      onDispatch: recordingHook(observed),
    });

    await engine.handle(ENV, verdict({ issueCode: 'WF_A' }));
    const decision = await engine.handle(ENV, verdict({ issueCode: 'WF_B' }));

    expect(decision.action).toBe('SUPPRESSED_RATE_LIMITED');
    expect(observed).toHaveLength(2);
    expect(observed[1].decision).toBe(decision);
  });

  it('invokes the hook exactly once per handle() call across a mixed sequence', async () => {
    const observed: DispatchInfo[] = [];
    const { engine } = makeEngine({ onDispatch: recordingHook(observed) });

    await engine.handle(ENV, verdict({ issueCode: 'WF_A' }));
    await engine.handle(ENV, verdict({ issueCode: 'WF_A' }));
    await engine.handle(ENV, verdict({ assessment: 'GREEN', issueCode: 'WF_A' }));
    await engine.handle(ENV, verdict({ assessment: 'AMBER', issueCode: 'WF_B' }));

    expect(observed.map((info) => info.decision.action)).toEqual([
      'SENT',
      'SUPPRESSED_DUPLICATE',
      'SENT',
      'SKIPPED_NOT_RED',
    ]);
  });

  it('never invokes the hook when onDispatch is undefined', async () => {
    const { engine, sender } = makeEngine();

    await engine.handle(ENV, verdict());
    await engine.handle(ENV, verdict({ assessment: 'GREEN' }));

    expect(sender.sent).toHaveLength(2);
  });

  it('does not invoke the hook from sendDigest()', async () => {
    const observed: DispatchInfo[] = [];
    const { engine } = makeEngine({ onDispatch: recordingHook(observed) });

    const decision = await engine.sendDigest(ENV, 'daily', []);

    expect(decision.action).toBe('SENT');
    expect(observed).toHaveLength(0);
  });

  it('passes a frozen info object', async () => {
    const observed: DispatchInfo[] = [];
    const { engine } = makeEngine({ onDispatch: recordingHook(observed) });

    await engine.handle(ENV, verdict());

    expect(Object.isFrozen(observed[0])).toBe(true);
  });

  it('swallows a throwing callback: decision is identical and alerting state still advances', async () => {
    const { engine, sender } = makeEngine({
      onDispatch: () => {
        throw new Error('observer boom');
      },
    });

    const red = await engine.handle(ENV, verdict());
    expect(red.action).toBe('SENT');

    const dup = await engine.handle(ENV, verdict());
    expect(dup.action).toBe('SUPPRESSED_DUPLICATE');

    // The callback throws, but the recovery must still send and clear state.
    const recovery = await engine.handle(ENV, verdict({ assessment: 'GREEN' }));
    expect(recovery.action).toBe('SENT');
    expect(recovery.message?.kind).toBe('recovery');

    // State advanced normally: a subsequent RED re-alerts per dedup rules.
    const reAlert = await engine.handle(ENV, verdict());
    expect(reAlert.action).toBe('SENT');
    expect(reAlert.message?.kind).toBe('red_alert');
    expect(sender.sent.map((m) => m.kind)).toEqual([
      'red_alert',
      'recovery',
      'red_alert',
    ]);
  });
});

describe('AlertEngine onDispatch — eval: observed dispatch sequence matches decision sequence 1:1', () => {
  it('mirrors the dedup core scenario (one RED → duplicate → recovery)', async () => {
    const sender = new EvalRecordingSender();
    const observed: DispatchInfo[] = [];
    const engine = new AlertEngine({
      ...buildEngineOptions({ sender }),
      onDispatch: recordingHook(observed),
    });
    const red = makeVerdict('RED', { issueCode: SUBJECT_BACKUP_STALE });

    const decisions: AlertDecision[] = [];
    decisions.push(await engine.handle(ENV_KEY, red));
    decisions.push(await engine.handle(ENV_KEY, red));
    decisions.push(
      await engine.handle(ENV_KEY, makeVerdict('GREEN', { issueCode: SUBJECT_BACKUP_STALE })),
    );

    expect(decisions.map((d) => d.action)).toEqual([
      'SENT',
      'SUPPRESSED_DUPLICATE',
      'SENT',
    ]);
    expect(sender.sent.map((m) => m.kind)).toEqual(['red_alert', 'recovery']);

    // The observed hook sequence matches the decision sequence 1:1.
    expect(observed).toHaveLength(decisions.length);
    for (let i = 0; i < decisions.length; i += 1) {
      expect(observed[i].environmentKey).toBe(ENV_KEY);
      expect(observed[i].decision).toBe(decisions[i]);
      expect(Object.isFrozen(observed[i])).toBe(true);
    }
    expect(observed.map((info) => info.decision.action)).toEqual(
      decisions.map((d) => d.action),
    );
  });
});
