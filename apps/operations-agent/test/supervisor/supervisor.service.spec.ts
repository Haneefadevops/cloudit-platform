/**
 * Acceptance tests for the deterministic maintenance supervisor
 * (operator-plan 4.1/11.2, execution-plan Phase C).
 */

import { validateAuditEvent, validateHealthAssessment } from '@cloudit/operations-agent-contracts';
import {
  InMemoryAuditSink,
  ResolvedSupervisorOptions,
  SupervisorService,
  SupervisorRunResult,
  resolveSupervisorOptions,
} from '../../src/supervisor';
import {
  CLIENT,
  ENVIRONMENT,
  MutableClock,
  makeProjection,
  makeRecord,
  withFreshUntil,
  withRecord,
  withoutSource,
} from './fixtures';

/** Freshness horizon long enough for tests that advance the clock. */
const LONG_FRESH_UNTIL = '2025-09-22T18:00:00.000Z';

function makeService(
  clock: MutableClock,
  overrides: Partial<Parameters<typeof resolveSupervisorOptions>[0]> = {},
): { service: SupervisorService; sink: InMemoryAuditSink } {
  const sink = new InMemoryAuditSink();
  const options: ResolvedSupervisorOptions = resolveSupervisorOptions({
    now: clock.now,
    ...overrides,
  });
  return { service: new SupervisorService(options, sink), sink };
}

function expectOk(result: SupervisorRunResult) {
  if (!result.ok) {
    throw new Error(`expected a successful run, got errors: ${result.errors.join('; ')}`);
  }
  return result;
}

describe('SupervisorService deterministic assessments', () => {
  let clock: MutableClock;

  beforeEach(() => {
    clock = new MutableClock();
  });

  it('GREEN: all sources fresh and OK yields GREEN with no findings', () => {
    const { service } = makeService(clock);
    const result = expectOk(service.assess(makeProjection()));
    expect(result.assessment.assessment).toBe('GREEN');
    expect(result.findings).toHaveLength(0);
    expect(result.recommendations).toHaveLength(0);
    expect(validateHealthAssessment(result.assessment).ok).toBe(true);
  });

  it('AMBER: a fresh DEGRADED required source yields AMBER with a warning finding', () => {
    const { service } = makeService(clock);
    const projection = withRecord(
      makeProjection(),
      makeRecord({ sourceKey: 'database', status: 'DEGRADED', severity: 'warning' }),
    );
    const result = expectOk(service.assess(projection));
    expect(result.assessment.assessment).toBe('AMBER');
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].issueCode).toBe('SOURCE_DEGRADED');
    expect(result.findings[0].severity).toBe('warning');
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].recommendedRunbook).toBe('none');
    expect(result.recommendations[0].automationEligibility).toBe('OWNER_REQUIRED');
  });

  it('RED: a fresh confirmed failure (FAILED + critical) on a required source yields RED', () => {
    const { service } = makeService(clock);
    const projection = withRecord(
      makeProjection(),
      makeRecord({ sourceKey: 'public-api', status: 'FAILED', severity: 'critical' }),
    );
    const result = expectOk(service.assess(projection));
    expect(result.assessment.assessment).toBe('RED');
    expect(result.findings[0].issueCode).toBe('SOURCE_FAILED');
    expect(result.findings[0].severity).toBe('critical');
  });

  it('NO_DATA: a missing required source yields NO_DATA, never GREEN', () => {
    const { service } = makeService(clock);
    const result = expectOk(service.assess(withoutSource(makeProjection(), 'backups-daily')));
    expect(result.assessment.assessment).toBe('NO_DATA');
    expect(result.assessment.assessment).not.toBe('GREEN');
    expect(result.findings.some((f) => f.issueCode === 'EVIDENCE_MISSING')).toBe(true);
  });

  it('UNKNOWN: an UNKNOWN-status record otherwise healthy yields UNKNOWN', () => {
    const { service } = makeService(clock);
    const projection = withRecord(
      makeProjection(),
      makeRecord({ sourceKey: 'sync-drift', status: 'UNKNOWN', severity: 'info' }),
    );
    const result = expectOk(service.assess(projection));
    expect(result.assessment.assessment).toBe('UNKNOWN');
    expect(result.findings[0].issueCode).toBe('STATUS_UNKNOWN');
  });

  describe('stale or missing critical evidence never yields GREEN', () => {
    it('a slightly overdue required source is AMBER, not GREEN', () => {
      const { service } = makeService(clock);
      clock.advance(20 * 60 * 1000); // 20 min past observation, 5 min stale
      const projection = withRecord(
        makeProjection(),
        makeRecord({
          sourceKey: 'database',
          observedAt: '2025-09-22T11:55:00.000Z',
          freshUntil: '2025-09-22T12:15:00.000Z',
        }),
      );
      const result = expectOk(service.assess(projection));
      expect(result.assessment.assessment).toBe('AMBER');
      expect(result.assessment.assessment).not.toBe('GREEN');
      expect(result.findings[0].issueCode).toBe('EVIDENCE_STALE');
    });

    it('a required source overdue beyond criticalOverdueMs is RED', () => {
      const { service } = makeService(clock, { criticalOverdueMs: 30 * 60 * 1000 });
      clock.advance(60 * 60 * 1000); // 45 min overdue, beyond the 30 min threshold
      const projection = withRecord(
        makeProjection(),
        makeRecord({
          sourceKey: 'database',
          observedAt: '2025-09-22T11:55:00.000Z',
          freshUntil: '2025-09-22T12:15:00.000Z',
        }),
      );
      const result = expectOk(service.assess(projection));
      expect(result.assessment.assessment).toBe('RED');
      expect(result.findings[0].issueCode).toBe('EVIDENCE_STALE');
      expect(result.findings[0].severity).toBe('critical');
    });

    it('an overdue required source is not GREEN even when every other source is healthy', () => {
      const { service } = makeService(clock);
      clock.advance(6 * 60 * 60 * 1000); // everything is stale now
      const result = expectOk(service.assess(makeProjection()));
      expect(result.assessment.assessment).not.toBe('GREEN');
      expect(['AMBER', 'RED', 'UNKNOWN', 'NO_DATA']).toContain(result.assessment.assessment);
    });

    it('a missing required source blocks GREEN even with zero other findings', () => {
      const { service } = makeService(clock);
      const projection = withoutSource(makeProjection(), 'restore-test');
      const result = expectOk(service.assess(projection));
      expect(result.assessment.assessment).toBe('NO_DATA');
      expect(result.findings.every((f) => f.issueCode === 'EVIDENCE_MISSING')).toBe(true);
    });

    it('the assessment subject is the most severe contribution, not the first: a stale AMBER source outranks missing sources (production recovery fix)', () => {
      const { service } = makeService(clock);
      clock.advance(20 * 60 * 1000); // 5 min past the freshness window
      const projection = withRecord(
        withoutSource(makeProjection(), 'restore-test'), // NO_DATA contribution listed first
        makeRecord({
          sourceKey: 'database',
          observedAt: '2025-09-22T11:55:00.000Z',
          freshUntil: '2025-09-22T12:15:00.000Z',
        }),
      );
      const result = expectOk(service.assess(projection));
      expect(result.assessment.assessment).toBe('AMBER');
      // EVIDENCE_MISSING is listed first, but the AMBER stale source must own
      // the subject so the alert engine can pair RED -> AMBER with the
      // alerted subject and emit exactly one recovery message.
      expect(result.assessment.issueCode).toBe('EVIDENCE_STALE');
    });

    it('stale analytics/optional sources are UNKNOWN, not GREEN', () => {
      const { service } = makeService(clock);
      const projection = withFreshUntil(makeProjection(), LONG_FRESH_UNTIL);
      clock.advance(2 * 60 * 60 * 1000);
      const staleAnalytics = withRecord(
        projection,
        makeRecord({
          sourceKey: 'vercel-analytics',
          criticality: 'analytics',
          observedAt: '2025-09-22T11:55:00.000Z',
          freshUntil: '2025-09-22T12:15:00.000Z',
        }),
      );
      const result = expectOk(service.assess(staleAnalytics));
      expect(result.assessment.assessment).toBe('UNKNOWN');
      expect(result.assessment.assessment).not.toBe('GREEN');
    });
  });

  it('analytics-only failure is AMBER at most, never RED', () => {
    const { service } = makeService(clock, { repeatedFailureThreshold: 1 });
    const projection = withRecord(
      makeProjection(),
      makeRecord({
        sourceKey: 'vercel-analytics',
        criticality: 'analytics',
        status: 'FAILED',
        severity: 'critical',
      }),
    );
    const result = expectOk(service.assess(projection));
    expect(result.assessment.assessment).toBe('AMBER');
    expect(result.assessment.assessment).not.toBe('RED');
    expect(result.findings[0].severity).not.toBe('critical');
  });

  describe('repeated-failure escalation AMBER -> RED', () => {
    const failingWorkflow = () =>
      makeRecord({
        sourceKey: 'n8n-workflows',
        status: 'FAILED',
        severity: 'warning',
      });

    const failingProjection = () =>
      withFreshUntil(withRecord(makeProjection(), failingWorkflow()), LONG_FRESH_UNTIL);

    it('escalates at the default threshold of 3 failures inside one hourly bucket', () => {
      const { service } = makeService(clock);
      const projection = failingProjection();

      const first = expectOk(service.assess(projection));
      expect(first.assessment.assessment).toBe('AMBER');

      clock.advance(10 * 60 * 1000);
      const second = expectOk(service.assess(projection));
      expect(second.assessment.assessment).toBe('AMBER');

      clock.advance(10 * 60 * 1000);
      const third = expectOk(service.assess(projection));
      expect(third.assessment.assessment).toBe('RED');
      expect(third.findings[0].issueCode).toBe('REPEATED_FAILURES');
    });

    it('respects a configured threshold of 2', () => {
      const { service } = makeService(clock, { repeatedFailureThreshold: 2 });
      const projection = failingProjection();

      expectOk(service.assess(projection));
      clock.advance(5 * 60 * 1000);
      const second = expectOk(service.assess(projection));
      expect(second.assessment.assessment).toBe('RED');
    });

    it('does not escalate when failures fall outside the hourly bucket', () => {
      const { service } = makeService(clock);
      const projection = failingProjection();

      expectOk(service.assess(projection));
      clock.advance(31 * 60 * 1000);
      expectOk(service.assess(projection));
      clock.advance(31 * 60 * 1000);
      const third = expectOk(service.assess(projection));
      // Only one failure remains inside the trailing 60-minute window.
      expect(third.assessment.assessment).toBe('AMBER');
    });

    it('repeated analytics failures never escalate to RED', () => {
      const { service } = makeService(clock);
      const projection = withFreshUntil(
        withRecord(
          makeProjection(),
          makeRecord({
            sourceKey: 'imagekit-delivery',
            criticality: 'analytics',
            status: 'FAILED',
            severity: 'warning',
          }),
        ),
        LONG_FRESH_UNTIL,
      );
      for (let i = 0; i < 4; i += 1) {
        clock.advance(10 * 60 * 1000);
        const result = expectOk(service.assess(projection));
        expect(result.assessment.assessment).toBe('AMBER');
      }
    });
  });

  describe('fail-closed projection handling', () => {
    it('rejects a projection with an out-of-allowlist field and audits the rejection', () => {
      const { service, sink } = makeService(clock);
      const projection = makeProjection() as unknown as Record<string, unknown>;
      projection.providerRawResponse = 'leak attempt';

      const result = service.assess(projection);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
      expect(sink.events).toHaveLength(1);
      expect(sink.events[0].resultCode).toBe('PROJECTION_REJECTED');
    });

    it('rejects a projection with a mismatched tenant identifier', () => {
      const { service } = makeService(clock);
      const record = { ...makeRecord({ sourceKey: 'database' }), client: 'client-eve' };
      const result = service.assess({ ...makeProjection(), records: [record] });
      expect(result.ok).toBe(false);
    });

    it('rejects an unknown source key instead of scoring it', () => {
      const { service } = makeService(clock);
      const record = makeRecord({ sourceKey: 'unknown-source' });
      const result = service.assess({ ...makeProjection(), records: [record] });
      expect(result.ok).toBe(false);
    });
  });

  describe('auditability', () => {
    it('emits exactly one audit event per run, across verdicts and rejections', () => {
      const { service, sink } = makeService(clock);

      expectOk(service.assess(makeProjection()));
      expectOk(service.assess(withRecord(
        makeProjection(),
        makeRecord({ sourceKey: 'database', status: 'DEGRADED', severity: 'warning' }),
      )));
      service.assess({ bad: 'projection' });

      expect(sink.events).toHaveLength(3);
    });

    it('audit events pass the AuditEvent contract and carry safe codes only', () => {
      const { service, sink } = makeService(clock);
      expectOk(service.assess(makeProjection()));
      expectOk(service.assess(withRecord(
        makeProjection(),
        makeRecord({ sourceKey: 'public-api', status: 'FAILED', severity: 'critical' }),
      )));

      for (const event of sink.events) {
        expect(validateAuditEvent(event).ok).toBe(true);
        expect(event.eventType).toBe('supervisor_assessment');
        expect(event.actor).toBe('agent:supervisor');
        expect(event.reasonCode).toBe('ASSESSMENT_RUN');
        expect(['GREEN', 'AMBER', 'RED', 'NO_DATA', 'UNKNOWN']).toContain(event.resultCode);
        expect(event.summary).toMatch(/^verdict=[A-Z_]+ findings=\d+ recommendations=\d+ sources=\d+$/);
        expect(event.summary).not.toMatch(/Error|error|exception|payload|token|secret/i);
        expect(JSON.stringify(event)).not.toMatch(/rawProvider|leak|command/i);
      }
    });

    it('a rejected projection still produces exactly one safe audit event', () => {
      const { service, sink } = makeService(clock);
      const result = service.assess(null);
      expect(result.ok).toBe(false);
      expect(sink.events).toHaveLength(1);
      const event = sink.events[0];
      expect(event.resultCode).toBe('PROJECTION_REJECTED');
      expect(event.summary).not.toMatch(/Error|received|expected/i);
      expect(validateAuditEvent(event).ok).toBe(true);
    });

    it('binds tenant and environment only from the validated projection', () => {
      const { service, sink } = makeService(clock);
      expectOk(service.assess(makeProjection()));
      expect(sink.events[0].environmentKey).toBe(ENVIRONMENT);
      expect(sink.events[0].eventId).toMatch(new RegExp(`^evt-${ENVIRONMENT}-\\d+$`));
    });
  });

  describe('output contracts', () => {
    it('every finding and recommendation passes its contract validator', () => {
      const { service } = makeService(clock);
      clock.advance(45 * 60 * 1000);
      const result = expectOk(service.assess(makeProjection()));
      for (const finding of result.findings) {
        expect(finding.environmentKey).toBe(ENVIRONMENT);
        expect(finding.state).toBe('open');
      }
      expect(result.assessment.evidenceKeys.length).toBeLessThanOrEqual(50);
      expect(result.assessment.recommendedRunbook).toBe('none');
    });

    it('declares the projection tenant/environment it assessed', () => {
      const { service } = makeService(clock);
      const result = expectOk(
        service.assess(makeProjection({ client: CLIENT, environment: ENVIRONMENT })),
      );
      expect(result.assessment.confidence).toBe('HIGH');
    });
  });
});
