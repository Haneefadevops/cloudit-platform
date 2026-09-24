import { SECRET_CANARY_FIXTURES } from '@cloudit/operations-agent-contracts';
import {
  buildAttemptAuditEvent,
  buildReadonlyRecheckGateSummary,
  buildReadonlyRecheckSummary,
  READONLY_RECHECK_ALLOWED_TARGETS,
  READONLY_RECHECK_RUNBOOK,
  READONLY_RECHECK_SUMMARY_MAX_CHARS,
} from '../../src/remediation/executor';

describe('attempt audit event', () => {
  it('is a closed, frozen event with canary-redacted evidence keys', () => {
    const event = buildAttemptAuditEvent(
      'EXECUTED',
      'RECOVERED',
      'vercel-analytics',
      '2026-11-02T12:00:00.000Z',
      buildReadonlyRecheckSummary('vercel-analytics', '2026-11-02', 'RECOVERED'),
    );
    expect(event.eventType).toBe('remediation_attempt');
    expect(event.actor).toBe('agent:remediation');
    expect(event.reasonCode).toBe('EXECUTED');
    expect(event.resultCode).toBe('RECOVERED');
    expect(event.evidenceKeys).toEqual(['vercel-analytics']);
    expect(event.summary.length).toBeLessThanOrEqual(200);
    expect(Object.isFrozen(event)).toBe(true);
  });

  it('redacts a canary-tripping target key in summary and evidenceKeys', () => {
    const canary = SECRET_CANARY_FIXTURES[0].value;
    const event = buildAttemptAuditEvent(
      'EXECUTED',
      'SOURCE_FAILED',
      canary,
      '2026-11-02T12:00:00.000Z',
      buildReadonlyRecheckSummary(canary, '2026-11-02', 'SOURCE_FAILED'),
    );
    expect(event.evidenceKeys).toEqual(['[redacted-by-security-policy]']);
    expect(event.summary).toContain('[redacted-by-security-policy]');
    expect(JSON.stringify(event)).not.toContain(canary);
  });
});

describe('readonly recheck runbook contract', () => {
  it('exposes the frozen closed enums fixed by the programme brief', () => {
    expect(READONLY_RECHECK_RUNBOOK.runbookKey).toBe('RB-READONLY-RECHECK-001');
    expect(READONLY_RECHECK_RUNBOOK.version).toBe('1');
    expect(READONLY_RECHECK_RUNBOOK.tier).toBe('A');
    expect(READONLY_RECHECK_RUNBOOK.acceptedIssueCodes).toEqual([
      'STATUS_UNKNOWN',
      'EVIDENCE_STALE',
    ]);
    expect([...READONLY_RECHECK_ALLOWED_TARGETS]).toEqual([
      'vercel-analytics',
      'imagekit-delivery',
    ]);
    expect(READONLY_RECHECK_RUNBOOK.expectedResultCodes).toEqual([
      'RECOVERED',
      'CONFIRMED_STALE',
      'SOURCE_FAILED',
    ]);
    expect(READONLY_RECHECK_RUNBOOK.maxAutomaticAttempts).toBe(1);
    expect(READONLY_RECHECK_RUNBOOK.timeoutMs).toBe(10_000);
    expect(READONLY_RECHECK_RUNBOOK.rollback).toContain(
      'No mutation was performed; rollback is a no-op.',
    );
    expect(Object.isFrozen(READONLY_RECHECK_RUNBOOK)).toBe(true);
  });

  it('summary templates stay within the 200-char bound for the longest closed inputs', () => {
    const target = 'imagekit-delivery';
    for (const resultCode of ['RECOVERED', 'CONFIRMED_STALE', 'SOURCE_FAILED', 'TIMED_OUT', 'INTERNAL_ERROR']) {
      const summary = buildReadonlyRecheckSummary(target, '2026-11-02', resultCode);
      expect(summary.length).toBeLessThanOrEqual(READONLY_RECHECK_SUMMARY_MAX_CHARS);
      expect(summary).toContain(`target=${target}`);
      expect(summary).toContain('day=2026-11-02');
    }
    expect(buildReadonlyRecheckGateSummary('KILL_SWITCH').length).toBeLessThanOrEqual(200);
  });
});
