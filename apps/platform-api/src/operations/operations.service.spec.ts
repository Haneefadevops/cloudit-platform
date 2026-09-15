jest.mock('./operations.config', () => ({
  operationsConfig: {
    reportPdfRelaySecret: 'phase-9-test-secret-with-at-least-32-characters',
    staleEvidenceMs: 45 * 60 * 1000,
    analyticsStaleEvidenceMs: 24 * 60 * 60 * 1000,
  },
}));

import { OperationsService } from './operations.service';

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
      expect(sql).not.toMatch(
        /pdfDrive|object_key|report_commands|source_payload/i,
      );
    }
  });
});
