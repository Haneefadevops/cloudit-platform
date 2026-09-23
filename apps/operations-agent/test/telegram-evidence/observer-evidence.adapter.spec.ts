/**
 * Unit spec for the coordinator-owned real evidence binding
 * (ObserverTelegramEvidence). The soak driver and budget meter are faked;
 * AgentConfigService is real (safe defaults, no env dependence that matters
 * here). Honesty rules under test: unconfigured observer -> NO_DATA and an
 * UNEVIDENCED incident row (never synthetic GREEN or "No open incidents.");
 * unevidenced incidents source -> UNEVIDENCED row; zero rows -> empty list;
 * N rows -> one aggregate row; findings map from the last accepted
 * assessment; sync is honestly UNBOUND; budget renders the enforced limits.
 */
import { AgentConfigService } from '../../src/config/agent-config.service';
import type { SoakDriver } from '../../src/observer';
import { ObserverTelegramEvidence } from '../../src/telegram/evidence';
import type { ObserverStatusSnapshot } from '../../src/observer';

function snapshot(overrides: Partial<ObserverStatusSnapshot> = {}): ObserverStatusSnapshot {
  return {
    overall: 'GREEN',
    sourcesTotal: 13,
    sourcesRed: 0,
    sourcesAmber: 1,
    openIncidents: 0,
    incidentsEvident: false,
    incidentsSeverity: 'UNKNOWN',
    incidentsObservedAt: '',
    generatedAt: '2026-09-22T09:00:00.000Z',
    ...overrides,
  };
}

function fakeSoak(snap: ObserverStatusSnapshot, findings: unknown[] = []): SoakDriver {
  return {
    getSnapshot: () => snap,
    getFindings: () => findings,
  } as unknown as SoakDriver;
}

function fakeBudget(calls: number, eur: number) {
  return {
    getDaySummary: () => ({ calls, estimatedEur: 0, warnings: [] }),
    getMonthSummary: () => ({ calls, estimatedEur: eur, warnings: [] }),
  } as never;
}

describe('ObserverTelegramEvidence', () => {
  it('renders NO_DATA and an UNEVIDENCED incident row when the observer is unconfigured', () => {
    const evidence = new ObserverTelegramEvidence({
      soak: () => null,
      budget: fakeBudget(3, 1.23),
      config: new AgentConfigService(),
      now: () => 1_727_000_000_000,
    });

    const status = evidence.getStatus();
    expect(status.overall).toBe('NO_DATA');
    expect(status.sourcesTotal).toBe(0);
    expect(status.openIncidents).toBe(0);

    const incidents = evidence.listIncidents();
    expect(incidents).toHaveLength(1);
    expect(incidents[0].incidentKey).toBe('INCIDENTS-UNEVIDENCED');
    expect(incidents[0].severity).toBe('UNKNOWN');

    expect(evidence.getFinding('anything')).toBeUndefined();
  });

  it('maps the live observer snapshot into the status view', () => {
    const evidence = new ObserverTelegramEvidence({
      soak: () =>
        fakeSoak(
          snapshot({
            overall: 'AMBER',
            sourcesRed: 1,
            sourcesAmber: 2,
            openIncidents: 3,
            incidentsEvident: true,
            incidentsSeverity: 'AMBER',
            incidentsObservedAt: '2026-09-22T08:00:00.000Z',
          }),
        ),
      config: new AgentConfigService(),
    });

    const status = evidence.getStatus();
    expect(status).toEqual({
      overall: 'AMBER',
      sourcesTotal: 13,
      sourcesRed: 1,
      sourcesAmber: 2,
      openIncidents: 3,
      generatedAt: '2026-09-22T09:00:00.000Z',
    });

    const incidents = evidence.listIncidents();
    expect(incidents).toEqual([
      {
        incidentKey: 'INCIDENTS-BOARD',
        severity: 'AMBER',
        serviceKey: 'incidents',
        state: 'OPEN',
        startedAt: '2026-09-22T08:00:00.000Z',
      },
    ]);
  });

  it('renders an UNEVIDENCED row while the incidents source has no evidence, and none at zero rows', () => {
    const unevidenced = new ObserverTelegramEvidence({
      soak: () => fakeSoak(snapshot()),
      config: new AgentConfigService(),
    });
    const rows = unevidenced.listIncidents();
    expect(rows).toHaveLength(1);
    expect(rows[0].incidentKey).toBe('INCIDENTS-UNEVIDENCED');

    const zero = new ObserverTelegramEvidence({
      soak: () =>
        fakeSoak(
          snapshot({ incidentsEvident: true, incidentsSeverity: 'GREEN', openIncidents: 0 }),
        ),
      config: new AgentConfigService(),
    });
    expect(zero.listIncidents()).toEqual([]);
  });

  it('renders budget from the meter with the enforced config limits', () => {
    const evidence = new ObserverTelegramEvidence({
      soak: () => null,
      budget: fakeBudget(4, 1.235),
      config: new AgentConfigService(),
    });
    const budget = evidence.getBudgetSummary();
    expect(budget.dayCallsUsed).toBe(4);
    expect(budget.dayCallsMax).toBe(new AgentConfigService().get().aiDailyCallMax);
    expect(budget.monthEurUsed).toBe('1.24');
    expect(budget.monthEurCeiling).toBe(new AgentConfigService().get().aiMonthlyEurCeiling);

    const withoutMeter = new ObserverTelegramEvidence({
      soak: () => null,
      config: new AgentConfigService(),
    });
    const zeroed = withoutMeter.getBudgetSummary();
    expect(zeroed.dayCallsUsed).toBe(0);
    expect(zeroed.monthEurUsed).toBe('0.00');
  });

  it('renders sync honestly UNBOUND and maps findings by id', () => {
    const evidence = new ObserverTelegramEvidence({
      soak: () =>
        fakeSoak(snapshot(), [
          {
            findingId: 'FND-1',
            environmentKey: 'production',
            issueCode: 'SOURCE_STALE',
            severity: 'warning',
            state: 'open',
            summary: 'synthetic bounded summary',
            evidenceKeys: [],
            firstSeenAt: '2026-09-22T00:00:00.000Z',
            lastSeenAt: '2026-09-22T00:00:00.000Z',
          },
        ]),
      config: new AgentConfigService(),
    });

    expect(evidence.getSyncSummary()).toEqual({
      state: 'UNBOUND',
      driftCount: 0,
      staleCount: 0,
      scannedAt: 'never',
    });

    const finding = evidence.getFinding('FND-1');
    expect(finding).toEqual({
      findingKey: 'FND-1',
      severity: 'WARNING',
      safeTitle: 'SOURCE_STALE',
      safeSummary: 'synthetic bounded summary',
      recommendedRunbook: 'none',
    });
    expect(evidence.getFinding('MISSING')).toBeUndefined();
  });

  it('rejects incomplete construction', () => {
    expect(() => new ObserverTelegramEvidence({} as never)).toThrow(/soak/);
    expect(
      () => new ObserverTelegramEvidence({ soak: () => null } as never),
    ).toThrow(/config/);
  });
});
