import type {
  BudgetSummaryView,
  ReadOnlyEvidencePort,
  SafeFindingView,
  SafeIncidentView,
  SourceStatusView,
  StatusSnapshotView,
  SyncSummaryView,
} from './evidence-views';

/**
 * In-memory, obviously-synthetic evidence used as the default
 * {@link TELEGRAM_EVIDENCE_PORT} binding and in tests/examples. Every value
 * is a fixed fixture: no clock, no network, no randomness, so command output
 * is fully deterministic. The coordinator overrides this token with a
 * read-only adapter over real evidence at integration.
 */
export class InMemoryReadOnlyEvidence implements ReadOnlyEvidencePort {
  private readonly status: StatusSnapshotView = {
    overall: 'GREEN',
    sourcesTotal: 7,
    sourcesRed: 0,
    sourcesAmber: 1,
    openIncidents: 2,
    generatedAt: '2025-09-25T00:00:00.000Z',
  };

  private readonly incidents: SafeIncidentView[] = [
    {
      incidentKey: 'SYN-INCIDENT-0001',
      severity: 'AMBER',
      serviceKey: 'synthetic-n8n-workflows',
      state: 'OPEN',
      startedAt: '2025-09-24T10:00:00.000Z',
    },
    {
      incidentKey: 'SYN-INCIDENT-0002',
      severity: 'AMBER',
      serviceKey: 'synthetic-portal-catalogue',
      state: 'OPEN',
      startedAt: '2025-09-24T11:00:00.000Z',
    },
  ];

  private readonly syncSummary: SyncSummaryView = {
    state: 'SYNCED',
    driftCount: 0,
    staleCount: 1,
    scannedAt: '2025-09-25T00:00:00.000Z',
  };

  private readonly budgetSummary: BudgetSummaryView = {
    dayCallsUsed: 3,
    dayCallsMax: 100,
    monthEurUsed: '1.23',
    monthEurCeiling: 50,
  };

  private readonly findings = new Map<string, SafeFindingView>([
    [
      'SYN-FINDING-0001',
      {
        findingKey: 'SYN-FINDING-0001',
        severity: 'AMBER',
        safeTitle: 'Synthetic fixture: stale portal catalogue entry',
        safeSummary:
          'Deterministic fixture summary. A synthetic workflow entry is stale in the synthetic portal catalogue. No real systems are involved.',
        recommendedRunbook: 'SYN-RUNBOOK-STALE-01',
      },
    ],
  ]);

  private readonly sources: SourceStatusView[] = [
    { sourceKey: 'synthetic-n8n-workflows', category: 'AMBER' },
    { sourceKey: 'synthetic-public-website', category: 'GREEN' },
    { sourceKey: 'synthetic-database', category: 'GREEN' },
  ];

  getStatus(): StatusSnapshotView {
    return { ...this.status };
  }

  listSources(): SourceStatusView[] {
    return this.sources.map((source) => ({ ...source }));
  }

  listIncidents(): SafeIncidentView[] {
    return this.incidents.map((incident) => ({ ...incident }));
  }

  getSyncSummary(): SyncSummaryView {
    return { ...this.syncSummary };
  }

  getBudgetSummary(): BudgetSummaryView {
    return { ...this.budgetSummary };
  }

  getFinding(findingKey: string): SafeFindingView | undefined {
    const finding = this.findings.get(findingKey);
    return finding ? { ...finding } : undefined;
  }
}
