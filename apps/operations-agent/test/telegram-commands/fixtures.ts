import type { CommandRequest } from '../../src/telegram/telegram.types';
import type {
  ReadOnlyEvidencePort,
  SafeFindingView,
  SafeIncidentView,
} from '../../src/telegram/commands';

/** Canary strings shaped like things that must never leak to Telegram. */
export const CANARY_URL = 'https://leak.example.com/internal/secret-path';
export const CANARY_EMAIL = 'operator@example.com';
export const CANARY_TOKEN = 'AKIAIOSFODNN7EXAMPLE';
export const CANARY_LONG_TOKEN = 'abcd1234abcd1234abcd1234';

export function makeRequest(command: string, args: string[] = []): CommandRequest {
  return {
    command,
    args,
    userId: 424242,
    chatId: 242424,
    correlationId: 'corr-test-001',
  };
}

function syntheticIncident(index: number): SafeIncidentView {
  const padded = String(index).padStart(4, '0');
  return {
    incidentKey: `INCIDENT-${padded}`,
    severity: index % 3 === 0 ? 'RED' : 'AMBER',
    serviceKey: `svc-synthetic-${padded}`,
    state: 'OPEN',
    startedAt: '2025-09-24T10:00:00.000Z',
  };
}

/**
 * Fixed, fully deterministic evidence port for command tests. Contains
 * canary-shaped values inside fields so sanitization can be asserted.
 */
export function createFixtureEvidencePort(): ReadOnlyEvidencePort {
  const incidents: SafeIncidentView[] = Array.from({ length: 12 }, (_, i) =>
    syntheticIncident(i + 1),
  );
  // One incident carries canary-shaped values to prove every command output
  // is sanitized, not only /explain.
  incidents[0] = {
    ...incidents[0],
    serviceKey: `svc-${CANARY_EMAIL}`,
    incidentKey: `INCIDENT-${CANARY_LONG_TOKEN}`,
  };

  return {
    getStatus: () => ({
      overall: 'AMBER',
      sourcesTotal: 7,
      sourcesRed: 1,
      sourcesAmber: 2,
      openIncidents: 12,
      generatedAt: '2025-09-25T12:00:00.000Z',
    }),
    listSources: () => [{ sourceKey: 'synthetic-source', category: 'AMBER' }],
    listIncidents: () => incidents.map((incident) => ({ ...incident })),
    getSyncSummary: () => ({
      state: 'SYNCED',
      driftCount: 1,
      staleCount: 2,
      scannedAt: '2025-09-25T12:00:00.000Z',
    }),
    getBudgetSummary: () => ({
      dayCallsUsed: 12,
      dayCallsMax: 500,
      monthEurUsed: '3.21',
      monthEurCeiling: 50,
    }),
    getFinding: (findingKey: string): SafeFindingView | undefined => {
      const findings: Record<string, SafeFindingView> = {
        'FINDING-AMBER-001': {
          findingKey: 'FINDING-AMBER-001',
          severity: 'AMBER',
          safeTitle: 'Synthetic drift in fixture workflow',
          safeSummary: 'Deterministic fixture summary; no real data present.',
          recommendedRunbook: 'RUNBOOK-SYN-001',
        },
        'FINDING-CANARY-002': {
          findingKey: 'FINDING-CANARY-002',
          severity: 'RED',
          safeTitle: `Canary title ${CANARY_URL}`,
          safeSummary: `Summary reaches ${CANARY_EMAIL} and token ${CANARY_TOKEN} plus ${CANARY_LONG_TOKEN}.`,
          recommendedRunbook: 'RUNBOOK-SYN-002',
        },
      };
      const found = findings[findingKey];
      return found ? { ...found } : undefined;
    },
  };
}

/** Port with one incident whose serviceKey is oversized, to exercise the cap. */
export function createOversizedEvidencePort(): ReadOnlyEvidencePort {
  const base = createFixtureEvidencePort();
  return {
    ...base,
    listIncidents: () => [
      {
        incidentKey: 'INCIDENT-BIG',
        severity: 'RED',
        serviceKey: `x${'y'.repeat(10_000)}`,
        state: 'OPEN',
        startedAt: '2025-09-24T10:00:00.000Z',
      },
    ],
  };
}
