/**
 * ObserverTelegramEvidence - the real read-only evidence binding for the
 * Telegram command layer (chat phase integration, coordinator-owned).
 *
 * Replaces the synthetic in-memory fixture with live, already-sanitized
 * views:
 *  - status/incidents/findings come from the soak driver's own tick state
 *    (deterministic supervisor verdict, digest board counts, incidents
 *    evidence row, last accepted assessment's findings). The driver never
 *    writes and its projections are policy-sanitized upstream, so nothing
 *    here can leak credentials, raw errors or customer payloads.
 *  - budget comes from the platform BudgetService plus the enforced limits
 *    in AgentConfigService (never estimates).
 *  - sync stays honestly UNBOUND: the sync observer's sources are
 *    deliberately unbound in this phase, and an invented "SYNCED" would be a
 *    lie. The command layer renders the state as-is.
 *
 * Honesty rules for degraded states: an unconfigured observer renders
 * NO_DATA / UNEVIDENCED, never synthetic GREEN; an unevidenced incidents
 * source renders one UNKNOWN entry instead of "No open incidents."; an
 * incidents board with N rows renders one aggregate entry (per-incident
 * detail is not projected yet) until a later phase adds that projection.
 */
import type { SoakDriver } from '../../observer';
import { AgentConfigService } from '../../config/agent-config.service';
import { BudgetService } from '../../platform/budget/budget.service';
import type {
  BudgetSummaryView,
  ReadOnlyEvidencePort,
  SafeFindingView,
  SafeIncidentView,
  StatusSnapshotView,
  SyncSummaryView,
} from '../commands/evidence-views';

export interface ObserverTelegramEvidenceDeps {
  /**
   * Read-only handle on the live soak driver; must yield null while the
   * observer is unconfigured (no operations DB password). Injected as a
   * function so tests can substitute a fake without module state.
   */
  soak: () => SoakDriver | null;
  /** Platform budget meter; without it the budget view renders zeros. */
  budget?: BudgetService;
  /** Single validated source for the enforced budget limits. */
  config: AgentConfigService;
  /** ms epoch; default Date.now. */
  now?: () => number;
}

const UNEVIDENCED_INCIDENT_KEY = 'INCIDENTS-UNEVIDENCED';
const AGGREGATE_INCIDENT_KEY = 'INCIDENTS-BOARD';

export class ObserverTelegramEvidence implements ReadOnlyEvidencePort {
  private readonly soak: () => SoakDriver | null;
  private readonly budget: BudgetService | undefined;
  private readonly config: AgentConfigService;
  private readonly now: () => number;

  constructor(deps: ObserverTelegramEvidenceDeps) {
    if (!deps || typeof deps !== 'object' || typeof deps.soak !== 'function') {
      throw new Error('observer telegram evidence: soak accessor is required');
    }
    if (!deps.config || typeof deps.config.get !== 'function') {
      throw new Error('observer telegram evidence: config is required');
    }
    this.soak = deps.soak;
    this.budget = deps.budget;
    this.config = deps.config;
    this.now = deps.now ?? (() => Date.now());
  }

  getStatus(): StatusSnapshotView {
    const soak = this.soak();
    if (!soak) {
      return {
        overall: 'NO_DATA',
        sourcesTotal: 0,
        sourcesRed: 0,
        sourcesAmber: 0,
        openIncidents: 0,
        generatedAt: new Date(this.now()).toISOString(),
      };
    }
    const snapshot = soak.getSnapshot();
    return {
      overall: snapshot.overall,
      sourcesTotal: snapshot.sourcesTotal,
      sourcesRed: snapshot.sourcesRed,
      sourcesAmber: snapshot.sourcesAmber,
      openIncidents: snapshot.openIncidents,
      generatedAt:
        snapshot.generatedAt.length > 0
          ? snapshot.generatedAt
          : new Date(this.now()).toISOString(),
    };
  }

  listIncidents(): SafeIncidentView[] {
    const soak = this.soak();
    if (!soak) return [this.unevidencedIncident(new Date(this.now()).toISOString())];
    const snapshot = soak.getSnapshot();
    if (!snapshot.incidentsEvident) {
      const startedAt =
        snapshot.generatedAt.length > 0
          ? snapshot.generatedAt
          : new Date(this.now()).toISOString();
      return [this.unevidencedIncident(startedAt)];
    }
    if (snapshot.openIncidents === 0) return [];
    // Per-incident detail is not projected yet; one aggregate row carries
    // the count (via the status view) and the board severity.
    return [
      {
        incidentKey: AGGREGATE_INCIDENT_KEY,
        severity: snapshot.incidentsSeverity,
        serviceKey: 'incidents',
        state: 'OPEN',
        startedAt: snapshot.incidentsObservedAt,
      },
    ];
  }

  getSyncSummary(): SyncSummaryView {
    return {
      state: 'UNBOUND',
      driftCount: 0,
      staleCount: 0,
      scannedAt: 'never',
    };
  }

  getBudgetSummary(): BudgetSummaryView {
    const limits = this.config.get();
    if (!this.budget) {
      return {
        dayCallsUsed: 0,
        dayCallsMax: limits.aiDailyCallMax,
        monthEurUsed: '0.00',
        monthEurCeiling: limits.aiMonthlyEurCeiling,
      };
    }
    const day = this.budget.getDaySummary();
    const month = this.budget.getMonthSummary();
    return {
      dayCallsUsed: day.calls,
      dayCallsMax: limits.aiDailyCallMax,
      monthEurUsed: month.estimatedEur.toFixed(2),
      monthEurCeiling: limits.aiMonthlyEurCeiling,
    };
  }

  getFinding(findingKey: string): SafeFindingView | undefined {
    const soak = this.soak();
    if (!soak) return undefined;
    const finding = soak.getFindings().find((item) => item.findingId === findingKey);
    if (!finding) return undefined;
    return {
      findingKey: finding.findingId,
      severity: finding.severity.toUpperCase(),
      safeTitle: finding.issueCode,
      safeSummary: finding.summary,
      recommendedRunbook: 'none',
    };
  }

  private unevidencedIncident(startedAt: string): SafeIncidentView {
    return {
      incidentKey: UNEVIDENCED_INCIDENT_KEY,
      severity: 'UNKNOWN',
      serviceKey: 'incidents',
      state: 'UNEVIDENCED',
      startedAt,
    };
  }
}
