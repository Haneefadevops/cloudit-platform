import { AlertDispatchAuditEvent } from '../../src/alerts';
import { makeEngine, verdict, ENV, StubGate, RecordingSender, RecordingOutbox } from './fakes';

describe('AlertEngine kill switch', () => {
  it('returns BLOCKED_KILL_SWITCH without sending when the gate denies', async () => {
    const sender = new RecordingSender();
    const { engine, auditEvents } = makeEngine({ gate: new StubGate(false), sender });

    const decision = await engine.handle(ENV, verdict());
    expect(decision.action).toBe('BLOCKED_KILL_SWITCH');
    expect(decision.message).toBeUndefined();
    expect(sender.sent).toHaveLength(0);
    expect(auditEvents).toHaveLength(1);
    expect((auditEvents[0] as AlertDispatchAuditEvent).reasonCode).toBe('BLOCKED_KILL_SWITCH');
  });

  it('blocks digests the same way', async () => {
    const sender = new RecordingSender();
    const { engine, auditEvents } = makeEngine({ gate: new StubGate(false), sender });

    const decision = await engine.sendDigest(ENV, 'daily', []);
    expect(decision.action).toBe('BLOCKED_KILL_SWITCH');
    expect(sender.sent).toHaveLength(0);
    expect(auditEvents).toHaveLength(1);
  });

  it('blocks even when an outbox is available (no queuing past the gate)', async () => {
    const { engine, outbox } = makeEngine({
      gate: new StubGate(false),
      sender: new RecordingSender(true),
    });
    const decision = await engine.handle(ENV, verdict());
    expect(decision.action).toBe('BLOCKED_KILL_SWITCH');
    expect(outbox.entries).toHaveLength(0);
  });

  it('sends normally when the gate allows', async () => {
    const { engine } = makeEngine({ gate: new StubGate(true) });
    expect((await engine.handle(ENV, verdict())).action).toBe('SENT');
  });
});
