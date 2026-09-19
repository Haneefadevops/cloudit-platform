import {
  compareDesiredState,
  DRIFT_CODE_ORDER,
  type DriftCode,
  type ManifestEntry,
  type Observation,
} from '../../src/canonicalization/drift';

const NOW = '2026-03-01T00:10:00.000Z';
const OBSERVED_AT = '2026-03-01T00:05:00.000Z';
const MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

const manifest: ManifestEntry = {
  workflowKey: 'wf-key-fake-001',
  expectedActive: true,
  triggerKind: 'cron',
  cron: '0 * * * *',
  timezone: 'Asia/Colombo',
  errorWorkflowRequired: true,
  canonicalHash: 'a'.repeat(64),
  revisionId: 'rev-fake-001',
  inCatalogue: true,
  expectsExecutions: true,
  requiresPortalEvidence: true,
};

function baseObservation(): Observation {
  return {
    observedAt: OBSERVED_AT,
    observerAvailable: true,
    found: true,
    active: true,
    trigger: { kind: 'cron', cron: '0 * * * *' },
    timezone: 'Asia/Colombo',
    errorWorkflow: { id: 'wf-test-errhandler-7777', name: 'Fake Error Handler' },
    canonicalHash: 'a'.repeat(64),
    revisionId: 'rev-fake-001',
    catalogueListed: true,
    lastExecutionAt: '2026-03-01T00:04:00.000Z',
    portalEvidence: { id: 'ev-fake-0001' },
  };
}

function compare(
  observation: Observation,
  manifestEntry: ManifestEntry | null = manifest,
  opts: { maxAgeMs?: number; now?: string } = {},
) {
  return compareDesiredState(manifestEntry, observation, {
    maxAgeMs: opts.maxAgeMs ?? MAX_AGE_MS,
    now: opts.now ?? NOW,
  });
}

describe('compareDesiredState', () => {
  it('returns MATCH with empty driftCodes for a fully matching observation', () => {
    expect(compare(baseObservation())).toEqual({ state: 'MATCH', driftCodes: [] });
  });

  it('emits drift codes in closed-catalogue order', () => {
    expect(DRIFT_CODE_ORDER).toHaveLength(13);
    const codes: DriftCode[] = [
      'workflow_missing',
      'unexpected_active_workflow',
      'active_state_mismatch',
      'published_revision_mismatch',
      'semantic_hash_mismatch',
      'schedule_mismatch',
      'timezone_mismatch',
      'error_workflow_detached',
      'catalogue_mismatch',
      'expected_execution_missing',
      'portal_evidence_missing',
      'observer_unavailable',
      'observation_stale',
    ];
    expect([...DRIFT_CODE_ORDER].sort()).toEqual([...codes].sort());
  });

  it('workflow_missing: workflow absent from the instance', () => {
    const observation = { ...baseObservation(), found: false };
    expect(compare(observation)).toEqual({ state: 'DRIFT', driftCodes: ['workflow_missing'] });
  });

  it('unexpected_active_workflow: active workflow not present in the manifest', () => {
    expect(compare(baseObservation(), null)).toEqual({
      state: 'DRIFT',
      driftCodes: ['unexpected_active_workflow'],
    });
  });

  it('active_state_mismatch: expected active but observed inactive', () => {
    const observation = { ...baseObservation(), active: false };
    expect(compare(observation)).toEqual({ state: 'DRIFT', driftCodes: ['active_state_mismatch'] });
  });

  it('published_revision_mismatch: observed revision differs from approved', () => {
    const observation = { ...baseObservation(), revisionId: 'rev-fake-OTHER' };
    expect(compare(observation)).toEqual({
      state: 'DRIFT',
      driftCodes: ['published_revision_mismatch'],
    });
  });

  it('semantic_hash_mismatch: observed canonical hash differs from approved', () => {
    const observation = { ...baseObservation(), canonicalHash: 'b'.repeat(64) };
    expect(compare(observation)).toEqual({
      state: 'DRIFT',
      driftCodes: ['semantic_hash_mismatch'],
    });
  });

  it('schedule_mismatch: observed cron differs from manifest cron', () => {
    const observation: Observation = {
      ...baseObservation(),
      trigger: { kind: 'cron', cron: '15 * * * *' },
    };
    expect(compare(observation)).toEqual({ state: 'DRIFT', driftCodes: ['schedule_mismatch'] });
  });

  it('schedule_mismatch: trigger kind changed', () => {
    const observation: Observation = {
      ...baseObservation(),
      trigger: { kind: 'webhook' },
    };
    expect(compare(observation)).toEqual({ state: 'DRIFT', driftCodes: ['schedule_mismatch'] });
  });

  it('timezone_mismatch: observed timezone differs from manifest', () => {
    const observation = { ...baseObservation(), timezone: 'UTC' };
    expect(compare(observation)).toEqual({ state: 'DRIFT', driftCodes: ['timezone_mismatch'] });
  });

  it('error_workflow_detached: required error workflow no longer attached', () => {
    const observation: Observation = { ...baseObservation(), errorWorkflow: { id: null } };
    expect(compare(observation)).toEqual({
      state: 'DRIFT',
      driftCodes: ['error_workflow_detached'],
    });
  });

  it('catalogue_mismatch: workflow missing from the approved catalogue', () => {
    const observation = { ...baseObservation(), catalogueListed: false };
    expect(compare(observation)).toEqual({ state: 'DRIFT', driftCodes: ['catalogue_mismatch'] });
  });

  it('expected_execution_missing: no execution observed although one is required', () => {
    const observation: Observation = { ...baseObservation(), lastExecutionAt: null };
    expect(compare(observation)).toEqual({
      state: 'DRIFT',
      driftCodes: ['expected_execution_missing'],
    });
  });

  it('portal_evidence_missing: required portal evidence absent', () => {
    const observation: Observation = { ...baseObservation(), portalEvidence: null };
    expect(compare(observation)).toEqual({
      state: 'DRIFT',
      driftCodes: ['portal_evidence_missing'],
    });
  });

  it('observer_unavailable: observer down takes precedence and drifts', () => {
    const observation = { ...baseObservation(), observerAvailable: false };
    expect(compare(observation)).toEqual({
      state: 'DRIFT',
      driftCodes: ['observer_unavailable'],
    });
  });

  it('observation_stale: stale observation yields UNKNOWN_STALE, never MATCH or DRIFT', () => {
    const staleObservation = { ...baseObservation(), observedAt: '2026-02-28T20:00:00.000Z' };
    expect(compare(staleObservation)).toEqual({
      state: 'UNKNOWN_STALE',
      driftCodes: ['observation_stale'],
    });
  });

  it('observation_stale: staleness hides otherwise-real drift', () => {
    const staleDrifted: Observation = {
      ...baseObservation(),
      observedAt: '2026-02-28T20:00:00.000Z',
      active: false,
      canonicalHash: 'b'.repeat(64),
    };
    expect(compare(staleDrifted)).toEqual({
      state: 'UNKNOWN_STALE',
      driftCodes: ['observation_stale'],
    });
  });

  it('observation_stale: an unparseable observedAt is treated as stale', () => {
    const observation = { ...baseObservation(), observedAt: 'not-a-timestamp' };
    expect(compare(observation)).toEqual({
      state: 'UNKNOWN_STALE',
      driftCodes: ['observation_stale'],
    });
  });

  it('fresh observation at the exact max-age boundary is not stale', () => {
    const observation = { ...baseObservation(), observedAt: '2026-03-01T00:00:00.000Z' }; // 10 min old == maxAge
    expect(compare(observation, manifest, { maxAgeMs: 10 * 60 * 1000 })).toEqual({
      state: 'MATCH',
      driftCodes: [],
    });
  });

  it('manifest-less workflow observed inactive is not drift', () => {
    const observation = { ...baseObservation(), active: false };
    expect(compare(observation, null)).toEqual({ state: 'MATCH', driftCodes: [] });
  });

  it('multiple simultaneous drifts are all reported in catalogue order', () => {
    const observation: Observation = {
      ...baseObservation(),
      active: false,
      timezone: 'UTC',
      trigger: { kind: 'cron', cron: '30 2 * * *' },
    };
    expect(compare(observation)).toEqual({
      state: 'DRIFT',
      driftCodes: ['active_state_mismatch', 'schedule_mismatch', 'timezone_mismatch'],
    });
  });
});
