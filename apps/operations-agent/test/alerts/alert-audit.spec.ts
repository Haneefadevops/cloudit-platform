import { AlertDispatchAuditEvent } from '../../src/alerts';
import { makeEngine, verdict, ENV, StubGate, RecordingSender } from './fakes';

describe('AlertEngine audit trail', () => {
  it('records exactly one closed event per handle() call with the action as reasonCode', async () => {
    const { engine, auditEvents } = makeEngine();
    await engine.handle(ENV, verdict()); // SENT
    await engine.handle(ENV, verdict()); // SUPPRESSED_DUPLICATE
    await engine.handle(ENV, verdict({ assessment: 'GREEN' })); // SENT (recovery)
    await engine.handle(ENV, verdict({ assessment: 'GREEN' })); // SKIPPED_NOT_RED

    expect(auditEvents).toHaveLength(4);
    const [sent, dup, recovery, skipped] = auditEvents as AlertDispatchAuditEvent[];
    expect(sent).toMatchObject({
      eventType: 'alert_dispatch',
      actor: 'agent:alerts',
      reasonCode: 'SENT',
      resultCode: 'SENT',
      evidenceKeys: ['WF_STALE'],
    });
    expect(dup.reasonCode).toBe('SUPPRESSED_DUPLICATE');
    expect(dup.resultCode).toBe('SUPPRESSED');
    expect(recovery.reasonCode).toBe('SENT');
    expect(skipped.reasonCode).toBe('SKIPPED_NOT_RED');
  });

  it('maps result codes: SENT->SENT, QUEUED_OUTAGE->QUEUED, suppressions->SUPPRESSED', async () => {
    const { engine, auditEvents } = makeEngine({ sender: new RecordingSender(true) });
    await engine.handle(ENV, verdict()); // QUEUED_OUTAGE
    const queued = auditEvents[0] as AlertDispatchAuditEvent;
    expect(queued.reasonCode).toBe('QUEUED_OUTAGE');
    expect(queued.resultCode).toBe('QUEUED');

    const blocked = makeEngine({ gate: new StubGate(false) });
    await blocked.engine.handle(ENV, verdict());
    expect((blocked.auditEvents[0] as AlertDispatchAuditEvent).resultCode).toBe('SUPPRESSED');
  });

  it('summary is a fixed bounded template (<=200 chars) with action and subjectKey', async () => {
    const { engine, auditEvents } = makeEngine();
    await engine.handle(ENV, verdict());
    const event = auditEvents[0] as AlertDispatchAuditEvent;
    expect(event.summary).toBe('alert dispatch action=SENT subject=WF_STALE');
    expect(event.summary.length).toBeLessThanOrEqual(200);
    expect(event.summary).not.toContain('Deterministic scan');
  });

  it('uses ISO-8601 UTC occurredAt from the injected clock', async () => {
    const { engine, auditEvents } = makeEngine();
    await engine.handle(ENV, verdict());
    const event = auditEvents[0] as AlertDispatchAuditEvent;
    expect(event.occurredAt).toBe(new Date(Date.UTC(2026, 9, 5, 12)).toISOString());
    expect(event.occurredAt.endsWith('Z')).toBe(true);
  });

  it('records one event for digests with subjectKey digest', async () => {
    const { engine, auditEvents } = makeEngine();
    await engine.sendDigest(ENV, 'daily', []);
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({
      reasonCode: 'SENT',
      evidenceKeys: ['digest'],
    });
  });

  it('records no events when no audit sink is provided and still dispatches', async () => {
    let current = Date.UTC(2026, 9, 5, 12);
    const sender = new RecordingSender();
    const { AlertEngine } = await import('../../src/alerts');
    const engine = new AlertEngine({
      gate: new StubGate(true),
      sender,
      maxAlertsPerHour: 6,
      outageRetryMaxAttempts: 3,
      now: () => current,
    });
    expect((await engine.handle(ENV, verdict())).action).toBe('SENT');
    expect(sender.sent).toHaveLength(1);
  });
});
