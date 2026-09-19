import {
  canonicalHash,
  canonicalizeWorkflow,
  type ManifestEntry,
} from '@cloudit/operations-agent-contracts';
import type { LiveN8nWorkflowRecord } from '../../src/sync';

/**
 * Synthetic fixtures for the sync auditor tests. Everything is obviously
 * fake: synthetic hostnames, synthetic credential id/name canaries that
 * must never appear in emitted records, and a fixed reference clock.
 */

/** Fixed reference clock (epoch ms) — all scan timing is injected. */
export const SYNTHETIC_NOW_MS = 1_756_161_600_000; // 2025-12-25T10:00:00.000Z
export const FRESH_OBSERVED_AT = new Date(SYNTHETIC_NOW_MS - 60_000).toISOString();

/** Canary strings that must never leak into emitted records or audit events. */
export const SYNTHETIC_CREDENTIAL_ID = 'cred-synthetic-0001-canary';
export const SYNTHETIC_CREDENTIAL_NAME = 'SYNTHETIC header auth credential — CANARY DO NOT USE';
export const SYNTHETIC_EXECUTION_URL = 'https://n8n.synthetic.local/webhook/exec-canary-9f8e7d';
export const SYNTHETIC_WORKFLOW_NAME = 'SYNTHETIC Daily Report Workflow';

/** Deterministic injected clock. */
export class FixedClock {
  constructor(private readonly epochMs: number) {}

  now = (): number => this.epochMs;
}

/**
 * A sanitized-looking (but fully synthetic) raw n8n workflow export. It
 * deliberately includes volatile server fields, a credential identifier
 * canary and an execution URL canary so tests can prove the scan emits
 * none of them.
 */
export function buildSyntheticWorkflow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'wf-live-instance-999-synthetic',
    name: SYNTHETIC_WORKFLOW_NAME,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    versionId: 'v9-synthetic',
    active: true,
    nodes: [
      {
        id: 'node-schedule-1',
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        typeVersion: 1.2,
        position: [100, 100],
        parameters: {
          rule: { interval: [{ field: 'cron', expression: '0 6 * * *' }] },
          notice: 'SYNTHETIC UI hint that canonicalization drops',
        },
      },
      {
        id: 'node-http-2',
        name: 'HTTP Synthetic Collector',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4.2,
        position: [300, 100],
        parameters: {
          method: 'POST',
          url: 'https://ops-api.synthetic.local/internal/synthetic-report',
          options: { canaryUrl: SYNTHETIC_EXECUTION_URL },
        },
        credentials: {
          httpHeaderAuth: { id: SYNTHETIC_CREDENTIAL_ID, name: SYNTHETIC_CREDENTIAL_NAME },
        },
      },
    ],
    connections: {
      'Schedule Trigger': {
        main: [[{ node: 'HTTP Synthetic Collector', type: 'n8n-nodes-base.httpRequest', index: 0 }]],
      },
    },
    settings: {
      timezone: 'Europe/Malta',
      errorWorkflow: 'wf-error-handler-synthetic',
      executionOrder: 'v1',
    },
    staticData: { synthetic: true },
    pinData: {},
    tags: [{ name: 'synthetic' }],
    ...overrides,
  };
}

/** Approved manifest entry aligned with buildSyntheticWorkflow(). */
export function buildSyntheticManifestEntry(
  workflowKey: string,
  overrides: Partial<ManifestEntry> = {},
): ManifestEntry {
  return {
    workflowKey,
    expectedActive: true,
    triggerKind: 'cron',
    cron: '0 6 * * *',
    timezone: 'Europe/Malta',
    errorWorkflowRequired: true,
    canonicalHash: canonicalHash(canonicalizeWorkflow(buildSyntheticWorkflow())),
    inCatalogue: true,
    ...overrides,
  };
}

/** Live observation record aligned with buildSyntheticManifestEntry(). */
export function buildSyntheticLiveRecord(
  workflowKey: string,
  overrides: Partial<LiveN8nWorkflowRecord> = {},
): LiveN8nWorkflowRecord {
  return {
    workflowKey,
    found: true,
    active: true,
    trigger: { kind: 'cron', cron: '0 6 * * *' },
    timezone: 'Europe/Malta',
    errorWorkflow: { id: 'wf-error-handler-synthetic', name: 'SYNTHETIC Error Handler' },
    rawWorkflow: buildSyntheticWorkflow(),
    ...overrides,
  };
}
