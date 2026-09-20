import { makeEngine, verdict, ENV, RecordingSender } from './fakes';

describe('AlertEngine dedup and recovery (Phase F)', () => {
  it('sends a red_alert on the first RED verdict for a subject', async () => {
    const { engine, sender } = makeEngine();
    const decision = await engine.handle(ENV, verdict());
    expect(decision.action).toBe('SENT');
    expect(decision.message?.kind).toBe('red_alert');
    expect(decision.message?.environmentKey).toBe(ENV);
    expect(decision.message?.subjectKey).toBe('WF_STALE');
    expect(decision.message?.occurredAt).toBe(new Date(Date.UTC(2026, 9, 5, 12)).toISOString());
    expect(sender.sent).toHaveLength(1);
  });

  it('suppresses a duplicate RED for a subject already in alerted state', async () => {
    const { engine, sender } = makeEngine();
    await engine.handle(ENV, verdict());
    const decision = await engine.handle(ENV, verdict());
    expect(decision.action).toBe('SUPPRESSED_DUPLICATE');
    expect(decision.message).toBeUndefined();
    expect(sender.sent).toHaveLength(1);
  });

  it('sends recovery and clears the subject when a non-RED verdict follows an alert', async () => {
    const { engine, sender } = makeEngine();
    await engine.handle(ENV, verdict());
    const recovery = await engine.handle(ENV, verdict({ assessment: 'GREEN' }));
    expect(recovery.action).toBe('SENT');
    expect(recovery.message?.kind).toBe('recovery');
    expect(sender.sent.map((m) => m.kind)).toEqual(['red_alert', 'recovery']);

    // Subject cleared: a later RED alerts again instead of dedup-suppressing.
    const reAlert = await engine.handle(ENV, verdict());
    expect(reAlert.action).toBe('SENT');
    expect(sender.sent).toHaveLength(3);
  });

  it('keeps subjects independent (different issueCodes do not dedup each other)', async () => {
    const { engine, sender } = makeEngine();
    const first = await engine.handle(ENV, verdict({ issueCode: 'WF_A' }));
    const second = await engine.handle(ENV, verdict({ issueCode: 'WF_B' }));
    expect(first.action).toBe('SENT');
    expect(second.action).toBe('SENT');
    expect(sender.sent).toHaveLength(2);
  });

  it('scopes dedup state per environmentKey', async () => {
    const { engine, sender } = makeEngine();
    await engine.handle(ENV, verdict({ issueCode: 'WF_A' }));
    const otherEnv = await engine.handle('env-other', verdict({ issueCode: 'WF_A' }));
    expect(otherEnv.action).toBe('SENT');
    expect(sender.sent).toHaveLength(2);
  });

  it('returns SKIPPED_NOT_RED for a non-RED verdict with no prior alert state', async () => {
    const { engine, sender } = makeEngine();
    const decision = await engine.handle(ENV, verdict({ assessment: 'AMBER' }));
    expect(decision.action).toBe('SKIPPED_NOT_RED');
    expect(decision.message).toBeUndefined();
    expect(sender.sent).toHaveLength(0);
  });

  it('does not enter alerted state when the red_alert send fails (outage)', async () => {
    const { engine } = makeEngine({ sender: new RecordingSender(true) });
    const first = await engine.handle(ENV, verdict());
    expect(first.action).toBe('QUEUED_OUTAGE');
    // Still un-alerted, so the next RED retries instead of dedup-suppressing.
    const second = await engine.handle(ENV, verdict());
    expect(second.action).toBe('QUEUED_OUTAGE');
  });
});
