import "server-only";

/**
 * Mirror of the agent's AiMaintenanceProjection
 * (@cloudit/operations-agent-contracts/src/ai-projection.ts).
 *
 * Coordinator-owned: keep structurally identical to the canonical type.
 * Server-only on purpose — this data must never be constructed in the
 * browser and never expose prompts, raw evidence, traces or secrets.
 */

export interface AiFindingProjection {
  findingKey: string;
  severity: string;
  safeTitle: string;
  assessment: "GREEN" | "AMBER" | "RED" | "NO_DATA" | "UNKNOWN";
  confidence: string;
  issueCode: string;
  recommendedRunbook: string;
  explainedAt: string;
  model: string;
}

export interface AiBudgetProjection {
  aiEnabled: boolean;
  dayCallsUsed: number;
  dayCallsMax: number;
  monthEurUsed: string;
  monthEurCeiling: number;
}

export interface AiKillSwitchProjection {
  aiEnabled: boolean;
  telegramCommandsEnabled: boolean;
  autoRemediationEnabled: boolean;
  repairMasterEnabled: boolean;
}

export interface AiDriftProjection {
  state: string;
  driftCount: number;
  staleCount: number;
  scannedAt: string | null;
}

export interface AiMaintenanceProjection {
  generatedAt: string;
  environmentKey: string;
  findings: AiFindingProjection[];
  budget: AiBudgetProjection;
  killSwitches: AiKillSwitchProjection;
  drift: AiDriftProjection;
}
