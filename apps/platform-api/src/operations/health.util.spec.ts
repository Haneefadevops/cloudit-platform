import {
  computeBackupsRollupStatus,
  computeDatabaseRollupStatus,
  computeEnvironmentHealth,
  computeImagekitRollupStatus,
  computeVercelRollupStatus,
  deriveEndpointStatus,
} from './health.util';

const NOW = Date.parse('2025-06-01T12:00:00.000Z');
const STALE_MS = 45 * 60 * 1_000; // 45 minutes
const FRESH = NOW - 10 * 60 * 1_000; // 10 minutes ago
const STALE = NOW - 60 * 60 * 1_000; // 1 hour ago
// Phase 7 analytics windows
const ANALYTICS_STALE_MS = 24 * 60 * 60 * 1_000; // 24 hours
const TRAFFIC_STALE_MS = 48 * 60 * 60 * 1_000; // 48 hours

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

describe('deriveEndpointStatus', () => {
  it('marks a down endpoint RED', () => {
    expect(deriveEndpointStatus(false, 503, 120)).toBe('RED');
    expect(deriveEndpointStatus(false, null, null)).toBe('RED');
  });

  it('marks a 5xx endpoint AMBER when still available', () => {
    expect(deriveEndpointStatus(true, 503, 120)).toBe('AMBER');
    expect(deriveEndpointStatus(true, 200, 120)).toBe('GREEN');
  });

  it('marks a slow endpoint AMBER', () => {
    expect(deriveEndpointStatus(true, 200, 3001)).toBe('AMBER');
    expect(deriveEndpointStatus(true, 200, 3000)).toBe('GREEN');
  });

  it('treats missing status/timing data as GREEN when up', () => {
    expect(deriveEndpointStatus(true, null, null)).toBe('GREEN');
  });
});

describe('computeDatabaseRollupStatus', () => {
  it('is GREEN when everything is healthy', () => {
    expect(
      computeDatabaseRollupStatus({
        'postgresql.up': true,
        'postgresql.disk_usage_percent': 40,
        'postgresql.memory_usage_percent': 60,
        'postgresql.pgbouncer_utilization_percent': 10,
        'postgresql.restart_count': 0,
        'postgresql.filesystem_read_only': false,
        'postgresql.oom_kill_count': 0,
      }),
    ).toBe('GREEN');
  });

  it('is RED when the database is down', () => {
    expect(computeDatabaseRollupStatus({ 'postgresql.up': false })).toBe('RED');
  });

  it('is RED on read-only filesystem or OOM kills', () => {
    expect(
      computeDatabaseRollupStatus({ 'postgresql.filesystem_read_only': true }),
    ).toBe('RED');
    expect(
      computeDatabaseRollupStatus({ 'postgresql.oom_kill_count': 2 }),
    ).toBe('RED');
  });

  it('is AMBER at the disk/memory/pgbouncer/restart thresholds', () => {
    expect(
      computeDatabaseRollupStatus({ 'postgresql.disk_usage_percent': 85 }),
    ).toBe('AMBER');
    expect(
      computeDatabaseRollupStatus({ 'postgresql.memory_usage_percent': 90 }),
    ).toBe('AMBER');
    expect(
      computeDatabaseRollupStatus({
        'postgresql.pgbouncer_utilization_percent': 80,
      }),
    ).toBe('AMBER');
    expect(computeDatabaseRollupStatus({ 'postgresql.restart_count': 1 })).toBe(
      'AMBER',
    );
  });

  it('is GREEN with no data at all (zero rows handled upstream)', () => {
    expect(computeDatabaseRollupStatus({})).toBe('GREEN');
  });

  it('ignores null values', () => {
    expect(
      computeDatabaseRollupStatus({
        'postgresql.up': null,
        'postgresql.disk_usage_percent': null,
      }),
    ).toBe('GREEN');
  });
});

describe('computeVercelRollupStatus', () => {
  const base = {
    connectivityReachable: null,
    hasConnectivity: false,
    webAnalyticsReachable: null,
    currentDeploymentState: null,
    hasUnverifiedDomain: false,
    hasTraffic: false,
    lastTrafficAtMs: null,
    hasDeployments: false,
    anyRecentDeploymentFailed: false,
  };

  it('is NO_DATA with no traffic, no deployments and no connectivity', () => {
    expect(computeVercelRollupStatus(base, NOW, TRAFFIC_STALE_MS)).toBe(
      'NO_DATA',
    );
  });

  it('is RED when connectivity is unreachable', () => {
    expect(
      computeVercelRollupStatus(
        { ...base, connectivityReachable: false, hasConnectivity: true },
        NOW,
        TRAFFIC_STALE_MS,
      ),
    ).toBe('RED');
  });

  it('is RED when the current production deployment failed', () => {
    expect(
      computeVercelRollupStatus(
        {
          ...base,
          hasDeployments: true,
          currentDeploymentState: 'failed',
        },
        NOW,
        TRAFFIC_STALE_MS,
      ),
    ).toBe('RED');
  });

  it('RED (unreachable) wins over an unverified domain', () => {
    expect(
      computeVercelRollupStatus(
        {
          ...base,
          connectivityReachable: false,
          hasConnectivity: true,
          hasUnverifiedDomain: true,
          hasTraffic: true,
          lastTrafficAtMs: FRESH,
        },
        NOW,
        TRAFFIC_STALE_MS,
      ),
    ).toBe('RED');
  });

  it('is AMBER when an unverified domain exists', () => {
    expect(
      computeVercelRollupStatus(
        {
          ...base,
          hasConnectivity: true,
          hasUnverifiedDomain: true,
          hasTraffic: true,
          lastTrafficAtMs: FRESH,
        },
        NOW,
        TRAFFIC_STALE_MS,
      ),
    ).toBe('AMBER');
  });

  it('is AMBER when traffic exists but is older than 48h', () => {
    expect(
      computeVercelRollupStatus(
        {
          ...base,
          hasConnectivity: true,
          hasTraffic: true,
          lastTrafficAtMs: NOW - TRAFFIC_STALE_MS - 1,
        },
        NOW,
        TRAFFIC_STALE_MS,
      ),
    ).toBe('AMBER');
  });

  it('treats traffic exactly at the 48h boundary as fresh', () => {
    expect(
      computeVercelRollupStatus(
        {
          ...base,
          hasConnectivity: true,
          hasTraffic: true,
          lastTrafficAtMs: NOW - TRAFFIC_STALE_MS,
        },
        NOW,
        TRAFFIC_STALE_MS,
      ),
    ).toBe('GREEN');
  });

  it('is AMBER when any recent deployment failed', () => {
    expect(
      computeVercelRollupStatus(
        {
          ...base,
          hasConnectivity: true,
          hasDeployments: true,
          currentDeploymentState: 'ready',
          anyRecentDeploymentFailed: true,
        },
        NOW,
        TRAFFIC_STALE_MS,
      ),
    ).toBe('AMBER');
  });

  it('is GREEN with fresh traffic, ready deployments and connectivity', () => {
    expect(
      computeVercelRollupStatus(
        {
          ...base,
          connectivityReachable: true,
          hasConnectivity: true,
          currentDeploymentState: 'ready',
          hasTraffic: true,
          lastTrafficAtMs: FRESH,
          hasDeployments: true,
        },
        NOW,
        TRAFFIC_STALE_MS,
      ),
    ).toBe('GREEN');
  });

  it('is GREEN with connectivity evidence only', () => {
    expect(
      computeVercelRollupStatus(
        { ...base, connectivityReachable: true, hasConnectivity: true },
        NOW,
        TRAFFIC_STALE_MS,
      ),
    ).toBe('GREEN');
  });

  it('is AMBER (not RED) when only the web-analytics connection is unreachable', () => {
    expect(
      computeVercelRollupStatus(
        {
          ...base,
          connectivityReachable: true,
          hasConnectivity: true,
          webAnalyticsReachable: false,
          currentDeploymentState: 'ready',
          hasDeployments: true,
        },
        NOW,
        TRAFFIC_STALE_MS,
      ),
    ).toBe('AMBER');
  });

  it('is RED when the rest-api connection is unreachable, regardless of web-analytics', () => {
    expect(
      computeVercelRollupStatus(
        {
          ...base,
          connectivityReachable: false,
          hasConnectivity: true,
          webAnalyticsReachable: true,
          currentDeploymentState: 'ready',
          hasDeployments: true,
        },
        NOW,
        TRAFFIC_STALE_MS,
      ),
    ).toBe('RED');
  });
});

describe('computeImagekitRollupStatus', () => {
  const base = {
    connectivityReachable: null,
    utilizationPercent: null,
    hasSamples: false,
    newestSampleAtMs: null,
  };

  it('is NO_DATA when no samples exist at all', () => {
    expect(computeImagekitRollupStatus(base, NOW, ANALYTICS_STALE_MS)).toBe(
      'NO_DATA',
    );
  });

  it('is RED when connectivity is unreachable, even without samples', () => {
    expect(
      computeImagekitRollupStatus(
        { ...base, connectivityReachable: false },
        NOW,
        ANALYTICS_STALE_MS,
      ),
    ).toBe('RED');
  });

  it('is AMBER at 80 percent utilization', () => {
    expect(
      computeImagekitRollupStatus(
        {
          ...base,
          utilizationPercent: 80,
          hasSamples: true,
          newestSampleAtMs: FRESH,
        },
        NOW,
        ANALYTICS_STALE_MS,
      ),
    ).toBe('AMBER');
  });

  it('is GREEN below 80 percent utilization with fresh evidence', () => {
    expect(
      computeImagekitRollupStatus(
        {
          ...base,
          utilizationPercent: 79.9,
          hasSamples: true,
          newestSampleAtMs: FRESH,
        },
        NOW,
        ANALYTICS_STALE_MS,
      ),
    ).toBe('GREEN');
  });

  it('is AMBER when the newest sample is older than 24h', () => {
    expect(
      computeImagekitRollupStatus(
        {
          ...base,
          hasSamples: true,
          newestSampleAtMs: NOW - ANALYTICS_STALE_MS - 1,
        },
        NOW,
        ANALYTICS_STALE_MS,
      ),
    ).toBe('AMBER');
  });

  it('treats a sample exactly at the 24h boundary as fresh', () => {
    expect(
      computeImagekitRollupStatus(
        {
          ...base,
          hasSamples: true,
          newestSampleAtMs: NOW - ANALYTICS_STALE_MS,
        },
        NOW,
        ANALYTICS_STALE_MS,
      ),
    ).toBe('GREEN');
  });

  it('is GREEN with fresh samples and reachable connectivity', () => {
    expect(
      computeImagekitRollupStatus(
        {
          ...base,
          connectivityReachable: true,
          hasSamples: true,
          newestSampleAtMs: FRESH,
        },
        NOW,
        ANALYTICS_STALE_MS,
      ),
    ).toBe('GREEN');
  });
});

describe('computeBackupsRollupStatus', () => {
  const HOURS_MS = 60 * 60 * 1_000;
  const DAYS_MS = 24 * HOURS_MS;
  const NOW_JUNE_1_NOON = Date.parse('2025-06-01T12:00:00.000Z'); // 12h into the UTC month
  // Past the 36h monthly grace window that starts at June 1 00:00 UTC.
  const NOW_JUNE_2_AFTER_GRACE = Date.parse('2025-06-02T13:00:00.000Z');

  const base = {
    hasEvidence: true,
    latestBackupFailed: false,
    lastSuccessAtMs: NOW_JUNE_1_NOON - 10 * HOURS_MS, // 10h ago, within 28h
    expectedNextRunAtMs: NOW_JUNE_1_NOON - 30 * 60 * 1_000, // expected 30 min ago
    restoreTestFailed: false,
    lastRestoreTestAtMs: NOW_JUNE_1_NOON - 2 * DAYS_MS, // 2 days ago
    monthlyCopyPresent: true,
  };

  it('is NO_DATA with no reasons when there is no backup evidence at all', () => {
    expect(
      computeBackupsRollupStatus(
        { ...base, hasEvidence: false },
        NOW_JUNE_1_NOON,
      ),
    ).toEqual({ level: 'NO_DATA', reasons: [] });
  });

  it('is RED when the latest daily backup failed', () => {
    const health = computeBackupsRollupStatus(
      { ...base, latestBackupFailed: true },
      NOW_JUNE_1_NOON,
    );
    expect(health.level).toBe('RED');
    expect(health.reasons.join(' ')).toMatch(/Latest daily backup failed/);
  });

  it('is RED when the latest restore test failed', () => {
    const health = computeBackupsRollupStatus(
      { ...base, restoreTestFailed: true },
      NOW_JUNE_1_NOON,
    );
    expect(health.level).toBe('RED');
    expect(health.reasons.join(' ')).toMatch(/restore test failed/);
  });

  it('is RED when no successful backup has ever been observed', () => {
    const health = computeBackupsRollupStatus(
      { ...base, lastSuccessAtMs: null },
      NOW_JUNE_1_NOON,
    );
    expect(health.level).toBe('RED');
    expect(health.reasons.join(' ')).toMatch(
      /No successful backup has ever been observed/,
    );
  });

  it('is RED when the newest success is older than 28 hours', () => {
    const health = computeBackupsRollupStatus(
      { ...base, lastSuccessAtMs: NOW_JUNE_1_NOON - 28 * HOURS_MS - 1 },
      NOW_JUNE_1_NOON,
    );
    expect(health.level).toBe('RED');
    expect(health.reasons.join(' ')).toMatch(/within the last 28 hours/);
  });

  it('treats a success exactly at the 28h boundary as within the window', () => {
    const health = computeBackupsRollupStatus(
      { ...base, lastSuccessAtMs: NOW_JUNE_1_NOON - 28 * HOURS_MS },
      NOW_JUNE_1_NOON,
    );
    expect(health.level).not.toBe('RED');
    expect(health.reasons.join(' ')).not.toMatch(/28 hours/);
  });

  it('is GREEN when the success is within 28h and nothing else is wrong', () => {
    expect(computeBackupsRollupStatus(base, NOW_JUNE_1_NOON)).toEqual({
      level: 'GREEN',
      reasons: [],
    });
  });

  it('is AMBER when the expected run is more than 30 minutes overdue', () => {
    const health = computeBackupsRollupStatus(
      {
        ...base,
        expectedNextRunAtMs: NOW_JUNE_1_NOON - 30 * 60 * 1_000 - 1,
      },
      NOW_JUNE_1_NOON,
    );
    expect(health.level).toBe('AMBER');
    expect(health.reasons.join(' ')).toMatch(/overdue more than 30 minutes/);
  });

  it('treats the expected run exactly at the 30-minute overdue boundary as on time', () => {
    const health = computeBackupsRollupStatus(
      {
        ...base,
        expectedNextRunAtMs: NOW_JUNE_1_NOON - 30 * 60 * 1_000,
      },
      NOW_JUNE_1_NOON,
    );
    expect(health.level).toBe('GREEN');
  });

  it('does not flag overdue when no expected run time is known', () => {
    const health = computeBackupsRollupStatus(
      { ...base, expectedNextRunAtMs: null },
      NOW_JUNE_1_NOON,
    );
    expect(health.level).toBe('GREEN');
  });

  it('is AMBER when no restore test has ever been observed', () => {
    const health = computeBackupsRollupStatus(
      { ...base, lastRestoreTestAtMs: null },
      NOW_JUNE_1_NOON,
    );
    expect(health.level).toBe('AMBER');
    expect(health.reasons.join(' ')).toMatch(
      /No restore test evidence has ever been observed/,
    );
  });

  it('is AMBER when the latest restore test is older than 32 days', () => {
    const health = computeBackupsRollupStatus(
      { ...base, lastRestoreTestAtMs: NOW_JUNE_1_NOON - 32 * DAYS_MS - 1 },
      NOW_JUNE_1_NOON,
    );
    expect(health.level).toBe('AMBER');
    expect(health.reasons.join(' ')).toMatch(/older than 32 days/);
  });

  it('treats a restore test exactly at the 32-day boundary as fresh', () => {
    const health = computeBackupsRollupStatus(
      { ...base, lastRestoreTestAtMs: NOW_JUNE_1_NOON - 32 * DAYS_MS },
      NOW_JUNE_1_NOON,
    );
    expect(health.level).toBe('GREEN');
  });

  it('is AMBER when the monthly copy is missing after the 36h grace window', () => {
    const health = computeBackupsRollupStatus(
      {
        ...base,
        lastSuccessAtMs: NOW_JUNE_2_AFTER_GRACE - 10 * HOURS_MS,
        expectedNextRunAtMs: NOW_JUNE_2_AFTER_GRACE - 30 * 60 * 1_000,
        lastRestoreTestAtMs: NOW_JUNE_2_AFTER_GRACE - 2 * DAYS_MS,
        monthlyCopyPresent: false,
      },
      NOW_JUNE_2_AFTER_GRACE,
    );
    expect(health.level).toBe('AMBER');
    expect(health.reasons.join(' ')).toMatch(/monthly-class backup/);
  });

  it('is GREEN when the monthly copy is missing but within the 36h grace window', () => {
    const health = computeBackupsRollupStatus(
      { ...base, monthlyCopyPresent: false },
      NOW_JUNE_1_NOON, // only 12h past the first day of the UTC month
    );
    expect(health.level).toBe('GREEN');
  });

  it('is GREEN after the grace window when the monthly copy is present', () => {
    const health = computeBackupsRollupStatus(
      {
        ...base,
        lastSuccessAtMs: NOW_JUNE_2_AFTER_GRACE - 10 * HOURS_MS,
        expectedNextRunAtMs: NOW_JUNE_2_AFTER_GRACE - 30 * 60 * 1_000,
        lastRestoreTestAtMs: NOW_JUNE_2_AFTER_GRACE - 2 * DAYS_MS,
      },
      NOW_JUNE_2_AFTER_GRACE,
    );
    expect(health.level).toBe('GREEN');
  });

  it('collects multiple AMBER reasons when several conditions hold', () => {
    const health = computeBackupsRollupStatus(
      {
        ...base,
        expectedNextRunAtMs: NOW_JUNE_1_NOON - 2 * HOURS_MS,
        lastRestoreTestAtMs: NOW_JUNE_1_NOON - 40 * DAYS_MS,
      },
      NOW_JUNE_1_NOON,
    );
    expect(health.level).toBe('AMBER');
    expect(health.reasons).toHaveLength(2);
  });

  it('lets RED win over AMBER conditions', () => {
    const health = computeBackupsRollupStatus(
      {
        ...base,
        latestBackupFailed: true,
        expectedNextRunAtMs: NOW_JUNE_1_NOON - 2 * HOURS_MS,
        lastRestoreTestAtMs: NOW_JUNE_1_NOON - 40 * DAYS_MS,
        monthlyCopyPresent: false,
      },
      NOW_JUNE_1_NOON,
    );
    expect(health.level).toBe('RED');
    expect(health.reasons).toHaveLength(1);
    expect(health.reasons.join(' ')).toMatch(/Latest daily backup failed/);
  });

  it('collects multiple RED reasons when both the backup failed and success is stale', () => {
    const health = computeBackupsRollupStatus(
      {
        ...base,
        latestBackupFailed: true,
        restoreTestFailed: true,
        lastSuccessAtMs: NOW_JUNE_1_NOON - 29 * HOURS_MS,
      },
      NOW_JUNE_1_NOON,
    );
    expect(health.level).toBe('RED');
    expect(health.reasons).toHaveLength(3);
  });
});
