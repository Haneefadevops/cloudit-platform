import { BadRequestException, Injectable } from '@nestjs/common';
import { OperationsDataService } from './operations-data.service';
import { operationsConfig } from './operations.config';
import { nextCronRun } from './cron.util';
import {
  computeDatabaseRollupStatus,
  computeEnvironmentHealth,
  deriveEndpointStatus,
} from './health.util';

type WorkflowWindow = '24h' | '7d' | '30d';

const WINDOW_INTERVALS: Record<WorkflowWindow, string> = {
  '24h': '24 hours',
  '7d': '7 days',
  '30d': '30 days',
};

function parseWindow(raw: string | undefined): WorkflowWindow {
  if (raw === undefined || raw === '') {
    return '7d';
  }
  if (raw in WINDOW_INTERVALS) {
    return raw as WorkflowWindow;
  }
  throw new BadRequestException('Invalid window');
}

function iso(value: unknown): string | null {
  return value instanceof Date ? value.toISOString() : null;
}

function percent(successes: unknown, total: unknown): number | null {
  const totalCount = Number(total);
  if (!Number.isFinite(totalCount) || totalCount === 0) {
    return null;
  }
  return Math.round(((Number(successes) || 0) / totalCount) * 1000) / 10;
}

function compositeKey(...parts: string[]): string {
  return parts.join('|');
}

interface EnvironmentRow {
  client_key: string;
  environment_key: string;
  environment_display_name: string;
  environment_state: string;
  domain_name: string | null;
}

interface WorkflowHealthRow {
  client_key: string;
  environment_key: string;
  workflow_key: string;
  display_name: string;
  trigger_kind: string;
  schedule_expression: string | null;
  schedule_timezone: string;
  enabled: boolean;
  criticality: string;
  outcome: string | null;
  status: string | null;
  failure_category: string | null;
  observed_at: Date | null;
  started_at: Date | null;
  finished_at: Date | null;
  duration_ms: number | null;
  schedule_delay_ms: number | null;
}

interface WorkflowSuccessRow {
  client_key: string;
  environment_key: string;
  workflow_key: string;
  total_24h: number;
  success_24h: number;
  total_7d: number;
  success_7d: number;
}

interface FreshnessRow {
  client_key: string;
  environment_key: string;
  source_system: string;
  latest_observed_at: Date;
}

interface WorkflowCatalogueRow {
  client_key: string;
  environment_key: string;
  workflow_key: string;
  display_name: string;
  trigger_kind: string;
  schedule_expression: string | null;
  schedule_timezone: string;
  enabled: boolean;
  completion_sla_seconds: number | null;
  criticality: string;
  outcome: string | null;
  status: string | null;
  failure_category: string | null;
  observed_at: Date | null;
  scheduled_for: Date | null;
  started_at: Date | null;
  finished_at: Date | null;
  duration_ms: number | null;
  schedule_delay_ms: number | null;
  last_success_at: Date | null;
  window_total: number;
  window_success: number;
}

interface WorkflowDetailRow {
  definition_id: string;
  client_id: string;
  environment_id: string;
  client_key: string;
  environment_key: string;
  workflow_key: string;
  display_name: string;
  trigger_kind: string;
  schedule_expression: string | null;
  schedule_timezone: string;
  enabled: boolean;
  completion_sla_seconds: number | null;
  criticality: string;
}

interface ExecutionDetailRow {
  execution_key: string;
  outcome: string;
  trigger_kind: string | null;
  scheduled_for: Date | null;
  started_at: Date | null;
  finished_at: Date | null;
  duration_ms: number | null;
  schedule_delay_ms: number | null;
  failure_category: string | null;
  status: string | null;
  observed_at: Date;
}

interface WorkflowDetailSuccessRow {
  total_24h: number;
  success_24h: number;
  total_7d: number;
  success_7d: number;
  total_30d: number;
  success_30d: number;
}

interface InfrastructureEndpointRow {
  client_key: string;
  environment_key: string;
  endpoint_key: string;
  display_name: string;
  domain_name: string | null;
}

interface InfrastructureEndpointLatestRow {
  client_key: string;
  environment_key: string;
  endpoint_key: string;
  checked_at: Date;
  available: boolean;
  http_status: number | null;
  response_time_ms: number | null;
}

interface InfrastructureEndpointSeriesRow {
  client_key: string;
  environment_key: string;
  endpoint_key: string;
  checked_at: Date;
  available: boolean;
  response_time_ms: number | null;
}

interface InfrastructureMetricCatalogueRow {
  metric_key: string;
}

interface InfrastructureMetricSampleRow {
  metric_key: string;
  environment_key: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  unit: string;
  observed_at: Date;
}

/**
 * Read-only business logic for the operations endpoints. All database
 * access is SELECT-only through OperationsDataService; the only response
 * fields are the safe, allowlisted catalogue/evidence columns.
 */
@Injectable()
export class OperationsService {
  constructor(private readonly data: OperationsDataService) {}

  async getOverview(): Promise<{ clients: unknown[] }> {
    const [
      clientsResult,
      environmentRows,
      healthRows,
      successRows,
      freshnessRows,
    ] = await Promise.all([
      this.data.query<{
        client_key: string;
        display_name: string;
        state: string;
      }>(`
          SELECT c.client_key, c.display_name, c.state
          FROM operations.clients AS c
          WHERE c.state = 'active'
          ORDER BY c.client_key
        `),
      this.data.query<EnvironmentRow>(`
          SELECT cl.client_key, en.environment_key, en.display_name AS environment_display_name,
                 en.state AS environment_state, d.domain_name
          FROM operations.clients AS cl
          JOIN operations.environments AS en ON en.client_id = cl.id
          LEFT JOIN operations.domains AS d
            ON d.client_id = en.client_id AND d.environment_id = en.id
          WHERE cl.state = 'active'
          ORDER BY cl.client_key, en.environment_key, d.domain_name
        `),
      this.data.query<WorkflowHealthRow>(`
          SELECT cl.client_key, en.environment_key, wd.workflow_key, wd.display_name,
                 wd.trigger_kind, wd.schedule_expression, wd.schedule_timezone, wd.enabled,
                 wd.criticality, we.outcome, we.status, we.failure_category, we.observed_at,
                 we.started_at, we.finished_at, we.duration_ms, we.schedule_delay_ms
          FROM operations.clients AS cl
          JOIN operations.environments AS en ON en.client_id = cl.id
          JOIN operations.workflow_definitions AS wd
            ON wd.client_id = en.client_id AND wd.environment_id = en.id
          LEFT JOIN LATERAL (
            SELECT ex.outcome, ex.status, ex.failure_category, ex.observed_at, ex.started_at,
                   ex.finished_at, ex.duration_ms, ex.schedule_delay_ms
            FROM operations.workflow_executions AS ex
            WHERE ex.client_id = wd.client_id
              AND ex.environment_id = wd.environment_id
              AND ex.workflow_definition_id = wd.id
            ORDER BY ex.observed_at DESC
            LIMIT 1
          ) AS we ON true
          WHERE cl.state = 'active'
          ORDER BY cl.client_key, en.environment_key, wd.workflow_key
        `),
      this.data.query<WorkflowSuccessRow>(`
          SELECT cl.client_key, en.environment_key, wd.workflow_key,
                 COUNT(*) FILTER (WHERE ex.observed_at >= now() - interval '24 hours')::int AS total_24h,
                 COUNT(*) FILTER (WHERE ex.observed_at >= now() - interval '24 hours' AND ex.outcome = 'success')::int AS success_24h,
                 COUNT(*) FILTER (WHERE ex.observed_at >= now() - interval '7 days')::int AS total_7d,
                 COUNT(*) FILTER (WHERE ex.observed_at >= now() - interval '7 days' AND ex.outcome = 'success')::int AS success_7d
          FROM operations.workflow_executions AS ex
          JOIN operations.clients AS cl ON cl.id = ex.client_id AND cl.state = 'active'
          JOIN operations.environments AS en
            ON en.client_id = ex.client_id AND en.id = ex.environment_id
          JOIN operations.workflow_definitions AS wd
            ON wd.client_id = ex.client_id AND wd.id = ex.workflow_definition_id
          GROUP BY cl.client_key, en.environment_key, wd.workflow_key
        `),
      this.data.query<FreshnessRow>(`
          SELECT cl.client_key, en.environment_key, ex.source_system, MAX(ex.observed_at) AS latest_observed_at
          FROM operations.workflow_executions AS ex
          JOIN operations.clients AS cl ON cl.id = ex.client_id AND cl.state = 'active'
          JOIN operations.environments AS en
            ON en.client_id = ex.client_id AND en.id = ex.environment_id
          GROUP BY cl.client_key, en.environment_key, ex.source_system
          ORDER BY cl.client_key, en.environment_key, ex.source_system
        `),
    ]);

    const successByWorkflow = new Map<string, WorkflowSuccessRow>();
    for (const row of successRows.rows) {
      successByWorkflow.set(
        compositeKey(row.client_key, row.environment_key, row.workflow_key),
        row,
      );
    }

    const healthByEnv = new Map<string, WorkflowHealthRow[]>();
    for (const row of healthRows.rows) {
      const key = compositeKey(row.client_key, row.environment_key);
      const list = healthByEnv.get(key);
      if (list) {
        list.push(row);
      } else {
        healthByEnv.set(key, [row]);
      }
    }

    const freshnessByEnv = new Map<
      string,
      { sourceSystem: string; latestObservedAt: Date }[]
    >();
    const latestByEnvMs = new Map<string, number>();
    for (const row of freshnessRows.rows) {
      const key = compositeKey(row.client_key, row.environment_key);
      const list = freshnessByEnv.get(key);
      const entry = {
        sourceSystem: row.source_system,
        latestObservedAt: row.latest_observed_at,
      };
      if (list) {
        list.push(entry);
      } else {
        freshnessByEnv.set(key, [entry]);
      }
      latestByEnvMs.set(
        key,
        Math.max(latestByEnvMs.get(key) ?? 0, row.latest_observed_at.getTime()),
      );
    }

    const nowMs = Date.now();
    const staleEvidenceMs = operationsConfig.staleEvidenceMs;

    const environmentsByClient = new Map<
      string,
      Map<string, { displayName: string; state: string; domains: string[] }>
    >();
    for (const row of environmentRows.rows) {
      let envs = environmentsByClient.get(row.client_key);
      if (!envs) {
        envs = new Map();
        environmentsByClient.set(row.client_key, envs);
      }
      let env = envs.get(row.environment_key);
      if (!env) {
        env = {
          displayName: row.environment_display_name,
          state: row.environment_state,
          domains: [],
        };
        envs.set(row.environment_key, env);
      }
      if (row.domain_name) {
        env.domains.push(row.domain_name);
      }
    }

    const clients = clientsResult.rows.map((client) => {
      const envs = environmentsByClient.get(client.client_key);
      const environments = [...(envs?.entries() ?? [])].map(
        ([environmentKey, env]) => {
          const envKey = compositeKey(client.client_key, environmentKey);
          const workflows = healthByEnv.get(envKey) ?? [];

          const workflowHealth = workflows.map((workflow) => {
            const success = successByWorkflow.get(
              compositeKey(
                client.client_key,
                environmentKey,
                workflow.workflow_key,
              ),
            );
            return {
              workflowKey: workflow.workflow_key,
              displayName: workflow.display_name,
              triggerKind: workflow.trigger_kind,
              scheduleExpression: workflow.schedule_expression,
              scheduleTimezone: workflow.schedule_timezone,
              enabled: workflow.enabled,
              criticality: workflow.criticality,
              latestOutcome: workflow.outcome,
              latestObservedAt: iso(workflow.observed_at),
              latestStartedAt: iso(workflow.started_at),
              latestFinishedAt: iso(workflow.finished_at),
              latestDurationMs: workflow.duration_ms,
              latestScheduleDelayMs: workflow.schedule_delay_ms,
              failureCategory: workflow.failure_category,
              status: workflow.status,
              successPercent24h: percent(
                success?.success_24h,
                success?.total_24h,
              ),
              successPercent7d: percent(success?.success_7d, success?.total_7d),
            };
          });

          const freshness = freshnessByEnv.get(envKey) ?? [];
          const evidenceFreshness = freshness.map((entry) => ({
            sourceSystem: entry.sourceSystem,
            latestObservedAt: entry.latestObservedAt.toISOString(),
          }));

          const latestExecutions = workflows
            .filter((workflow) => workflow.observed_at !== null)
            .map((workflow) => ({
              criticality: workflow.criticality,
              outcome: workflow.outcome,
              status: workflow.status,
            }));
          const latestObservedAtMs = latestByEnvMs.get(envKey) ?? null;
          const environmentHealth = computeEnvironmentHealth(
            latestExecutions,
            latestObservedAtMs,
            nowMs,
            staleEvidenceMs,
          );

          return {
            environmentKey,
            displayName: env.displayName,
            state: env.state,
            domains: env.domains,
            workflowHealth,
            evidenceFreshness,
            environmentHealth,
          };
        },
      );

      return {
        clientKey: client.client_key,
        displayName: client.display_name,
        state: client.state,
        environments,
      };
    });

    return { clients };
  }

  async getWorkflows(rawWindow?: string): Promise<{ workflows: unknown[] }> {
    const window = parseWindow(rawWindow);
    const interval = WINDOW_INTERVALS[window];

    const catalogue = await this.data.query<WorkflowCatalogueRow>(
      `
        SELECT cl.client_key, en.environment_key, wd.workflow_key, wd.display_name,
               wd.trigger_kind, wd.schedule_expression, wd.schedule_timezone, wd.enabled,
               wd.completion_sla_seconds, wd.criticality,
               we.outcome, we.status, we.failure_category, we.observed_at, we.scheduled_for,
               we.started_at, we.finished_at, we.duration_ms, we.schedule_delay_ms,
               ls.last_success_at,
               COUNT(ex.id)::int AS window_total,
               COUNT(ex.id) FILTER (WHERE ex.outcome = 'success')::int AS window_success
        FROM operations.workflow_definitions AS wd
        JOIN operations.clients AS cl ON cl.id = wd.client_id AND cl.state = 'active'
        JOIN operations.environments AS en
          ON en.client_id = wd.client_id AND en.id = wd.environment_id
        LEFT JOIN LATERAL (
          SELECT ex.outcome, ex.status, ex.failure_category, ex.observed_at, ex.scheduled_for,
                 ex.started_at, ex.finished_at, ex.duration_ms, ex.schedule_delay_ms
          FROM operations.workflow_executions AS ex
          WHERE ex.client_id = wd.client_id
            AND ex.environment_id = wd.environment_id
            AND ex.workflow_definition_id = wd.id
          ORDER BY ex.observed_at DESC
          LIMIT 1
        ) AS we ON true
        LEFT JOIN LATERAL (
          SELECT ex.finished_at AS last_success_at
          FROM operations.workflow_executions AS ex
          WHERE ex.client_id = wd.client_id
            AND ex.environment_id = wd.environment_id
            AND ex.workflow_definition_id = wd.id
            AND ex.outcome = 'success'
            AND ex.finished_at IS NOT NULL
          ORDER BY ex.finished_at DESC
          LIMIT 1
        ) AS ls ON true
        LEFT JOIN operations.workflow_executions AS ex
          ON ex.client_id = wd.client_id
          AND ex.environment_id = wd.environment_id
          AND ex.workflow_definition_id = wd.id
          AND ex.observed_at >= now() - ($1)::interval
        GROUP BY cl.client_key, en.environment_key, wd.workflow_key, wd.display_name,
          wd.trigger_kind, wd.schedule_expression, wd.schedule_timezone, wd.enabled,
          wd.completion_sla_seconds, wd.criticality, we.outcome, we.status,
          we.failure_category, we.observed_at, we.scheduled_for, we.started_at,
          we.finished_at, we.duration_ms, we.schedule_delay_ms, ls.last_success_at
        ORDER BY cl.client_key, en.environment_key, wd.workflow_key
      `,
      [interval],
    );

    const now = new Date();
    const workflows = catalogue.rows.map((row) => {
      const nextExpectedRun = nextCronRun(
        row.schedule_expression,
        now,
        row.schedule_timezone || 'Europe/Malta',
      );
      return {
        workflowKey: row.workflow_key,
        displayName: row.display_name,
        clientKey: row.client_key,
        environmentKey: row.environment_key,
        triggerKind: row.trigger_kind,
        scheduleExpression: row.schedule_expression,
        scheduleTimezone: row.schedule_timezone,
        enabled: row.enabled,
        completionSlaSeconds: row.completion_sla_seconds,
        criticality: row.criticality,
        latestExecution:
          row.observed_at === null
            ? null
            : {
                outcome: row.outcome,
                status: row.status,
                failureCategory: row.failure_category,
                observedAt: iso(row.observed_at),
                scheduledFor: iso(row.scheduled_for),
                startedAt: iso(row.started_at),
                finishedAt: iso(row.finished_at),
                durationMs: row.duration_ms,
                scheduleDelayMs: row.schedule_delay_ms,
              },
        lastSuccessAt: iso(row.last_success_at),
        nextExpectedRun,
        overdueState: this.computeOverdueState(row, nextExpectedRun, now),
        successPercent: percent(row.window_success, row.window_total),
        executionCount: row.window_total,
        window,
      };
    });

    return { workflows };
  }

  /**
   * Overdue state per Phase 0: compare the wall clock against the
   * completion SLA of the latest run (when one is still in flight or just
   * finished) or against the next scheduled run. null when the workflow has
   * no schedule and no executions to reason about.
   */
  private computeOverdueState(
    row: WorkflowCatalogueRow,
    nextExpectedRun: string | null,
    now: Date,
  ): 'on_time' | 'due' | 'overdue' | null {
    const slaMs = row.completion_sla_seconds
      ? row.completion_sla_seconds * 1000
      : null;
    const nowMs = now.getTime();

    if (row.observed_at !== null) {
      if (row.outcome === 'waiting' && row.finished_at === null) {
        const anchor = row.started_at ?? row.scheduled_for ?? row.observed_at;
        const elapsedMs = nowMs - anchor.getTime();
        if (slaMs === null) {
          return 'due';
        }
        return elapsedMs > slaMs ? 'overdue' : 'due';
      }
      if (row.finished_at !== null && slaMs !== null) {
        return nowMs - row.finished_at.getTime() > slaMs
          ? 'overdue'
          : 'on_time';
      }
      return 'on_time';
    }

    if (nextExpectedRun !== null) {
      const nextMs = Date.parse(nextExpectedRun);
      if (slaMs !== null && nowMs > nextMs + slaMs) {
        return 'overdue';
      }
      if (nowMs > nextMs) {
        return 'due';
      }
      return 'on_time';
    }

    return null;
  }

  async getWorkflowDetail(workflowKey: string): Promise<unknown> {
    const definitions = await this.data.query<WorkflowDetailRow>(
      `
        SELECT wd.id AS definition_id, wd.client_id, wd.environment_id,
               cl.client_key, en.environment_key, wd.workflow_key, wd.display_name,
               wd.trigger_kind, wd.schedule_expression, wd.schedule_timezone, wd.enabled,
               wd.completion_sla_seconds, wd.criticality
        FROM operations.workflow_definitions AS wd
        JOIN operations.clients AS cl ON cl.id = wd.client_id AND cl.state = 'active'
        JOIN operations.environments AS en
          ON en.client_id = wd.client_id AND en.id = wd.environment_id
        WHERE wd.workflow_key = $1
        ORDER BY cl.client_key, en.environment_key
      `,
      [workflowKey],
    );

    if (definitions.rows.length === 0) {
      return null;
    }

    const matches = await Promise.all(
      definitions.rows.map(async (definition) => {
        const [executions, success] = await Promise.all([
          this.data.query<ExecutionDetailRow>(
            `
              SELECT ex.execution_key, ex.outcome, ex.trigger_kind, ex.scheduled_for,
                     ex.started_at, ex.finished_at, ex.duration_ms, ex.schedule_delay_ms,
                     ex.failure_category, ex.status, ex.observed_at
              FROM operations.workflow_executions AS ex
              WHERE ex.client_id = $1
                AND ex.environment_id = $2
                AND ex.workflow_definition_id = $3
              ORDER BY ex.observed_at DESC
              LIMIT 50
            `,
            [
              definition.client_id,
              definition.environment_id,
              definition.definition_id,
            ],
          ),
          this.data.query<WorkflowDetailSuccessRow>(
            `
              SELECT
                COUNT(*) FILTER (WHERE ex.observed_at >= now() - interval '24 hours')::int AS total_24h,
                COUNT(*) FILTER (WHERE ex.observed_at >= now() - interval '24 hours' AND ex.outcome = 'success')::int AS success_24h,
                COUNT(*) FILTER (WHERE ex.observed_at >= now() - interval '7 days')::int AS total_7d,
                COUNT(*) FILTER (WHERE ex.observed_at >= now() - interval '7 days' AND ex.outcome = 'success')::int AS success_7d,
                COUNT(*) FILTER (WHERE ex.observed_at >= now() - interval '30 days')::int AS total_30d,
                COUNT(*) FILTER (WHERE ex.observed_at >= now() - interval '30 days' AND ex.outcome = 'success')::int AS success_30d
              FROM operations.workflow_executions AS ex
              WHERE ex.client_id = $1
                AND ex.environment_id = $2
                AND ex.workflow_definition_id = $3
            `,
            [
              definition.client_id,
              definition.environment_id,
              definition.definition_id,
            ],
          ),
        ]);

        const successRow = success.rows[0];
        return {
          clientKey: definition.client_key,
          environmentKey: definition.environment_key,
          definition: {
            workflowKey: definition.workflow_key,
            displayName: definition.display_name,
            triggerKind: definition.trigger_kind,
            scheduleExpression: definition.schedule_expression,
            scheduleTimezone: definition.schedule_timezone,
            enabled: definition.enabled,
            completionSlaSeconds: definition.completion_sla_seconds,
            criticality: definition.criticality,
          },
          executions: executions.rows.map((execution) => ({
            executionKey: execution.execution_key,
            outcome: execution.outcome,
            triggerKind: execution.trigger_kind,
            scheduledFor: iso(execution.scheduled_for),
            startedAt: iso(execution.started_at),
            finishedAt: iso(execution.finished_at),
            durationMs: execution.duration_ms,
            scheduleDelayMs: execution.schedule_delay_ms,
            failureCategory: execution.failure_category,
            status: execution.status,
            observedAt: iso(execution.observed_at),
          })),
          successPercent: {
            '24h': percent(successRow?.success_24h, successRow?.total_24h),
            '7d': percent(successRow?.success_7d, successRow?.total_7d),
            '30d': percent(successRow?.success_30d, successRow?.total_30d),
          },
        };
      }),
    );

    return matches.length === 1 ? matches[0] : matches;
  }

  async getInfrastructure(): Promise<unknown> {
    const [
      endpointRows,
      latestRows,
      endpointSeriesRows,
      metricCatalogueRows,
      metricSampleRows,
    ] = await Promise.all([
      this.data.query<InfrastructureEndpointRow>(`
          SELECT cl.client_key, en.environment_key, ep.endpoint_key, ep.display_name,
                 d.domain_name
          FROM operations.endpoints AS ep
          JOIN operations.clients AS cl ON cl.id = ep.client_id AND cl.state = 'active'
          JOIN operations.environments AS en
            ON en.client_id = ep.client_id AND en.id = ep.environment_id
          LEFT JOIN operations.domains AS d
            ON d.client_id = ep.client_id AND d.id = ep.domain_id
          ORDER BY cl.client_key, en.environment_key, ep.endpoint_key
        `),
      this.data.query<InfrastructureEndpointLatestRow>(`
          SELECT cl.client_key, en.environment_key, ep.endpoint_key,
                 latest.checked_at, latest.available, latest.http_status, latest.response_time_ms
          FROM operations.endpoints AS ep
          JOIN operations.clients AS cl ON cl.id = ep.client_id AND cl.state = 'active'
          JOIN operations.environments AS en
            ON en.client_id = ep.client_id AND en.id = ep.environment_id
          LEFT JOIN LATERAL (
            SELECT eo.checked_at, eo.available, eo.http_status, eo.response_time_ms
            FROM operations.endpoint_observations AS eo
            WHERE eo.client_id = ep.client_id AND eo.endpoint_id = ep.id
            ORDER BY eo.checked_at DESC
            LIMIT 1
          ) AS latest ON true
        `),
      this.data.query<InfrastructureEndpointSeriesRow>(`
          SELECT cl.client_key, en.environment_key, ep.endpoint_key,
                 eo.checked_at, eo.available, eo.response_time_ms
          FROM operations.endpoints AS ep
          JOIN operations.clients AS cl ON cl.id = ep.client_id AND cl.state = 'active'
          JOIN operations.environments AS en
            ON en.client_id = ep.client_id AND en.id = ep.environment_id
          JOIN operations.endpoint_observations AS eo
            ON eo.client_id = ep.client_id AND eo.endpoint_id = ep.id
          WHERE eo.checked_at >= now() - interval '24 hours'
          ORDER BY cl.client_key, en.environment_key, ep.endpoint_key, eo.checked_at
        `),
      this.data.query<InfrastructureMetricCatalogueRow>(`
          SELECT DISTINCT md.metric_key
          FROM operations.metric_definitions AS md
          JOIN operations.clients AS cl ON cl.id = md.client_id AND cl.state = 'active'
          WHERE md.metric_key LIKE 'postgresql.%'
          ORDER BY md.metric_key
        `),
      this.data.query<InfrastructureMetricSampleRow>(`
          SELECT md.metric_key, en.environment_key,
                 ms.value_number::float8 AS value_number, ms.value_boolean,
                 ms.unit, ms.observed_at
          FROM operations.metric_samples AS ms
          JOIN operations.metric_definitions AS md
            ON md.client_id = ms.client_id AND md.id = ms.metric_definition_id
          JOIN operations.clients AS cl ON cl.id = ms.client_id AND cl.state = 'active'
          LEFT JOIN operations.environments AS en
            ON en.client_id = ms.client_id AND en.id = ms.environment_id
          WHERE md.metric_key LIKE 'postgresql.%'
            AND ms.observed_at >= now() - interval '24 hours'
          ORDER BY md.metric_key, ms.observed_at
        `),
    ]);

    const endpointKey = (row: {
      client_key: string;
      environment_key: string;
      endpoint_key: string;
    }): string =>
      compositeKey(row.client_key, row.environment_key, row.endpoint_key);

    const latestByEndpoint = new Map<string, InfrastructureEndpointLatestRow>();
    for (const row of latestRows.rows) {
      if (row.checked_at !== null) {
        latestByEndpoint.set(endpointKey(row), row);
      }
    }

    const seriesByEndpoint = new Map<
      string,
      InfrastructureEndpointSeriesRow[]
    >();
    for (const row of endpointSeriesRows.rows) {
      const key = endpointKey(row);
      const list = seriesByEndpoint.get(key);
      if (list) {
        list.push(row);
      } else {
        seriesByEndpoint.set(key, [row]);
      }
    }

    const endpoints = endpointRows.rows.map((endpoint) => {
      const key = endpointKey(endpoint);
      const latest = latestByEndpoint.get(key) ?? null;
      const series = seriesByEndpoint.get(key) ?? [];
      return {
        endpointKey: endpoint.endpoint_key,
        displayLabel: endpoint.display_name,
        environmentKey: endpoint.environment_key,
        urlHost: endpoint.domain_name,
        latest:
          latest === null
            ? null
            : {
                availability: latest.available ? 'up' : 'down',
                httpStatus: latest.http_status,
                responseTimeMs: latest.response_time_ms,
                checkedAt: iso(latest.checked_at),
                status: deriveEndpointStatus(
                  latest.available,
                  latest.http_status,
                  latest.response_time_ms,
                ),
              },
        series24h: series.map((sample) => ({
          checkedAt: iso(sample.checked_at),
          availability: sample.available ? 'up' : 'down',
          responseTimeMs: sample.response_time_ms,
        })),
      };
    });

    // Database card: every catalogue key appears in the rollup (null when it
    // has no samples in the window); series are the last 24h per key.
    const rollupMetrics: Record<
      string,
      { value: number | boolean | null; unit: string }
    > = {};
    const seriesByMetric: Record<
      string,
      { observedAt: string | null; value: number | boolean | null }[]
    > = {};
    for (const row of metricCatalogueRows.rows) {
      rollupMetrics[row.metric_key] = { value: null, unit: '' };
      seriesByMetric[row.metric_key] = [];
    }

    const latestSampleByMetric = new Map<
      string,
      InfrastructureMetricSampleRow
    >();
    for (const row of metricSampleRows.rows) {
      const series = seriesByMetric[row.metric_key];
      if (series) {
        series.push({
          observedAt: iso(row.observed_at),
          value: row.value_boolean ?? row.value_number,
        });
      }
      const current = latestSampleByMetric.get(row.metric_key);
      if (
        !current ||
        row.observed_at.getTime() > current.observed_at.getTime()
      ) {
        latestSampleByMetric.set(row.metric_key, row);
      }
    }

    const rollupValues: Record<string, number | boolean | null> = {};
    let databaseObservedAtMs: number | null = null;
    let databaseEnvironmentKey: string | null = null;
    for (const [metricKey, sample] of latestSampleByMetric) {
      rollupMetrics[metricKey] = {
        value: sample.value_boolean ?? sample.value_number,
        unit: sample.unit,
      };
      rollupValues[metricKey] = sample.value_boolean ?? sample.value_number;
      const atMs = sample.observed_at.getTime();
      if (databaseObservedAtMs === null || atMs > databaseObservedAtMs) {
        databaseObservedAtMs = atMs;
      }
      if (databaseEnvironmentKey === null && sample.environment_key) {
        databaseEnvironmentKey = sample.environment_key;
      }
    }

    const hasDatabaseEvidence = latestSampleByMetric.size > 0;

    return {
      generatedAt: new Date().toISOString(),
      endpoints,
      database: {
        environmentKey: databaseEnvironmentKey ?? 'production',
        latest: hasDatabaseEvidence
          ? {
              up:
                typeof rollupValues['postgresql.up'] === 'boolean'
                  ? rollupValues['postgresql.up']
                  : null,
              status: computeDatabaseRollupStatus(rollupValues),
              observedAt:
                databaseObservedAtMs === null
                  ? null
                  : new Date(databaseObservedAtMs).toISOString(),
              rollupMetrics,
            }
          : null,
        series: seriesByMetric,
      },
    };
  }
}
