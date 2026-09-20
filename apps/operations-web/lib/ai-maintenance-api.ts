import "server-only";
import type {
  AiBudgetProjection,
  AiDriftProjection,
  AiFindingProjection,
  AiKillSwitchProjection,
  AiMaintenanceProjection,
} from "./ai-maintenance-types";

/**
 * Read-only client for the operations agent's AI maintenance projection.
 *
 * Fail-closed: any failure (unreachable agent, timeout, non-200 response,
 * malformed JSON or a payload that does not match the mirror types) yields
 * an explicit `unavailable` view. This module never throws, never retries
 * and never logs payload content.
 */
export interface AiMaintenanceView {
  available: boolean;
  projection: AiMaintenanceProjection;
}

const DEFAULT_AI_AGENT_URL = "http://127.0.0.1:3090";
const AI_MAINTENANCE_PATH = "/ai-maintenance";
const TIMEOUT_MS = 3000;

const ASSESSMENTS = ["GREEN", "AMBER", "RED", "NO_DATA", "UNKNOWN"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isFinding(value: unknown): value is AiFindingProjection {
  return (
    isRecord(value) &&
    isString(value.findingKey) &&
    isString(value.severity) &&
    isString(value.safeTitle) &&
    isString(value.assessment) &&
    (ASSESSMENTS as readonly string[]).includes(value.assessment) &&
    isString(value.confidence) &&
    isString(value.issueCode) &&
    isString(value.recommendedRunbook) &&
    isString(value.explainedAt) &&
    isString(value.model)
  );
}

function isBudget(value: unknown): value is AiBudgetProjection {
  return (
    isRecord(value) &&
    isBoolean(value.aiEnabled) &&
    isNumber(value.dayCallsUsed) &&
    isNumber(value.dayCallsMax) &&
    isString(value.monthEurUsed) &&
    isNumber(value.monthEurCeiling)
  );
}

function isKillSwitches(value: unknown): value is AiKillSwitchProjection {
  return (
    isRecord(value) &&
    isBoolean(value.aiEnabled) &&
    isBoolean(value.telegramCommandsEnabled) &&
    isBoolean(value.autoRemediationEnabled) &&
    isBoolean(value.repairMasterEnabled)
  );
}

function isDrift(value: unknown): value is AiDriftProjection {
  return (
    isRecord(value) &&
    isString(value.state) &&
    isNumber(value.driftCount) &&
    isNumber(value.staleCount) &&
    isStringOrNull(value.scannedAt)
  );
}

function isProjection(value: unknown): value is AiMaintenanceProjection {
  return (
    isRecord(value) &&
    isString(value.generatedAt) &&
    isString(value.environmentKey) &&
    Array.isArray(value.findings) &&
    value.findings.every(isFinding) &&
    isBudget(value.budget) &&
    isKillSwitches(value.killSwitches) &&
    isDrift(value.drift)
  );
}

function unavailableProjection(): AiMaintenanceProjection {
  return {
    generatedAt: "",
    environmentKey: "unavailable",
    findings: [],
    budget: {
      aiEnabled: false,
      dayCallsUsed: 0,
      dayCallsMax: 0,
      monthEurUsed: "0",
      monthEurCeiling: 0,
    },
    killSwitches: {
      aiEnabled: false,
      telegramCommandsEnabled: false,
      autoRemediationEnabled: false,
      repairMasterEnabled: false,
    },
    drift: { state: "UNKNOWN_STALE", driftCount: 0, staleCount: 0, scannedAt: null },
  };
}

const unavailableView: AiMaintenanceView = {
  available: false,
  projection: unavailableProjection(),
};

export async function getAiMaintenanceProjection(): Promise<AiMaintenanceView> {
  const baseUrl = (process.env.AI_AGENT_INTERNAL_URL ?? DEFAULT_AI_AGENT_URL).replace(/\/+$/, "");
  let response: Response;
  try {
    response = await fetch(`${baseUrl}${AI_MAINTENANCE_PATH}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    return unavailableView;
  }
  if (!response.ok) return unavailableView;
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return unavailableView;
  }
  if (!isProjection(body)) return unavailableView;
  return { available: true, projection: body };
}
