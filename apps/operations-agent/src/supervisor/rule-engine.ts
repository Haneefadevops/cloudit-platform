/**
 * Deterministic rule engine (operator-plan sections 4.1 and 11.2). Pure
 * function: same projection + same options + same failure counts => same
 * findings, recommendations and verdict. No AI, no randomness, no wall clock
 * beyond the injected `now`.
 *
 * Core rules:
 *  - Missing or stale evidence is NEVER GREEN. A missing required source is
 *    NO_DATA; a stale required source is AMBER, or RED once overdue beyond
 *    `criticalOverdueMs`; stale optional/analytics sources are UNKNOWN.
 *  - A fresh confirmed failure (status FAILED, severity critical) on a
 *    required source is RED.
 *  - A fresh unconfirmed failure (status FAILED, severity below critical) on
 *    a required source is AMBER, escalating to RED once the same source has
 *    `repeatedFailureThreshold` fresh failures inside the rolling hourly
 *    bucket maintained by the service.
 *  - Analytics-only failure is AMBER at most, never RED for a live outage.
 *  - Overall verdict: RED if any current critical signal is RED; else AMBER
 *    for warnings; else NO_DATA for missing required sources; else UNKNOWN
 *    for unclassifiable evidence; else GREEN.
 */

import {
  Finding,
  HealthStatus,
  Recommendation,
  Severity,
} from '@cloudit/operations-agent-contracts';
import { EvidenceSourceRecord, SanitizedEvidenceProjection } from './evidence-projection';

export const ISSUE_CODES = [
  'EVIDENCE_MISSING',
  'EVIDENCE_STALE',
  'SOURCE_FAILED',
  'SOURCE_DEGRADED',
  'STATUS_UNKNOWN',
  'REPEATED_FAILURES',
] as const;
export type IssueCode = (typeof ISSUE_CODES)[number];

const SEVERITY_RANK: Record<Severity, number> = { none: 0, info: 1, warning: 2, critical: 3 };

function maxSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_RANK[b] > SEVERITY_RANK[a] ? b : a;
}

/**
 * Contribution severity: a RED contribution is always critical; anything
 * lower never inherits 'critical' from the record - in particular an
 * analytics-only failure stays at 'warning' at most (operator-plan 11.2).
 */
function contributionSeverity(
  level: ContributionLevel,
  mapped: Severity,
  recordSeverity: Severity,
): Severity {
  if (level === 'RED') return 'critical';
  const merged = maxSeverity(mapped, recordSeverity);
  return SEVERITY_RANK[merged] > SEVERITY_RANK.warning ? 'warning' : merged;
}

type ContributionLevel = 'RED' | 'AMBER' | 'UNKNOWN' | 'NO_DATA';

interface Contribution {
  level: ContributionLevel;
  issueCode: IssueCode;
  sourceKey: string;
  severity: Severity;
  observedAt: string;
}

export interface RuleEngineInput {
  projection: SanitizedEvidenceProjection;
  now: Date;
  requiredSourceKeys: ReadonlySet<string>;
  criticalOverdueMs: number;
  repeatedFailureThreshold: number;
  /** Fresh-failure counts per sourceKey inside the escalation window. */
  failureCounts: ReadonlyMap<string, number>;
}

export interface RuleEngineResult {
  verdict: HealthStatus;
  findings: Finding[];
  recommendations: Recommendation[];
  evidenceKeys: string[];
  issueCode: string;
  summary: string;
}

export function evaluateEvidence(input: RuleEngineInput): RuleEngineResult {
  const { projection, now } = input;
  const nowMs = now.getTime();
  const nowIso = now.toISOString();
  const contributions: Contribution[] = [];

  const seen = new Set(projection.records.map((r) => r.sourceKey));
  for (const sourceKey of input.requiredSourceKeys) {
    if (!seen.has(sourceKey)) {
      contributions.push({
        level: 'NO_DATA',
        issueCode: 'EVIDENCE_MISSING',
        sourceKey,
        severity: 'info',
        observedAt: nowIso,
      });
    }
  }

  for (const record of projection.records) {
    const contribution = classifyRecord(record, nowMs, input);
    if (contribution) contributions.push(contribution);
  }

  const findings = contributions.map((c) =>
    buildFinding(projection.environment, c, nowIso),
  );
  const recommendations = contributions
    .filter((c) => c.level === 'RED' || c.level === 'AMBER')
    .map((c) => buildRecommendation(projection.environment, c, nowIso));

  const verdict = deriveVerdict(contributions);
  const evidenceKeys = [...new Set(contributions.map((c) => c.sourceKey))].slice(0, 50);
  const firstRed = contributions.find((c) => c.level === 'RED');
  const issueCode = firstRed
    ? firstRed.issueCode
    : contributions.length > 0
      ? contributions[0].issueCode
      : 'NO_ISSUE';
  const summary =
    `verdict=${verdict} findings=${findings.length} recommendations=${recommendations.length} ` +
    `sources=${projection.records.length}`;

  return { verdict, findings, recommendations, evidenceKeys, issueCode, summary };
}

function classifyRecord(
  record: EvidenceSourceRecord,
  nowMs: number,
  input: RuleEngineInput,
): Contribution | undefined {
  const fresh = nowMs <= Date.parse(record.freshUntil);

  if (!fresh) {
    if (record.criticality === 'required') {
      const overdueMs = nowMs - Date.parse(record.freshUntil);
      const level: ContributionLevel =
        overdueMs >= input.criticalOverdueMs ? 'RED' : 'AMBER';
      return {
        level,
        issueCode: 'EVIDENCE_STALE',
        sourceKey: record.sourceKey,
        severity: contributionSeverity(level, 'warning', record.severity),
        observedAt: record.observedAt,
      };
    }
    return {
      level: 'UNKNOWN',
      issueCode: 'EVIDENCE_STALE',
      sourceKey: record.sourceKey,
      severity: contributionSeverity('UNKNOWN', 'info', record.severity),
      observedAt: record.observedAt,
    };
  }

  switch (record.status) {
    case 'OK':
      return undefined;
    case 'DEGRADED':
      return {
        level: 'AMBER',
        issueCode: 'SOURCE_DEGRADED',
        sourceKey: record.sourceKey,
        severity: contributionSeverity('AMBER', 'warning', record.severity),
        observedAt: record.observedAt,
      };
    case 'UNKNOWN':
      return {
        level: 'UNKNOWN',
        issueCode: 'STATUS_UNKNOWN',
        sourceKey: record.sourceKey,
        severity: contributionSeverity('UNKNOWN', 'info', record.severity),
        observedAt: record.observedAt,
      };
    case 'FAILED': {
      const failures = input.failureCounts.get(record.sourceKey) ?? 0;
      const escalated = failures >= input.repeatedFailureThreshold;
      if (record.criticality === 'required' && escalated) {
        return {
          level: 'RED',
          issueCode: 'REPEATED_FAILURES',
          sourceKey: record.sourceKey,
          severity: 'critical',
          observedAt: record.observedAt,
        };
      }
      if (record.criticality === 'required' && record.severity === 'critical') {
        return {
          level: 'RED',
          issueCode: 'SOURCE_FAILED',
          sourceKey: record.sourceKey,
          severity: 'critical',
          observedAt: record.observedAt,
        };
      }
      return {
        level: 'AMBER',
        issueCode: 'SOURCE_FAILED',
        sourceKey: record.sourceKey,
        severity: contributionSeverity('AMBER', 'warning', record.severity),
        observedAt: record.observedAt,
      };
    }
  }
}

function deriveVerdict(contributions: Contribution[]): HealthStatus {
  const levels = new Set(contributions.map((c) => c.level));
  if (levels.has('RED')) return 'RED';
  if (levels.has('AMBER')) return 'AMBER';
  if (levels.has('NO_DATA')) return 'NO_DATA';
  if (levels.has('UNKNOWN')) return 'UNKNOWN';
  return 'GREEN';
}

function buildFinding(environmentKey: string, c: Contribution, nowIso: string): Finding {
  return {
    findingId: `finding-${environmentKey}-${c.sourceKey}-${c.issueCode}`,
    environmentKey,
    issueCode: c.issueCode,
    severity: c.severity,
    state: 'open',
    summary:
      `Source "${c.sourceKey}" classified ${c.level} with issue code ${c.issueCode} by ` +
      'deterministic supervisor policy.',
    evidenceKeys: [c.sourceKey],
    firstSeenAt: c.observedAt,
    lastSeenAt: nowIso,
  };
}

function buildRecommendation(
  environmentKey: string,
  c: Contribution,
  nowIso: string,
): Recommendation {
  return {
    recommendationId: `rec-${environmentKey}-${c.sourceKey}-${c.issueCode}`,
    findingId: `finding-${environmentKey}-${c.sourceKey}-${c.issueCode}`,
    environmentKey,
    // The supervisor only ever recommends owner attention; it never selects
    // or approves a runbook.
    recommendedRunbook: 'none',
    automationEligibility: 'OWNER_REQUIRED',
    severity: c.severity,
    summary:
      `Investigate source "${c.sourceKey}" (${c.issueCode}); deterministic supervisor ` +
      'recommendation, owner action required.',
    evidenceKeys: [c.sourceKey],
    createdAt: nowIso,
  };
}
