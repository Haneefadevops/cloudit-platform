import { AuditEvent } from '@cloudit/operations-agent-contracts';
import { AuditService } from '../../src/platform/audit/audit.service';

function validEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    eventId: 'audit-0001',
    environmentKey: 'test-env',
    eventType: 'budget_denial',
    actor: 'agent:supervisor',
    occurredAt: '2026-09-21T10:00:00.000Z',
    reasonCode: 'BUDGET_CAP_REACHED',
    resultCode: 'DENIED',
    summary: 'synthetic test event for the audit service',
    evidenceKeys: ['evidence-0001'],
    ...overrides,
  };
}

describe('AuditService (Worker C)', () => {
  it('records a contract-valid event and returns the stored value', () => {
    const audit = new AuditService();
    const result = audit.record(validEvent());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.eventId).toBe('audit-0001');
      expect(result.value.summary).toContain('synthetic');
    }
    expect(audit.count()).toBe(1);
  });

  it.each([
    ['missing required field', { ...validEvent(), summary: undefined }],
    ['unknown extra field (closed schema)', { ...validEvent(), hackerField: 'x' }],
    ['control character in summary', validEvent({ summary: 'bad\u0007summary' })],
    ['invalid timestamp', validEvent({ occurredAt: 'not-a-time' })],
    ['actor outside safe pattern', validEvent({ actor: 'attacker;rm -rf' })],
    ['evidence key with control character', validEvent({ evidenceKeys: ['bad\u0001key'] })],
    ['non-object input', null],
  ])('rejects invalid events: %s', (_label, input) => {
    const audit = new AuditService();
    const result = audit.record(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
    expect(audit.count()).toBe(0);
  });

  it('stored events are deeply frozen and cannot be mutated through the API', () => {
    const audit = new AuditService();
    const result = audit.record(validEvent());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = result.value;

    expect(Object.isFrozen(stored)).toBe(true);
    expect(Object.isFrozen(stored.evidenceKeys)).toBe(true);
    // Mutating through any returned reference throws (strict mode)...
    expect(() => {
      (stored as { summary: string }).summary = 'tampered';
    }).toThrow();
    expect(() => {
      (stored.evidenceKeys as string[]).push('evidence-9999');
    }).toThrow();
    // ...and never changes what the service holds.
    expect(audit.getEvents()[0].summary).toBe('synthetic test event for the audit service');
    expect(audit.getEvents()[0].evidenceKeys).toEqual(['evidence-0001']);
  });

  it('exposes no update or delete API', () => {
    const audit = new AuditService() as unknown as Record<string, unknown>;
    for (const forbidden of ['updateEvent', 'deleteEvent', 'removeEvent', 'clear', 'mutate']) {
      expect(audit[forbidden]).toBeUndefined();
    }
  });

  it('returned snapshots cannot be used to alter the store', () => {
    const audit = new AuditService();
    audit.record(validEvent());
    const snapshot = audit.getEvents();
    expect(() => {
      (snapshot as AuditEvent[]).pop();
    }).toThrow();
    expect(audit.count()).toBe(1);
    const before = audit.getEvents();
    audit.record(validEvent({ eventId: 'audit-0002' }));
    expect(before.length).toBe(1);
    expect(audit.count()).toBe(2);
  });
});
