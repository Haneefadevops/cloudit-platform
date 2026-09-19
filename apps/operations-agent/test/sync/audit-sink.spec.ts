import type { AuditEvent } from '@cloudit/operations-agent-contracts';
import { InMemoryAuditSink } from '../../src/sync';

describe('InMemoryAuditSink', () => {
  it('appends events immutably for inspection', () => {
    const sink = new InMemoryAuditSink();
    const event = {
      eventId: 'audit-synthetic-1',
      environmentKey: 'cavetta-synthetic',
      eventType: 'workflow_sync_scan',
      actor: 'agent:sync-auditor',
      occurredAt: '2026-09-21T10:00:00.000Z',
      reasonCode: 'SCAN_COMPLETED',
      resultCode: 'MATCH',
      summary: 'synthetic',
      evidenceKeys: [],
    } satisfies AuditEvent;

    sink.record(event);
    sink.record({ ...event, eventId: 'audit-synthetic-2' });

    expect(sink.events).toHaveLength(2);
    expect(sink.events[0].eventId).toBe('audit-synthetic-1');
    expect(sink.events[1].eventId).toBe('audit-synthetic-2');
  });
});
