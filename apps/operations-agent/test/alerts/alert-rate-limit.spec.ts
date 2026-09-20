import { makeEngine, verdict, ENV, MS_PER_HOUR } from './fakes';

describe('AlertEngine rate limit (rolling hour)', () => {
  it('allows up to maxAlertsPerHour sends, then SUPPRESSED_RATE_LIMITED', async () => {
    const { engine, sender } = makeEngine({ maxAlertsPerHour: 2 });
    const v = (issueCode: string) => verdict({ issueCode });

    expect((await engine.handle(ENV, v('WF_1'))).action).toBe('SENT');
    expect((await engine.handle(ENV, v('WF_2'))).action).toBe('SENT');
    expect((await engine.handle(ENV, v('WF_3'))).action).toBe('SUPPRESSED_RATE_LIMITED');
    expect(sender.sent).toHaveLength(2);
  });

  it('uses a sliding window: capacity frees as sends leave the rolling hour', async () => {
    const { engine, sender, clock } = makeEngine({ maxAlertsPerHour: 2 });
    const v = (issueCode: string) => verdict({ issueCode });

    await engine.handle(ENV, v('WF_1'));
    clock.advance(30 * 60 * 1000); // +30 min
    await engine.handle(ENV, v('WF_2'));
    expect((await engine.handle(ENV, v('WF_3'))).action).toBe('SUPPRESSED_RATE_LIMITED');

    clock.advance(35 * 60 * 1000); // first send now 65 min old, second still inside window
    expect((await engine.handle(ENV, v('WF_4'))).action).toBe('SENT');
    expect((await engine.handle(ENV, v('WF_5'))).action).toBe('SUPPRESSED_RATE_LIMITED');
    expect(sender.sent).toHaveLength(3);
  });

  it('counts queued-outage attempts toward the rate limit', async () => {
    const { engine } = makeEngine({ maxAlertsPerHour: 2, sender: { send: async () => { throw new Error('down'); } } });
    const v = (issueCode: string) => verdict({ issueCode });

    expect((await engine.handle(ENV, v('WF_1'))).action).toBe('QUEUED_OUTAGE');
    expect((await engine.handle(ENV, v('WF_2'))).action).toBe('QUEUED_OUTAGE');
    expect((await engine.handle(ENV, v('WF_3'))).action).toBe('SUPPRESSED_RATE_LIMITED');
  });

  it('suppressed sends (duplicate/rate-limited/skipped) do not consume budget', async () => {
    const { engine, sender } = makeEngine({ maxAlertsPerHour: 1 });
    await engine.handle(ENV, verdict({ issueCode: 'WF_A' })); // 1 send, budget full
    expect((await engine.handle(ENV, verdict({ issueCode: 'WF_A' }))).action).toBe('SUPPRESSED_DUPLICATE');
    // Rolling hour passes; a real send is allowed again.
    const { engine: e2, sender: s2 } = makeEngine({ maxAlertsPerHour: 1 });
    await e2.handle(ENV, verdict({ issueCode: 'WF_A' }));
    expect((await e2.handle(ENV, verdict({ issueCode: 'WF_B' }))).action).toBe('SUPPRESSED_RATE_LIMITED');
    expect(s2.sent).toHaveLength(1);
    expect(sender.sent).toHaveLength(1);
  });
});
