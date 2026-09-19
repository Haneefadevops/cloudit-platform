/**
 * SupervisorService - the deterministic, read-only maintenance supervisor.
 *
 * Each assess() run:
 *   1. validates the incoming projection fail-closed (never throws on bad
 *      input; a rejected projection yields one audited failure result),
 *   2. updates the rolling repeated-failure window from fresh FAILED records,
 *   3. runs the deterministic rule engine (Finding[] + Recommendation[]),
 *   4. derives the overall HealthAssessment and validates it through the
 *      validateHealthAssessment contract before returning,
 *   5. emits exactly one AuditEvent through the AuditSink port.
 *
 * No AI, no tools, no repairs, no alerts, no network. Fail-closed end to end.
 */

import { Inject, Injectable } from '@nestjs/common';
import {
  AuditEvent,
  Finding,
  HealthAssessment,
  Recommendation,
  validateAuditEvent,
  validateFinding,
  validateHealthAssessment,
  validateRecommendation,
} from '@cloudit/operations-agent-contracts';
import { AUDIT_SINK, AuditSink } from './audit-sink';
import {
  SanitizedEvidenceProjection,
  validateEvidenceProjection,
} from './evidence-projection';
import { evaluateEvidence } from './rule-engine';
import { ResolvedSupervisorOptions, SUPERVISOR_OPTIONS } from './supervisor-options';

export const SUPERVISOR_ACTOR = 'agent:supervisor';
export const SUPERVISOR_EVENT_TYPE = 'supervisor_assessment';
export const REASON_ASSESSMENT_RUN = 'ASSESSMENT_RUN';
export const RESULT_PROJECTION_REJECTED = 'PROJECTION_REJECTED';
export const RESULT_INTERNAL_INVALID = 'ASSESSMENT_INVALID';

export type SupervisorRunResult =
  | {
      ok: true;
      assessment: HealthAssessment;
      findings: Finding[];
      recommendations: Recommendation[];
      auditEvent: AuditEvent;
    }
  | { ok: false; errors: string[]; auditEvent: AuditEvent };

@Injectable()
export class SupervisorService {
  /** Rolling window of fresh-failure timestamps per sourceKey. */
  private readonly failureWindow = new Map<string, number[]>();
  private auditSequence = 0;

  constructor(
    @Inject(SUPERVISOR_OPTIONS) private readonly options: ResolvedSupervisorOptions,
    @Inject(AUDIT_SINK) private readonly auditSink: AuditSink,
  ) {}

  /**
   * Assess one sanitized evidence projection. `input` is unknown on purpose:
   * the projection boundary is fail-closed and this method never throws.
   * Exactly one audit event is recorded per call.
   */
  assess(input: unknown): SupervisorRunResult {
    const now = this.options.now();
    const nowMs = now.getTime();

    const validated = validateEvidenceProjection(input, this.options.knownSourceKeys);
    if (!validated.ok) {
      const auditEvent = this.buildAndRecordAudit(now, 'env-unknown', {
        reasonCode: REASON_ASSESSMENT_RUN,
        resultCode: RESULT_PROJECTION_REJECTED,
        summary: `projection rejected: ${validated.errors.length} validation issue(s); no assessment produced`,
        evidenceKeys: [],
      });
      return { ok: false, errors: validated.errors, auditEvent };
    }

    const projection = validated.value;
    const failureCounts = this.updateFailureWindow(projection, nowMs);

    const engineResult = evaluateEvidence({
      projection,
      now,
      requiredSourceKeys: this.options.requiredSourceKeys,
      criticalOverdueMs: this.options.criticalOverdueMs,
      repeatedFailureThreshold: this.options.repeatedFailureThreshold,
      failureCounts,
    });

    const contractErrors: string[] = [];
    for (const finding of engineResult.findings) {
      if (!validateFinding(finding).ok) contractErrors.push(`finding ${finding.findingId}`);
    }
    for (const recommendation of engineResult.recommendations) {
      if (!validateRecommendation(recommendation).ok) {
        contractErrors.push(`recommendation ${recommendation.recommendationId}`);
      }
    }

    const assessment: HealthAssessment = {
      assessment: engineResult.verdict,
      summary: engineResult.summary,
      evidenceKeys: engineResult.evidenceKeys,
      confidence: 'HIGH',
      issueCode: engineResult.issueCode,
      recommendedRunbook: 'none',
      automationEligibility:
        engineResult.findings.length > 0 ? 'OWNER_REQUIRED' : 'PROHIBITED',
    };

    if (contractErrors.length > 0 || !validateHealthAssessment(assessment).ok) {
      const auditEvent = this.buildAndRecordAudit(now, projection.environment, {
        reasonCode: REASON_ASSESSMENT_RUN,
        resultCode: RESULT_INTERNAL_INVALID,
        summary: `internal: generated output failed contract validation (${contractErrors.length} item(s)); no assessment produced`,
        evidenceKeys: [],
      });
      return { ok: false, errors: contractErrors, auditEvent };
    }

    const auditEvent = this.buildAndRecordAudit(now, projection.environment, {
      reasonCode: REASON_ASSESSMENT_RUN,
      resultCode: engineResult.verdict,
      summary: engineResult.summary,
      evidenceKeys: engineResult.evidenceKeys,
    });

    return {
      ok: true,
      assessment,
      findings: engineResult.findings,
      recommendations: engineResult.recommendations,
      auditEvent,
    };
  }

  private updateFailureWindow(
    projection: SanitizedEvidenceProjection,
    nowMs: number,
  ): ReadonlyMap<string, number> {
    const cutoff = nowMs - this.options.escalationWindowMs;
    const counts = new Map<string, number>();

    for (const [sourceKey, timestamps] of this.failureWindow) {
      const kept = timestamps.filter((ts) => ts >= cutoff);
      if (kept.length === 0) this.failureWindow.delete(sourceKey);
      else this.failureWindow.set(sourceKey, kept);
    }

    for (const record of projection.records) {
      const fresh = nowMs <= Date.parse(record.freshUntil);
      if (record.status !== 'FAILED' || !fresh) continue;
      const timestamps = this.failureWindow.get(record.sourceKey) ?? [];
      timestamps.push(nowMs);
      this.failureWindow.set(record.sourceKey, timestamps);
    }

    for (const [sourceKey, timestamps] of this.failureWindow) {
      counts.set(sourceKey, timestamps.length);
    }
    return counts;
  }

  private buildAndRecordAudit(
    now: Date,
    environmentKey: string,
    content: {
      reasonCode: string;
      resultCode: string;
      summary: string;
      evidenceKeys: string[];
    },
  ): AuditEvent {
    this.auditSequence += 1;
    const event: AuditEvent = {
      eventId: `evt-${environmentKey}-${this.auditSequence}`,
      environmentKey,
      eventType: SUPERVISOR_EVENT_TYPE,
      actor: SUPERVISOR_ACTOR,
      occurredAt: now.toISOString(),
      reasonCode: content.reasonCode,
      resultCode: content.resultCode,
      summary: content.summary,
      evidenceKeys: content.evidenceKeys.slice(0, 50),
    };
    const validated = validateAuditEvent(event);
    if (!validated.ok) {
      throw new Error(`supervisor emitted an invalid audit event: ${validated.errors.join('; ')}`);
    }
    this.auditSink.record(validated.value);
    return validated.value;
  }
}
