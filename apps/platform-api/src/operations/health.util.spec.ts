import { computeEnvironmentHealth } from './health.util';

const NOW = Date.parse('2025-06-01T12:00:00.000Z');
const STALE_MS = 45 * 60 * 1_000; // 45 minutes
const FRESH = NOW - 10 * 60 * 1_000; // 10 minutes ago
const STALE = NOW - 60 * 60 * 1_000; // 1 hour ago

describe('computeEnvironmentHealth', () => {
  it('returns NO_DATA with no reasons when there are no executions', () => {
    expect(computeEnvironmentHealth([], null, NOW, STALE_MS)).toEqual({
      level: 'NO_DATA',
      reasons: [],
    });
  });

  it('returns GREEN when critical workflows succeed with fresh evidence', () => {
    const health = computeEnvironmentHealth(
      [
        { criticality: 'critical', outcome: 'success', status: 'GREEN' },
        { criticality: 'high', outcome: 'success', status: 'GREEN' },
        { criticality: 'standard', outcome: 'success', status: 'GREEN' },
      ],
      FRESH,
      NOW,
      STALE_MS,
    );
    expect(health.level).toBe('GREEN');
    expect(health.reasons).toEqual([]);
  });

  it('returns RED when the latest execution of a critical workflow failed', () => {
    const health = computeEnvironmentHealth(
      [
        { criticality: 'critical', outcome: 'failure', status: 'RED' },
        { criticality: 'standard', outcome: 'success', status: 'GREEN' },
      ],
      FRESH,
      NOW,
      STALE_MS,
    );
    expect(health.level).toBe('RED');
    expect(health.reasons).toHaveLength(1);
  });

  it('returns RED for a high-criticality workflow with status RED even on success outcome', () => {
    const health = computeEnvironmentHealth(
      [{ criticality: 'high', outcome: 'success', status: 'RED' }],
      FRESH,
      NOW,
      STALE_MS,
    );
    expect(health.level).toBe('RED');
  });

  it('returns AMBER when the latest execution of a non-critical workflow failed', () => {
    const health = computeEnvironmentHealth(
      [{ criticality: 'standard', outcome: 'failure', status: 'AMBER' }],
      FRESH,
      NOW,
      STALE_MS,
    );
    expect(health.level).toBe('AMBER');
    expect(health.reasons.join(' ')).toMatch(/non-critical/);
  });

  it('returns AMBER when the latest evidence is stale', () => {
    const health = computeEnvironmentHealth(
      [{ criticality: 'critical', outcome: 'success', status: 'GREEN' }],
      STALE,
      NOW,
      STALE_MS,
    );
    expect(health.level).toBe('AMBER');
    expect(health.reasons.join(' ')).toMatch(/Stale evidence/);
  });

  it('collects both AMBER reasons when stale and a non-critical failure coexist', () => {
    const health = computeEnvironmentHealth(
      [{ criticality: 'low', outcome: 'failure', status: 'AMBER' }],
      STALE,
      NOW,
      STALE_MS,
    );
    expect(health.level).toBe('AMBER');
    expect(health.reasons).toHaveLength(2);
  });

  it('treats a missing freshness timestamp as stale', () => {
    const health = computeEnvironmentHealth(
      [{ criticality: 'standard', outcome: 'success', status: 'GREEN' }],
      null,
      NOW,
      STALE_MS,
    );
    expect(health.level).toBe('AMBER');
  });

  it('treats evidence exactly at the freshness boundary as fresh', () => {
    const health = computeEnvironmentHealth(
      [{ criticality: 'standard', outcome: 'success', status: 'GREEN' }],
      NOW - STALE_MS,
      NOW,
      STALE_MS,
    );
    expect(health.level).toBe('GREEN');
  });
});
