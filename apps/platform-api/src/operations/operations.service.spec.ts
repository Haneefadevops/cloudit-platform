jest.mock('axios');
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

import { createHmac } from 'crypto';
import axios from 'axios';
import { OperationsService } from './operations.service';
import {
  buildReportCommandCanonical,
  REPORT_RECIPIENT_POLICY_KEY,
  ReportCommandType,
} from './report-command-payload.util';

const mockedAxios = axios as jest.Mocked<typeof axios>;

interface RelayPayload {
  version: string;
  commandKey: string;
  commandType: ReportCommandType;
  reportKey: string;
  clientKey: string;
  expectedRowVersion: number;
  expectedState: string;
  nonce: string;
  issuedAt: number;
  expiresAt: number;
  correlationId: string;
  recipientPolicyKey: string;
  reasonDigest: string;
}

interface RelayBody {
  payload: RelayPayload;
  signature: string;
  reason?: string;
}

interface RelayConfig {
  headers: Record<string, string>;
  timeout: number;
}

describe('OperationsService Phase 9 reports', () => {
  let service: OperationsService;
  const query = jest.fn();

  beforeAll(() => {
    service = new OperationsService({ query } as never);
  });

  beforeEach(() => query.mockReset());

  it('returns only allowlisted report metadata and attaches rows by report key', async () => {
    query
      .mockResolvedValueOnce({
        rows: [
          {
            report_key: 'cavetta.monthly_maintenance.2026-09',
            client_key: 'cavetta',
            client_display_name: 'Cavetta',
            report_month: '2026-09-01',
            report_type: 'monthly_maintenance',
            overall_status: 'AMBER',
            document_status: 'DRAFT',
            generated_at: new Date('2026-09-01T09:00:00Z'),
            coverage: 'FULL',
            finding_counts_by_severity: { warning: 1 },
            pdf_available: true,
            send_attempt_count: 0,
            delivery_failure_category: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            report_key: 'cavetta.monthly_maintenance.2026-09',
            finding_key: 'safe-finding',
            category: 'workflow',
            severity: 'warning',
            status: 'open',
            safe_title: 'Delayed run',
            safe_summary: null,
            safe_action: 'Review schedule',
            first_observed_at: null,
            last_observed_at: null,
          },
          {
            report_key: 'another-client-report',
            finding_key: 'must-not-attach',
            category: 'workflow',
            severity: 'critical',
            status: 'open',
            safe_title: 'Other tenant',
            safe_summary: null,
            safe_action: null,
            first_observed_at: null,
            last_observed_at: null,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            report_key: 'cavetta.monthly_maintenance.2026-09',
            event_type: 'GENERATED',
            from_status: null,
            to_status: 'DRAFT',
            occurred_at: new Date('2026-09-01T09:00:00Z'),
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            report_id: 'report-internal-id',
            report_key: 'cavetta.monthly_maintenance.2026-09',
            command_type: 'APPROVE_AND_SEND',
            status: 'dispatched',
            result_code: null,
            requested_at: new Date('2026-09-02T09:00:00Z'),
            completed_at: null,
          },
        ],
      });

    const response = await service.getReports();
    expect(response.reports).toEqual([
      {
        reportKey: 'cavetta.monthly_maintenance.2026-09',
        clientKey: 'cavetta',
        clientDisplayName: 'Cavetta',
        reportMonth: '2026-09-01',
        reportType: 'monthly_maintenance',
        overallStatus: 'AMBER',
        documentStatus: 'DRAFT',
        generatedAt: '2026-09-01T09:00:00.000Z',
        coverage: 'FULL',
        findingCountsBySeverity: { warning: 1 },
        pdfAvailable: true,
        sendAttemptCount: 0,
        deliveryFailureCategory: null,
        recentCommand: {
          commandType: 'APPROVE_AND_SEND',
          status: 'dispatched',
          resultCode: null,
          requestedAt: '2026-09-02T09:00:00.000Z',
          completedAt: null,
        },
        findings: [
          {
            findingKey: 'safe-finding',
            category: 'workflow',
            severity: 'warning',
            status: 'open',
            safeTitle: 'Delayed run',
            safeSummary: null,
            safeAction: 'Review schedule',
            firstObservedAt: null,
            lastObservedAt: null,
          },
        ],
        history: [
          {
            eventType: 'GENERATED',
            fromStatus: null,
            toStatus: 'DRAFT',
            occurredAt: '2026-09-01T09:00:00.000Z',
          },
        ],
      },
    ]);
    for (const [sql] of query.mock.calls as [string][]) {
      expect(sql).not.toMatch(/pdfDrive|object_key|source_payload/i);
    }
  });
});

describe('OperationsService Phase 10 report commands', () => {
  let service: OperationsService;
  const query = jest.fn();

  beforeAll(() => {
    service = new OperationsService({ query } as never);
  });

  beforeEach(() => {
    query.mockReset();
    mockedAxios.post.mockReset();
  });

  const reportKey = 'cavetta.monthly_maintenance.2026-09';
  const requestKey = 'req-key-123456789012345';

  const reconcileRow = { rows: [] };
  const reportRow = (overrides: Record<string, unknown> = {}) => ({
    rows: [
      {
        id: 'report-internal-id',
        report_key: reportKey,
        client_id: 'client-internal-id',
        client_key: 'cavetta',
        document_status: 'DRAFT',
        row_version: 7,
        sent_at: null,
        pdf_available: true,
        ...overrides,
      },
    ],
  });
  const createFnRow = (overrides: Record<string, unknown> = {}) => ({
    rows: [
      {
        command_id: 'command-internal-id',
        command_key: 'generated-by-service',
        command_type: 'APPROVE_AND_SEND',
        status: 'pending',
        result_code: null,
        expires_at: new Date('2026-09-15T00:02:00Z'),
        already_recorded: false,
        denial_code: null,
        ...overrides,
      },
    ],
  });
  const dispatchFnRow = (overrides: Record<string, unknown> = {}) => ({
    rows: [
      {
        command_id: 'command-internal-id',
        status: 'dispatched',
        result_code: null,
        denial_code: null,
        ...overrides,
      },
    ],
  });
  const stateRow = (overrides: Record<string, unknown> = {}) => ({
    rows: [
      {
        command_type: 'APPROVE_AND_SEND',
        status: 'dispatched',
        result_code: null,
        requested_at: new Date('2026-09-15T00:00:00Z'),
        completed_at: null,
        ...overrides,
      },
    ],
  });

  it('creates, dispatches and relays a command with a verifiable signature', async () => {
    query
      .mockResolvedValueOnce(reconcileRow)
      .mockResolvedValueOnce(reportRow())
      .mockResolvedValueOnce(createFnRow())
      .mockResolvedValueOnce(dispatchFnRow())
      .mockResolvedValueOnce(stateRow());
    mockedAxios.post.mockResolvedValue({ status: 200 });

    const response = await service.createReportCommand(reportKey, {
      commandType: 'APPROVE_AND_SEND',
      requestKey,
    });

    expect(response).toEqual({
      generatedAt: expect.any(String) as string,
      reportKey,
      status: 'dispatched',
      resultCode: null,
      denialCode: null,
      alreadyRecorded: false,
    });

    expect(mockedAxios.post.mock.calls).toHaveLength(1);
    const [url, relayBody, config] = mockedAxios.post.mock.calls[0] as [
      string,
      RelayBody,
      RelayConfig,
    ];
    expect(url).toBe('http://n8n:5678/webhook/cloudit-report-command');
    expect(config.headers).toEqual({
      'content-type': 'application/json',
      'x-cloudit-report-command-token':
        'phase-10-test-token-with-at-least-32chars',
    });
    expect(config.timeout).toBe(10000);

    const payload = relayBody.payload;
    expect(payload.version).toBe('v1');
    expect(payload.commandKey).toMatch(/^[a-f0-9]{32}$/);
    expect(payload.commandType).toBe('APPROVE_AND_SEND');
    expect(payload.reportKey).toBe(reportKey);
    expect(payload.clientKey).toBe('cavetta');
    expect(payload.expectedRowVersion).toBe(7);
    expect(payload.expectedState).toBe('DRAFT');
    expect(payload.nonce).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.correlationId).toMatch(/^[a-f0-9]{32}$/);
    expect(payload.recipientPolicyKey).toBe(REPORT_RECIPIENT_POLICY_KEY);
    expect(payload.reasonDigest).toBe('-');
    expect(payload.expiresAt - payload.issuedAt).toBe(120);
    expect(relayBody.reason).toBeUndefined();

    // The relayed signature must verify against the canonical payload.
    const expected = createHmac(
      'sha256',
      'phase-10-test-secret-with-at-least-32-chars',
    )
      .update(
        buildReportCommandCanonical({
          commandKey: payload.commandKey,
          commandType: payload.commandType,
          reportKey: payload.reportKey,
          clientKey: payload.clientKey,
          expectedRowVersion: payload.expectedRowVersion,
          expectedState: payload.expectedState,
          nonce: payload.nonce,
          issuedAt: payload.issuedAt,
          expiresAt: payload.expiresAt,
          correlationId: payload.correlationId,
          recipientPolicyKey: payload.recipientPolicyKey,
          reasonDigest: payload.reasonDigest,
        }),
      )
      .digest('hex');
    expect(relayBody.signature).toBe(expected);

    // Bound parameters: nonce is sent only as its SHA-256 hash to the DB.
    const [, createParams] = query.mock.calls[2] as [string, unknown[]];
    expect(createParams[6]).toMatch(/^[a-f0-9]{64}$/);
    expect(createParams[6]).not.toBe(payload.nonce);
  });

  it('persists only the nonce hash, never the wire nonce', async () => {
    query
      .mockResolvedValueOnce(reconcileRow)
      .mockResolvedValueOnce(reportRow())
      .mockResolvedValueOnce(createFnRow())
      .mockResolvedValueOnce(dispatchFnRow())
      .mockResolvedValueOnce(stateRow());
    mockedAxios.post.mockResolvedValue({ status: 200 });

    await service.createReportCommand(reportKey, {
      commandType: 'REJECT',
      requestKey,
      reason: '  Report   not ready  ',
    });

    const [, relayBody] = mockedAxios.post.mock.calls[0] as [string, RelayBody];
    const wireNonce = relayBody.payload.nonce;
    for (const [sql, params] of query.mock.calls as [string, unknown[]][]) {
      expect(sql).not.toContain(wireNonce);
      expect(params === undefined ? '' : JSON.stringify(params)).not.toContain(
        wireNonce,
      );
    }
    // A reject reason normalizes, is relayed in plaintext only to n8n, and
    // is persisted only as its digest.
    expect(relayBody.reason).toBe('Report not ready');
    expect(relayBody.payload.reasonDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(relayBody.payload.recipientPolicyKey).toBe('-');
  });

  it('denies a command when the report is in the wrong state (no relay)', async () => {
    query.mockResolvedValueOnce(reconcileRow).mockResolvedValueOnce(
      reportRow({
        document_status: 'SENT',
        sent_at: new Date('2026-09-10T00:00:00Z'),
      }),
    );

    const response = await service.createReportCommand(reportKey, {
      commandType: 'APPROVE_AND_SEND',
      requestKey,
    });

    expect(response).toEqual({
      generatedAt: expect.any(String) as string,
      reportKey,
      status: 'denied',
      resultCode: 'rejected_state',
      denialCode: 'rejected_state',
      alreadyRecorded: false,
    });
    expect(mockedAxios.post.mock.calls).toHaveLength(0);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('returns a DB-side denial (stale version) as a 200 body', async () => {
    query
      .mockResolvedValueOnce(reconcileRow)
      .mockResolvedValueOnce(reportRow())
      .mockResolvedValueOnce(
        createFnRow({ denial_code: 'rejected_stale_version' }),
      );

    const response = await service.createReportCommand(reportKey, {
      commandType: 'APPROVE_AND_SEND',
      requestKey,
    });

    expect(response).toEqual({
      generatedAt: expect.any(String) as string,
      reportKey,
      status: 'denied',
      resultCode: 'rejected_stale_version',
      denialCode: 'rejected_stale_version',
      alreadyRecorded: false,
    });
    expect(mockedAxios.post.mock.calls).toHaveLength(0);
  });

  it('returns the winning state when a concurrent dispatch wins the CAS race', async () => {
    query
      .mockResolvedValueOnce(reconcileRow)
      .mockResolvedValueOnce(reportRow())
      .mockResolvedValueOnce(createFnRow())
      .mockResolvedValueOnce(dispatchFnRow({ denial_code: 'rejected_replay' }))
      .mockResolvedValueOnce(stateRow({ status: 'dispatched' }));

    const response = await service.createReportCommand(reportKey, {
      commandType: 'APPROVE_AND_SEND',
      requestKey,
    });

    expect(response).toEqual({
      generatedAt: expect.any(String) as string,
      reportKey,
      status: 'dispatched',
      resultCode: null,
      denialCode: 'rejected_replay',
      alreadyRecorded: true,
    });
    expect(mockedAxios.post.mock.calls).toHaveLength(0);
  });

  it('still returns the dispatched state when the n8n relay fails', async () => {
    query
      .mockResolvedValueOnce(reconcileRow)
      .mockResolvedValueOnce(reportRow())
      .mockResolvedValueOnce(createFnRow())
      .mockResolvedValueOnce(dispatchFnRow())
      .mockResolvedValueOnce(stateRow());
    mockedAxios.post.mockRejectedValue(new Error('n8n unreachable'));

    const response = await service.createReportCommand(reportKey, {
      commandType: 'APPROVE_AND_SEND',
      requestKey,
    });

    expect(response.status).toBe('dispatched');
    expect(response.resultCode).toBeNull();
    expect(mockedAxios.post.mock.calls).toHaveLength(1);
  });

  it('rejects malformed command input before touching the command table', async () => {
    query.mockResolvedValue(reportRow());
    await expect(
      service.createReportCommand(reportKey, { commandType: 'DELETE' }),
    ).rejects.toThrow('Invalid request');
    await expect(
      service.createReportCommand(reportKey, {
        commandType: 'REJECT',
        requestKey: 'short',
      }),
    ).rejects.toThrow('Invalid request');
    await expect(
      service.createReportCommand('Bad Key!', {
        commandType: 'REJECT',
        requestKey,
      }),
    ).rejects.toThrow('Invalid request');
    // Only reconcile/report reads ran; no command write was attempted.
    for (const [sql] of query.mock.calls as [string][]) {
      expect(sql).not.toMatch(/create_report_command_request/i);
    }
  });

  it('maps the recent command list without nonce/signature/key columns', async () => {
    query.mockResolvedValueOnce(reconcileRow).mockResolvedValueOnce({
      rows: [
        {
          command_type: 'RETRY_SEND',
          status: 'completed',
          result_code: 'sent',
          requested_at: new Date('2026-09-05T09:00:00Z'),
          completed_at: new Date('2026-09-05T09:01:00Z'),
        },
        {
          command_type: 'APPROVE_AND_SEND',
          status: 'completed',
          result_code: 'send_failed',
          requested_at: new Date('2026-09-04T09:00:00Z'),
          completed_at: null,
        },
      ],
    });

    const response = await service.getReportCommands(reportKey);

    expect(response.commands).toEqual([
      {
        commandType: 'RETRY_SEND',
        status: 'completed',
        resultCode: 'sent',
        requestedAt: '2026-09-05T09:00:00.000Z',
        completedAt: '2026-09-05T09:01:00.000Z',
      },
      {
        commandType: 'APPROVE_AND_SEND',
        status: 'completed',
        resultCode: 'send_failed',
        requestedAt: '2026-09-04T09:00:00.000Z',
        completedAt: null,
      },
    ]);
    for (const [sql] of query.mock.calls.slice(1) as [string][]) {
      expect(sql).not.toMatch(/nonce|signature|request_key|command_key/i);
    }
  });

  it('accepts a claim and maps the released command context', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          command_id: 'command-internal-id',
          report_key: reportKey,
          command_type: 'APPROVE_AND_SEND',
          expected_row_version: 7,
          expected_state: 'DRAFT',
          status: 'claimed',
          result_code: null,
          denial_code: null,
        },
      ],
    });

    const response = await service.claimReportCommand({
      commandKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
      clientKey: 'cavetta',
      nonce: 'ab'.repeat(32),
    });

    expect(response).toEqual({
      generatedAt: expect.any(String) as string,
      result: 'accepted',
      command: {
        commandKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        commandType: 'APPROVE_AND_SEND',
        reportKey,
        expectedState: 'DRAFT',
      },
    });
    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params[2]).toMatch(/^[a-f0-9]{64}$/);
    expect(params[2]).not.toBe('ab'.repeat(32));
  });

  it('returns a claim denial without a command context', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          command_id: 'command-internal-id',
          report_key: reportKey,
          command_type: 'APPROVE_AND_SEND',
          expected_row_version: 7,
          expected_state: 'DRAFT',
          status: 'expired',
          result_code: 'rejected_expired',
          denial_code: 'rejected_expired',
        },
      ],
    });

    const response = await service.claimReportCommand({
      commandKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
      clientKey: 'cavetta',
      nonce: 'ab'.repeat(32),
    });

    expect(response).toEqual({
      generatedAt: expect.any(String) as string,
      result: 'denied',
      denialCode: 'rejected_expired',
    });
    expect(response.command).toBeUndefined();
  });

  it('accepts an acknowledge outcome', async () => {
    query.mockResolvedValueOnce({
      rows: [
        {
          command_id: 'command-internal-id',
          status: 'acknowledged',
          result_code: 'acknowledged',
          denial_code: null,
        },
      ],
    });

    const response = await service.acknowledgeReportCommand({
      commandKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
      clientKey: 'cavetta',
      resultCode: 'acknowledged',
    });

    expect(response).toEqual({
      generatedAt: expect.any(String) as string,
      result: 'accepted',
      status: 'acknowledged',
      resultCode: 'acknowledged',
    });
  });

  it('rejects an acknowledge with an unknown result code', async () => {
    await expect(
      service.acknowledgeReportCommand({
        commandKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
        clientKey: 'cavetta',
        resultCode: 'sent',
      }),
    ).rejects.toThrow('Invalid request');
    expect(query).not.toHaveBeenCalled();
  });

  it('derives the available actions from the report state', async () => {
    const cases: Array<
      [
        Record<string, unknown>,
        { approveAndSend: boolean; reject: boolean; retrySend: boolean },
      ]
    > = [
      [
        { document_status: 'DRAFT', pdf_available: true, sent_at: null },
        { approveAndSend: true, reject: true, retrySend: false },
      ],
      [
        { document_status: 'DRAFT', pdf_available: false, sent_at: null },
        { approveAndSend: false, reject: true, retrySend: false },
      ],
      [
        {
          document_status: 'SEND_FAILED',
          pdf_available: true,
          sent_at: null,
        },
        { approveAndSend: false, reject: false, retrySend: true },
      ],
      [
        {
          document_status: 'DRAFT',
          pdf_available: true,
          sent_at: new Date('2026-09-10T00:00:00Z'),
        },
        { approveAndSend: false, reject: false, retrySend: false },
      ],
    ];

    for (const [overrides, expectedActions] of cases) {
      query.mockReset();
      query.mockResolvedValueOnce(reportRow(overrides));
      const response = await service.getReportActions(reportKey);
      expect(response.reportKey).toBe(reportKey);
      expect(response.actions).toEqual(expectedActions);
    }
    expect(query).toHaveBeenCalledTimes(1); // no reconcile on the last case
  });
});
