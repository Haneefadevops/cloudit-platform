/**
 * Synthetic fixtures for the supervisor tests. All values are obviously fake;
 * no real tenant, environment, host or credential data appears here.
 */

import {
  DEFAULT_SOURCE_KEYS,
  EvidenceSourceRecord,
  SanitizedEvidenceProjection,
} from '../../src/supervisor';

export const FIXED_NOW = new Date('2025-09-22T12:00:00.000Z');
export const CLIENT = 'client-synthetic';
export const ENVIRONMENT = 'env-synthetic';

/** Mutable clock so tests control freshness and escalation windows exactly. */
export class MutableClock {
  constructor(private current: Date = new Date(FIXED_NOW.getTime())) {}

  /** Bound arrow so the clock can be handed to options without losing `this`. */
  readonly now = (): Date => new Date(this.current.getTime());

  advance(ms: number): void {
    this.current = new Date(this.current.getTime() + ms);
  }
}

const ANALYTICS_SOURCES = new Set(['vercel-analytics', 'imagekit-delivery', 'ai-budget']);
const OPTIONAL_SOURCES = new Set(['snapshot-coverage', 'maintenance-report']);

export function makeRecord(overrides: Partial<EvidenceSourceRecord> = {}): EvidenceSourceRecord {
  return {
    sourceKey: 'public-website',
    status: 'OK',
    severity: 'none',
    observedAt: '2025-09-22T11:55:00.000Z',
    freshUntil: '2025-09-22T12:15:00.000Z',
    criticality: 'required',
    safeSummary: 'Synthetic probe healthy.',
    counts: { probe_count: 1 },
    ...overrides,
  };
}

function criticalityFor(sourceKey: string): EvidenceSourceRecord['criticality'] {
  if (ANALYTICS_SOURCES.has(sourceKey)) return 'analytics';
  if (OPTIONAL_SOURCES.has(sourceKey)) return 'optional';
  return 'required';
}

/** One fresh OK record for every source in the default catalogue. */
export function allGreenRecords(): EvidenceSourceRecord[] {
  return DEFAULT_SOURCE_KEYS.map((sourceKey) =>
    makeRecord({ sourceKey, criticality: criticalityFor(sourceKey) }),
  );
}

export function makeProjection(
  overrides: Partial<SanitizedEvidenceProjection> = {},
): SanitizedEvidenceProjection {
  return {
    client: CLIENT,
    environment: ENVIRONMENT,
    records: allGreenRecords(),
    ...overrides,
  };
}

/** Replace the record for `sourceKey`, or append one if absent. */
export function withRecord(
  projection: SanitizedEvidenceProjection,
  record: EvidenceSourceRecord,
): SanitizedEvidenceProjection {
  const others = projection.records.filter((r) => r.sourceKey !== record.sourceKey);
  return { ...projection, records: [...others, record] };
}

export function withoutSource(
  projection: SanitizedEvidenceProjection,
  sourceKey: string,
): SanitizedEvidenceProjection {
  return {
    ...projection,
    records: projection.records.filter((r) => r.sourceKey !== sourceKey),
  };
}

/** Extend freshness on every record (tests that advance the clock). */
export function withFreshUntil(
  projection: SanitizedEvidenceProjection,
  freshUntil: string,
): SanitizedEvidenceProjection {
  return {
    ...projection,
    records: projection.records.map((r) => ({ ...r, freshUntil })),
  };
}
