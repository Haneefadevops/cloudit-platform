import "server-only";

export type HealthStatus = "GREEN" | "AMBER" | "RED" | "NO_DATA" | "UNKNOWN";
export type OverdueState = "on_time" | "due" | "overdue";
export type TriggerKind = string;
export type FailureCategory = string | null;

export interface WorkflowHealthEntry {
  workflowKey: string;
  displayName: string;
  triggerKind: TriggerKind;
  scheduleExpression: string | null;
  scheduleTimezone: string | null;
  enabled: boolean;
  criticality: string;
  latestOutcome: string | null;
  latestObservedAt: string | null;
  latestStartedAt: string | null;
  latestFinishedAt: string | null;
  latestDurationMs: number | null;
  latestScheduleDelayMs: number | null;
  failureCategory: FailureCategory;
  status: HealthStatus;
  successPercent24h: number | null;
  successPercent7d: number | null;
}

export interface EvidenceFreshnessEntry {
  sourceSystem: string;
  latestObservedAt: string | null;
}

export interface EnvironmentOverview {
  environmentKey: string;
  displayName: string;
  state: string;
  domains: string[];
  workflowHealth: WorkflowHealthEntry[];
  evidenceFreshness: EvidenceFreshnessEntry[];
  environmentHealth: { level: HealthStatus; reasons: string[] };
}

export interface ClientOverview {
  clientKey: string;
  displayName: string;
  state: string;
  environments: EnvironmentOverview[];
}

export interface OperationsOverview {
  clients: ClientOverview[];
}

export interface WorkflowExecution {
  executionKey: string;
  outcome: string;
  triggerKind: TriggerKind;
  scheduledFor: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  scheduleDelayMs: number | null;
  failureCategory: FailureCategory;
  status: HealthStatus;
  observedAt: string | null;
}

export interface WorkflowCatalogueEntry {
  workflowKey: string;
  displayName: string;
  clientKey: string;
  environmentKey: string;
  triggerKind: TriggerKind;
  scheduleExpression: string | null;
  scheduleTimezone: string | null;
  enabled: boolean;
  completionSlaSeconds: number | null;
  criticality: string;
  latestExecution: {
    outcome: string;
    status: HealthStatus;
    failureCategory: FailureCategory;
    observedAt: string | null;
    scheduledFor: string | null;
    startedAt: string | null;
    finishedAt: string | null;
    durationMs: number | null;
    scheduleDelayMs: number | null;
  } | null;
  lastSuccessAt: string | null;
  nextExpectedRun: string | null;
  overdueState: OverdueState | null;
  successPercent: number | null;
  executionCount: number;
  window: string;
}

export interface WorkflowCatalogue {
  workflows: WorkflowCatalogueEntry[];
}

export interface WorkflowDefinition {
  workflowKey: string;
  displayName: string;
  triggerKind: TriggerKind;
  scheduleExpression: string | null;
  scheduleTimezone: string | null;
  enabled: boolean;
  completionSlaSeconds: number | null;
  criticality: string;
}

export interface WorkflowDetail {
  clientKey: string;
  environmentKey: string;
  definition: WorkflowDefinition;
  executions: WorkflowExecution[];
  successPercent: { "24h": number | null; "7d": number | null; "30d": number | null };
}

export class OperationsApiError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "OperationsApiError";
    this.statusCode = statusCode;
  }
}

const DEFAULT_BASE_URL = "http://platform-api:3001";
const TIMEOUT_MS = 5000;

function operationsConfig(): { baseUrl: string; token: string } {
  const baseUrl = process.env.OPERATIONS_API_BASE_URL ?? DEFAULT_BASE_URL;
  const token = process.env.OPERATIONS_INTERNAL_API_TOKEN;
  if (!token) {
    throw new OperationsApiError(500, "Operations API is not configured");
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), token };
}

async function fetchOperations<T>(path: string): Promise<T> {
  const { baseUrl, token } = operationsConfig();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/operations${path}`, {
      headers: { "x-operations-internal-token": token },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new OperationsApiError(503, "Operations API is unreachable");
  }
  if (!response.ok) {
    const statusCode = response.status;
    let message = "Operations API request failed";
    try {
      const body: unknown = await response.json();
      if (
        typeof body === "object" &&
        body !== null &&
        typeof (body as { message?: unknown }).message === "string"
      ) {
        message = (body as { message: string }).message;
      }
    } catch {
      // Keep the generic safe message.
    }
    throw new OperationsApiError(statusCode, message);
  }
  return (await response.json()) as T;
}

export async function getOperationsOverview(): Promise<OperationsOverview> {
  return fetchOperations<OperationsOverview>("/overview");
}

export type WorkflowsWindow = "24h" | "7d" | "30d";

export async function getWorkflowCatalogue(window: WorkflowsWindow): Promise<WorkflowCatalogue> {
  return fetchOperations<WorkflowCatalogue>(`/workflows?window=${window}`);
}

export async function getWorkflowDetail(workflowKey: string): Promise<WorkflowDetail[]> {
  const data = await fetchOperations<WorkflowDetail | WorkflowDetail[]>(
    `/workflows/${encodeURIComponent(workflowKey)}`,
  );
  return Array.isArray(data) ? data : [data];
}

export interface EndpointLatest {
  availability: boolean | string | null;
  httpStatus: number | null;
  responseTimeMs: number | null;
  checkedAt: string | null;
  status: HealthStatus;
}

export interface EndpointSeriesPoint {
  checkedAt: string;
  availability: boolean | string | null;
  responseTimeMs: number | null;
}

export interface MonitoredEndpoint {
  endpointKey: string;
  displayLabel: string;
  environmentKey: string;
  urlHost: string;
  latest: EndpointLatest | null;
  series24h: EndpointSeriesPoint[];
}

export interface RollupMetric {
  value: number | boolean | null;
  unit: string;
}

export interface MetricSeriesPoint {
  observedAt: string;
  value: number | boolean | null;
}

export interface DatabaseEvidence {
  environmentKey: string;
  latest: {
    up: boolean | null;
    status: HealthStatus;
    observedAt: string | null;
    rollupMetrics: Record<string, RollupMetric>;
  } | null;
  series: Record<string, MetricSeriesPoint[]>;
}

export interface OperationsInfrastructure {
  generatedAt: string;
  endpoints: MonitoredEndpoint[];
  database: DatabaseEvidence;
}

export async function getOperationsInfrastructure(): Promise<OperationsInfrastructure> {
  return fetchOperations<OperationsInfrastructure>("/infrastructure");
}

export interface OperationsVercelTraffic {
  timezone: string;
  boundary: string;
  daily: { periodStart: string; visitors: number | null; pageviews: number | null }[];
  totals: { visitors: number | null; pageviews: number | null };
  topRoutes: { path: string; views: number }[];
  lastTrafficAt: string | null;
}

export interface OperationsVercelDeployment {
  deploymentKey: string;
  state: string;
  createdAt: string | null;
  readyAt: string | null;
  durationMs: number | null;
  isCurrentProduction?: boolean;
}

export interface OperationsVercel {
  generatedAt: string;
  rollupStatus: HealthStatus;
  traffic: OperationsVercelTraffic | null;
  deployments: {
    current: OperationsVercelDeployment | null;
    recent: OperationsVercelDeployment[];
    lastDeploymentAt: string | null;
  };
  domains: { domain: string; verified: boolean | null; observedAt: string }[];
  connectivity: {
    reachable: boolean | null;
    lastSuccessfulAt: string | null;
    failureCategory: string | null;
  };
}

export async function getOperationsVercel(): Promise<OperationsVercel> {
  return fetchOperations<OperationsVercel>("/vercel");
}

export interface OperationsImagekitQuota {
  metricKey: string;
  displayName: string;
  unit: string;
  used: number | null;
  quota: number | null;
  remainingPercent: number | null;
  trend: { periodStart: string; value: number | null }[];
  lastSampleAt: string | null;
}

export interface OperationsImagekit {
  generatedAt: string;
  rollupStatus: HealthStatus;
  quotas: OperationsImagekitQuota[];
  utilizationPercent: number | null;
  connectivity: {
    reachable: boolean | null;
    lastSuccessfulAt: string | null;
    failureCategory: string | null;
  };
  warningThresholds: { state: "NO_DATA"; note: string };
}

export async function getOperationsImagekit(): Promise<OperationsImagekit> {
  return fetchOperations<OperationsImagekit>("/imagekit");
}

export type BackupDayState = "ok" | "failed" | "missing" | "future";

export interface OperationsBackupsLatestBackup {
  backupTimestamp: string;
  ageSeconds: number;
  durationMs: number | null;
  githubRunUrl: string | null;
  encryptedArchivePresent: boolean;
  checksumFilePresent: boolean;
  checksumVerified: boolean;
  driveRoundTripPassed: boolean;
  archiveStructureValidated: boolean;
  sizeBytes: number | null;
  retentionClass: "daily" | "monthly";
}

export interface OperationsBackupsRestoreTest {
  result: "passed" | "failed" | null;
  startedAt: string;
  ageSeconds: number;
  durationMs: number | null;
  githubRunUrl: string | null;
  checksumPassed: boolean | null;
  decryptPassed: boolean | null;
  isolatedRestorePassed: boolean | null;
  requiredObjectsPassed: boolean | null;
  rlsPassed: boolean | null;
  anonymousDenialPassed: boolean | null;
  publicWhitelistPassed: boolean | null;
  cleanupPassed: boolean | null;
}

export interface OperationsBackups {
  generatedAt: string;
  rollup: { level: HealthStatus; reasons: string[] };
  calendar: { year: number; month: number; days: { date: string; state: BackupDayState }[] };
  latestBackup: OperationsBackupsLatestBackup | null;
  sizeTrend: { date: string; sizeBytes: number | null }[];
  latestRestoreTest: OperationsBackupsRestoreTest | null;
  schedule: { lastSuccessAt: string | null; expectedNextRunAt: string | null; overdue: boolean };
}

export async function getOperationsBackups(): Promise<OperationsBackups> {
  return fetchOperations<OperationsBackups>("/backups");
}
