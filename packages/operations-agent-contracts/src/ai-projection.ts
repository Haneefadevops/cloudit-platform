/**
 * Read-only AI Maintenance projection (coordinator-owned contract between the
 * operations agent and the operations portal).
 *
 * This is the ONLY shape the portal may render for the AI maintenance
 * section. It contains sanitized aggregates and safe keys only: no prompts,
 * no raw evidence, no model traces, no secrets, no Telegram identifiers.
 * The agent builds it; the portal mirrors it structurally in
 * apps/operations-web/lib/ai-maintenance-types.ts and fetches it over a
 * server-to-server call in a later gated phase.
 */

import { HealthStatus } from './contracts/enums';

/** One AI-explained finding as shown in the portal. */
export interface AiFindingProjection {
  findingKey: string;
  severity: string;
  safeTitle: string;
  assessment: HealthStatus;
  confidence: string;
  issueCode: string;
  recommendedRunbook: string;
  /** ISO-8601 UTC timestamp of the explanation. */
  explainedAt: string;
  /** Model alias used ('gpt-5.6-luna' | 'gpt-5.6-terra' | 'deterministic'). */
  model: string;
}

/** Budget state for portal display; mirrors the platform BudgetService. */
export interface AiBudgetProjection {
  aiEnabled: boolean;
  dayCallsUsed: number;
  dayCallsMax: number;
  monthEurUsed: string;
  monthEurCeiling: number;
}

/** Kill-switch state; deterministic controls only, never secret material. */
export interface AiKillSwitchProjection {
  aiEnabled: boolean;
  telegramCommandsEnabled: boolean;
  autoRemediationEnabled: boolean;
  repairMasterEnabled: boolean;
}

/** Workflow-portal drift summary from the sync auditor. */
export interface AiDriftProjection {
  state: string;
  driftCount: number;
  staleCount: number;
  scannedAt: string | null;
}

/** Root projection for the portal AI Maintenance section. */
export interface AiMaintenanceProjection {
  generatedAt: string;
  environmentKey: string;
  findings: AiFindingProjection[];
  budget: AiBudgetProjection;
  killSwitches: AiKillSwitchProjection;
  drift: AiDriftProjection;
}
