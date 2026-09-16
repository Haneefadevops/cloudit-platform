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
    // Global (client_id NULL) rows must not be filtered out.
    expect(sql).not.toMatch(/IS NOT NULL/);
    // Keyset pagination only; no OFFSET numbering.
    expect(sql).not.toMatch(/OFFSET/i);
  }
}

describe('OperationsService Phase 11 audit events', () => {
  let service: OperationsService;
  const query = jest.fn();

  beforeAll(() => {
    service = new OperationsService({ query } as never);
  });

  beforeEach(() => query.mockReset());

  const auditRow = (overrides: Record<string, unknown> = {}) => ({
    event_key: 'evt-1',
    occurred_at: new Date('2026-09-28T10:00:00Z'),
    actor_type: 'portal_user',
    actor_key: 'user-key',
    action: 'report.command.request',
    target_type: 'report',
    target_key: 'rpt-1',
    result: 'success',
    command_key: 'cmd-1',
    safe_reason_code: null,
    client_key: 'cavetta',
    ...overrides,
  });

  it('maps events, keeps global rows and issues an opaque next cursor', async () => {
    const rows = Array.from({ length: 51 }, (_, index) =>
      auditRow({
        event_key: `evt-${index}`,
        occurred_at: new Date(Date.UTC(2026, 8, 28, 10, 0, 0) - index * 1000),
        client_key: index === 3 ? null : 'cavetta',
        target_type: index === 3 ? null : 'report',
        target_key: index === 3 ? null : 'rpt-1',
        command_key: index === 3 ? null : 'cmd-1',
      }),
    );
    query.mockResolvedValueOnce({ rows });

    const response = await service.getAuditEvents({});

    expect(response.filters).toEqual({
      category: 'all',
      from: null,
      to: null,
    });
    expect(response.events).toHaveLength(50);
    expect(response.events[0]).toEqual({
      eventKey: 'evt-0',
      occurredAt: '2026-09-28T10:00:00.000Z',
      actorType: 'portal_user',
      actorKey: 'user-key',
      action: 'report.command.request',
      targetType: 'report',
      targetKey: 'rpt-1',
      result: 'success',
      safeReasonCode: null,
      commandKey: 'cmd-1',
      clientKey: 'cavetta',
    });
    // Row 3 is a global owner-only row: every field stays null-safe.
    expect(response.events[3]).toEqual(
      expect.objectContaining({ clientKey: null, targetType: null }),
    );
    expect(response.nextCursor).not.toBeNull();
    const decoded = Buffer.from(response.nextCursor as string, 'base64url')
      .toString('utf8')
      .split('|');
    expect(decoded).toEqual(['2026-09-28T09:59:11.000Z', 'evt-49']);
    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toContain('LIMIT 51');
    expect(sql).toContain('ORDER BY a.occurred_at DESC, a.event_key DESC');
    expectHygiene(query);
  });

  it('returns a null cursor when the page is the final one', async () => {
    query.mockResolvedValueOnce({ rows: [auditRow()] });

    const response = await service.getAuditEvents({ limit: '50' });

    expect(response.events).toHaveLength(1);
    expect(response.nextCursor).toBeNull();
  });

  it('continues from a cursor with a keyset row comparison', async () => {
    query.mockResolvedValueOnce({
      rows: Array.from({ length: 10 }, (_, index) =>
        auditRow({ event_key: `evt-${index}` }),
      ),
    });
    const cursor = Buffer.from(
      '2026-09-28T10:00:00.000Z|evt-9',
      'utf8',
    ).toString('base64url');

    const response = await service.getAuditEvents({ cursor, limit: '10' });

    expect(response.events).toHaveLength(10);
    expect(response.nextCursor).toBeNull();
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('(a.occurred_at, a.event_key) < ($1, $2)');
    expect(sql).toContain('LIMIT 11');
    expect(params).toEqual(['2026-09-28T10:00:00.000Z', 'evt-9']);
  });

  it('maps each category to its action-prefix predicate', async () => {
    const cases: Array<[string | undefined, string[]]> = [
      ['report_actions', [`a.action LIKE 'report.command.%'`]],
      ['authentication', [`a.action LIKE 'auth.%'`]],
      ['administrative', [`a.action NOT LIKE 'report.command.%'`]],
      ['all', []],
      [undefined, []],
    ];
    for (const [category, expectedFragments] of cases) {
      query.mockReset();
      query.mockResolvedValueOnce({ rows: [] });
      await service.getAuditEvents({ category });
      const [sql] = query.mock.calls[0] as [string];
      for (const fragment of expectedFragments) {
        expect(sql).toContain(fragment);
      }
      if (expectedFragments.length === 0) {
        expect(sql).not.toMatch(/LIKE 'report\.command|LIKE 'auth\./);
      }
    }
    // administrative must exclude both prefixes.
    query.mockReset();
    query.mockResolvedValueOnce({ rows: [] });
    await service.getAuditEvents({ category: 'administrative' });
    const [adminSql] = query.mock.calls[0] as [string];
    expect(adminSql).toContain(`a.action NOT LIKE 'auth.%'`);
  });

  it('applies UTC calendar-day bounds with exclusive to + 1 day', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await service.getAuditEvents({ from: '2026-09-01', to: '2026-09-07' });
    let [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('a.occurred_at >= $1::date');
    expect(sql).toContain('a.occurred_at < ($2::date + 1)');
    expect(params).toEqual(['2026-09-01', '2026-09-07']);

    query.mockReset();
    query.mockResolvedValueOnce({ rows: [] });
    await service.getAuditEvents({ from: '2026-09-01' });
    [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toContain('a.occurred_at >= $1::date');
    expect(sql).not.toContain('::date + 1');
    expect(params).toEqual(['2026-09-01']);
  });

  it('rejects invalid params before touching the database', async () => {
    await expect(service.getAuditEvents({ category: 'bogus' })).rejects.toThrow(
      'Invalid request',
    );
    await expect(
      service.getAuditEvents({ from: '09/01/2026' }),
    ).rejects.toThrow('Invalid request');
    await expect(
      service.getAuditEvents({ from: '2026-02-30' }),
    ).rejects.toThrow('Invalid request');
    await expect(service.getAuditEvents({ to: '2026-13-01' })).rejects.toThrow(
      'Invalid request',
    );
    await expect(
      service.getAuditEvents({ from: '2026-09-07', to: '2026-09-01' }),
    ).rejects.toThrow('Invalid request');
    await expect(service.getAuditEvents({ limit: '0' })).rejects.toThrow(
      'Invalid request',
    );
    await expect(service.getAuditEvents({ limit: '101' })).rejects.toThrow(
      'Invalid request',
    );
    await expect(service.getAuditEvents({ limit: 'abc' })).rejects.toThrow(
      'Invalid request',
    );
    await expect(service.getAuditEvents({ limit: '1.5' })).rejects.toThrow(
      'Invalid request',
    );
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects cursors that are not the constant base64url shape', async () => {
    const encode = (raw: string) =>
      Buffer.from(raw, 'utf8').toString('base64url');
    await expect(
      service.getAuditEvents({ cursor: encode('no-separator') }),
    ).rejects.toThrow('Invalid request');
    await expect(
      service.getAuditEvents({ cursor: encode('2026-09-28T10:00:00Z|evt-9') }),
    ).rejects.toThrow('Invalid request');
    await expect(
      service.getAuditEvents({
        cursor: encode('2026-09-28T10:00:00.000Z|'),
      }),
    ).rejects.toThrow('Invalid request');
    await expect(
      service.getAuditEvents({ cursor: '!!!not-base64!!!' }),
    ).rejects.toThrow('Invalid request');
    expect(query).not.toHaveBeenCalled();
  });

  it('excludes rows whose actor_type or result leaves the closed lists', async () => {
    query.mockResolvedValueOnce({
      rows: [
        auditRow({ event_key: 'evt-bad', actor_type: 'hacker' }),
        auditRow({ event_key: 'evt-ok' }),
      ],
    });

    const response = await service.getAuditEvents({});

    expect(response.events).toHaveLength(1);
    expect(response.events[0]?.eventKey).toBe('evt-ok');
    expectHygiene(query);
  });
});
