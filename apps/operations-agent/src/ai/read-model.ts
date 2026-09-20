/**
 * Read-only portal projection assembly (contracts AiMaintenanceProjection).
 *
 * The read model composes ONLY coordinator-owned projections through narrow
 * structural ports — it never imports Worker C's src/platform services, so
 * the coordinator binds the real adapters at integration. The output is the
 * single shape the operations portal may render for the AI maintenance
 * section: sanitized aggregates and safe keys only, no prompts, raw evidence,
 * model traces, secrets or Telegram identifiers.
 */

import { AiFindingProjection, AiMaintenanceProjection } from '@cloudit/operations-agent-contracts';

export interface FindingsSource {
  list(): AiFindingProjection[];
}

export interface AiMaintenanceReadModelOptions {
  findings: FindingsSource;
  budget: {
    summary(): {
      aiEnabled: boolean;
      dayCallsUsed: number;
      dayCallsMax: number;
      monthEurUsed: string;
      monthEurCeiling: number;
    };
  };
  killSwitches: {
    states(): {
      aiEnabled: boolean;
      telegramCommandsEnabled: boolean;
      autoRemediationEnabled: boolean;
      repairMasterEnabled: boolean;
    };
  };
  drift: {
    summary(): { state: string; driftCount: number; staleCount: number; scannedAt: string | null };
  };
  environmentKey?: string;
  now?: () => number;
}

const DEFAULT_ENVIRONMENT_KEY = 'default';

export class AiMaintenanceReadModel {
  private readonly now: () => number;
  private readonly environmentKey: string;

  constructor(private readonly options: AiMaintenanceReadModelOptions) {
    this.now = options.now ?? (() => Date.now());
    this.environmentKey = options.environmentKey ?? DEFAULT_ENVIRONMENT_KEY;
  }

  /** Assembles the read-only portal projection (contracts AiMaintenanceProjection). */
  getProjection(): AiMaintenanceProjection {
    return {
      generatedAt: new Date(this.now()).toISOString(),
      environmentKey: this.environmentKey,
      findings: this.options.findings.list(),
      budget: this.options.budget.summary(),
      killSwitches: this.options.killSwitches.states(),
      drift: this.options.drift.summary(),
    };
  }
}

/** Fail-closed defaults so the module also compiles standalone (all disabled). */
export function defaultFindingsSource(): FindingsSource {
  return { list: () => [] };
}

export function defaultBudgetSummarySource(): AiMaintenanceReadModelOptions['budget'] {
  return {
    summary: () => ({
      aiEnabled: false,
      dayCallsUsed: 0,
      dayCallsMax: 0,
      monthEurUsed: '0',
      monthEurCeiling: 0,
    }),
  };
}

export function defaultKillSwitchSource(): AiMaintenanceReadModelOptions['killSwitches'] {
  return {
    states: () => ({
      aiEnabled: false,
      telegramCommandsEnabled: false,
      autoRemediationEnabled: false,
      repairMasterEnabled: false,
    }),
  };
}

export function defaultDriftSource(): AiMaintenanceReadModelOptions['drift'] {
  return {
    summary: () => ({ state: 'unknown', driftCount: 0, staleCount: 0, scannedAt: null }),
  };
}
