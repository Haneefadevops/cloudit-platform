jest.mock('./operations.config', () => ({
  operationsConfig: {
    reportPdfRelaySecret: 'phase-9-test-secret-with-at-least-32-characters',
    reportCommandSecret: 'phase-10-test-secret-with-at-least-32-chars',
    reportCommandToken: 'phase-10-test-token-with-at-least-32chars',
    reportCommandUrl: 'http://n8n:5678/webhook/cloudit-report-command',
    reportCommandTtlSeconds: 120,
    staleEvidenceMs: 45 * 60 * 1000,
    analyticsStaleEvidenceMs: 24 * 60 * 60 * 1000,
  },
}));

import { OperationsService } from './operations.service';

const FORBIDDEN_COLUMNS =
  /publisher_id|idempotency_key|source_record_type|severity_echo/i;

function expectHygiene(query: jest.Mock): void {
  for (const [sql] of query.mock.calls as [string][]) {
    const selectList = sql.slice(sql.indexOf('SELECT'), sql.indexOf('FROM'));
    expect(selectList).not.toMatch(/\bid\b/i);
    expect(selectList).not.toMatch(FORBIDDEN_COLUMNS);
    expect(selectList).not.toMatch(/\bpayload\b/i);
    expect(sql).not.toMatch(FORBIDDEN_COLUMNS);
    expect(sql).not.toMatch(/\bpayload\b/i);
  }
}

describe('OperationsService Phase 11 incidents', () => {
  let service: OperationsService;
  const query = jest.fn();

  beforeAll(() => {
    service = new OperationsService({ query } as never);
  });

  beforeEach(() => query.mockReset());

  const incidentRow = (overrides: Record<string, unknown> = {}) => ({
    incident_key: 'cavetta.api_down.2026-09-28',
    service_key: 'svc.a',
    state: 'open',
    severity: 'critical',
    status_color: 'RED',
    failure_category: 'timeout',
    occurrence_count: 2,
    safe_summary: 'API unreachable',
    safe_action: 'Check hosting',
    started_at: new Date('2026-09-28T08:00:00Z'),
    confirmed_at: null,
    recovered_at: null,
    resolved_at: null,
    observed_at: new Date('2026-09-28T09:00:00Z'),
    correlation_key: 'corr-1',
    endpoint_key: 'cavetta-api',
    endpoint_display_name: 'Cavetta API',
    domain_name: 'api.cavetta.lk',
    client_key: 'cavetta',
    client_display_name: 'Cavetta',
    ...overrides,
  });

  it('maps the list, groups by client and derives buckets over the filtered set', async () => {
    query.mockResolvedValueOnce({
      rows: [
        incidentRow({ incident_key: 'a.one' }),
        incidentRow({
          incident_key: 'a.two',
          state: 'recovered',
          occurrence_count: 1,
          started_at: new Date('2026-09-28T06:30:00Z'),
        }),
        incidentRow({
          incident_key: 'a.three',
          service_key: 'svc.b',
          failure_category: null,
          occurrence_count: 1,
          endpoint_key: null,
          endpoint_display_name: null,
          domain_name: null,
        }),
        incidentRow({
          incident_key: 'b.one',
          service_key: 'svc.c',
          failure_category: 'dns',
          occurrence_count: 5,
          started_at: new Date('2026-09-28T07:00:00Z'),
          endpoint_key: null,
          endpoint_display_name: null,
          domain_name: null,
          client_key: 'touchorbit',
          client_display_name: 'TouchOrbit',
        }),
      ],
    });

    const response = await service.getIncidents({});

    expect(response.generatedAt).toEqual(expect.any(String));
    expect(response.filters).toEqual({
      state: 'all',
      severity: null,
      client: null,
      domain: null,
      source: null,
    });
    expect(response.clients).toEqual([
      {
        clientKey: 'cavetta',
        clientName: 'Cavetta',
        incidents: [
          {
            incidentKey: 'a.one',
            serviceKey: 'svc.a',
            endpointKey: 'cavetta-api',
            endpointDisplayName: 'Cavetta API',
            domainKey: 'api.cavetta.lk',
            state: 'open',
            severity: 'critical',
            statusColor: 'RED',
            failureCategory: 'timeout',
            occurrenceCount: 2,
            safeSummary: 'API unreachable',
            safeAction: 'Check hosting',
            startedAt: '2026-09-28T08:00:00.000Z',
            confirmedAt: null,
            recoveredAt: null,
            resolvedAt: null,
            lastObservedAt: '2026-09-28T09:00:00.000Z',
            correlationKey: 'corr-1',
          },
          {
            incidentKey: 'a.two',
            serviceKey: 'svc.a',
            endpointKey: 'cavetta-api',
            endpointDisplayName: 'Cavetta API',
            domainKey: 'api.cavetta.lk',
            state: 'recovered',
            severity: 'critical',
            statusColor: 'RED',
            failureCategory: 'timeout',
            occurrenceCount: 1,
            safeSummary: 'API unreachable',
            safeAction: 'Check hosting',
            startedAt: '2026-09-28T06:30:00.000Z',
            confirmedAt: null,
            recoveredAt: null,
            resolvedAt: null,
            lastObservedAt: '2026-09-28T09:00:00.000Z',
            correlationKey: 'corr-1',
          },
          expect.objectContaining({
            incidentKey: 'a.three',
            serviceKey: 'svc.b',
            endpointKey: null,
            endpointDisplayName: null,
            domainKey: null,
            failureCategory: null,
            occurrenceCount: 1,
          }) as unknown,
        ],
      },
      {
        clientKey: 'touchorbit',
        clientName: 'TouchOrbit',
        incidents: [
          expect.objectContaining({ incidentKey: 'b.one' }) as unknown,
        ],
      },
    ]);
    // The single-occurrence (svc.b) bucket is a list row, not a finding.
    expect(response.buckets).toEqual([
      {
        failureCategory: 'dns',
        serviceKey: 'svc.c',
        endpointKey: null,
        openCount: 1,
        totalOccurrences: 5,
        lastOccurredAt: '2026-09-28T07:00:00.000Z',
      },
      {
        failureCategory: 'timeout',
        serviceKey: 'svc.a',
        endpointKey: 'cavetta-api',
        openCount: 1,
        totalOccurrences: 3,
        lastOccurredAt: '2026-09-28T08:00:00.000Z',
      },
    ]);
    expectHygiene(query);
  });

  it('applies every filter as a bound condition on the filtered set', async () => {
    query.mockResolvedValueOnce({ rows: [] });

    const response = await service.getIncidents({
      state: 'open',
      severity: 'critical',
      client: 'cavetta',
      domain: 'api.cavetta.lk',
      source: 'uptime_kuma',
    });

    expect(response.clients).toEqual([]);
    expect(response.buckets).toEqual([]);
    expect(response.filters).toEqual({
      state: 'open',
      severity: 'critical',
      client: 'cavetta',
      domain: 'api.cavetta.lk',
      source: 'uptime_kuma',
    });
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual([
      'open',
      'critical',
      'cavetta',
      'api.cavetta.lk',
      'uptime_kuma',
    ]);
    expect(sql).toContain('i.state = $1');
    expect(sql).toContain('i.severity = $2');
    expect(sql).toContain('c.client_key = $3');
    expect(sql).toContain('d.domain_name = $4');
    expect(sql).toContain('i.source_system = $5');
  });

  it('sums bucket occurrences and open counts over the rows the filter returns', async () => {
    query.mockResolvedValueOnce({
      rows: [
        incidentRow({
          incident_key: 'a.one',
          occurrence_count: 3,
          state: 'open',
          started_at: new Date('2026-09-28T08:00:00Z'),
        }),
        incidentRow({
          incident_key: 'a.two',
          occurrence_count: 1,
          state: 'recovered',
          started_at: new Date('2026-09-28T06:30:00Z'),
        }),
        // Same group as the rows above via a NULL failure category — the
        // null category forms its own bucket and stays below the cutoff.
        incidentRow({
          incident_key: 'a.three',
          failure_category: null,
          occurrence_count: 1,
        }),
      ],
    });

    const response = await service.getIncidents({ state: 'open' });

    expect(response.buckets).toEqual([
      {
        failureCategory: 'timeout',
        serviceKey: 'svc.a',
        endpointKey: 'cavetta-api',
        openCount: 1,
        totalOccurrences: 4,
        lastOccurredAt: '2026-09-28T08:00:00.000Z',
      },
    ]);
  });

  it('rejects every invalid filter param before touching the database', async () => {
    await expect(service.getIncidents({ state: 'closed' })).rejects.toThrow(
      'Invalid request',
    );
    await expect(service.getIncidents({ severity: 'fatal' })).rejects.toThrow(
      'Invalid request',
    );
    await expect(service.getIncidents({ client: 'Bad Key' })).rejects.toThrow(
      'Invalid request',
    );
    await expect(service.getIncidents({ domain: 'nodots' })).rejects.toThrow(
      'Invalid request',
    );
    await expect(service.getIncidents({ source: 'datadog' })).rejects.toThrow(
      'Invalid request',
    );
    expect(query).not.toHaveBeenCalled();
  });

  it('maps the detail with an ASC timeline, event-key tiebreak and endpoint link', async () => {
    query
      .mockResolvedValueOnce({
        rows: [incidentRow({ client_id: 'internal-client-id' })],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            event_type: 'recovered',
            occurred_at: new Date('2026-09-28T09:00:00Z'),
            severity: 'info',
            status_color: 'GREEN',
            correlation_key: 'corr-2',
            event_key: 'evt-3',
          },
          {
            event_type: 'detected',
            occurred_at: new Date('2026-09-28T08:00:00Z'),
            severity: 'critical',
            status_color: 'RED',
            correlation_key: 'corr-1',
            event_key: 'evt-b',
          },
          {
            event_type: 'updated',
            occurred_at: new Date('2026-09-28T08:00:00Z'),
            severity: null,
            status_color: null,
            correlation_key: null,
            event_key: 'evt-a',
          },
          {
            event_type: 'mystery',
            occurred_at: new Date('2026-09-28T08:30:00Z'),
            severity: 'critical',
            status_color: 'RED',
            correlation_key: null,
            event_key: 'evt-x',
          },
        ],
      });

    const response = await service.getIncidentDetail(
      'cavetta.api_down.2026-09-28',
    );

    expect(response).not.toBeNull();
    expect(response?.incident.incidentKey).toBe('cavetta.api_down.2026-09-28');
    expect(response?.incident.domainKey).toBe('api.cavetta.lk');
    expect(response?.events).toEqual([
      {
        eventType: 'updated',
        occurredAt: '2026-09-28T08:00:00.000Z',
        severity: null,
        statusColor: null,
        correlationKey: null,
      },
      {
        eventType: 'detected',
        occurredAt: '2026-09-28T08:00:00.000Z',
        severity: 'critical',
        statusColor: 'RED',
        correlationKey: 'corr-1',
      },
      {
        eventType: 'recovered',
        occurredAt: '2026-09-28T09:00:00.000Z',
        severity: 'info',
        statusColor: 'GREEN',
        correlationKey: 'corr-2',
      },
    ]);
    expect(response?.links).toEqual([
      { kind: 'endpoint', label: 'Cavetta API', refKey: 'cavetta-api' },
    ]);
    const [, eventParams] = query.mock.calls[1] as [string, unknown[]];
    expect(eventParams).toEqual([
      'cavetta.api_down.2026-09-28',
      'internal-client-id',
    ]);
    expectHygiene(query);
  });

  it('emits no links for an incident without an endpoint', async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          incidentRow({
            client_id: 'internal-client-id',
            endpoint_key: null,
            endpoint_display_name: null,
            domain_name: null,
          }),
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    const response = await service.getIncidentDetail('cavetta.api_down');

    expect(response?.incident.endpointKey).toBeNull();
    expect(response?.incident.endpointDisplayName).toBeNull();
    expect(response?.incident.domainKey).toBeNull();
    expect(response?.links).toEqual([]);
  });

  it('returns null for an unknown key and for a key outside the pattern', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(
      service.getIncidentDetail('cavetta.missing.2026-09-28'),
    ).resolves.toBeNull();
    expect(query).toHaveBeenCalledTimes(1);

    await expect(service.getIncidentDetail('Bad Key!')).resolves.toBeNull();
    expect(query).toHaveBeenCalledTimes(1);
  });
});
