/**
 * Synthetic fixtures for contract acceptance tests.
 *
 * Every value here is obviously fake: fixture environment keys, fixture
 * evidence keys, placeholder issue codes. No production data, no network
 * access, no secret-like values.
 */

import { ContractEnvelope } from '../../src/contracts/envelope';
import { HealthAssessment } from '../../src/contracts/health-assessment';
import { Finding } from '../../src/contracts/finding';
import { Recommendation } from '../../src/contracts/recommendation';
import { RepairRequest } from '../../src/contracts/repair-request';
import { AuditEvent } from '../../src/contracts/audit-event';

export const FIXTURE_ENVIRONMENT_KEY = 'ops-portal-fixture';
export const FIXTURE_TIMESTAMP = '2026-09-19T10:15:30Z';
export const FIXTURE_EVIDENCE_KEY = 'evidence:fixture:check:backup-r2-roundtrip';

export const canonicalHealthAssessment: HealthAssessment = {
  assessment: 'AMBER',
  summary:
    'Synthetic fixture: R2 round-trip evidence is stale in the fixture environment. No production systems are involved.',
  evidenceKeys: [FIXTURE_EVIDENCE_KEY],
  confidence: 'MEDIUM',
  issueCode: 'BACKUP_FIXTURE_STALE',
  recommendedRunbook: 'none',
  automationEligibility: 'OWNER_REQUIRED',
};

export const canonicalFinding: Finding = {
  findingId: 'finding-fixture-0001',
  environmentKey: FIXTURE_ENVIRONMENT_KEY,
  issueCode: 'BACKUP_FIXTURE_STALE',
  severity: 'warning',
  state: 'open',
  summary:
    'Synthetic fixture: sanitized backup evidence exceeded the fixture freshness threshold.',
  evidenceKeys: [FIXTURE_EVIDENCE_KEY],
  firstSeenAt: FIXTURE_TIMESTAMP,
  lastSeenAt: FIXTURE_TIMESTAMP,
};

export const canonicalRecommendation: Recommendation = {
  recommendationId: 'recommendation-fixture-0001',
  findingId: 'finding-fixture-0001',
  environmentKey: FIXTURE_ENVIRONMENT_KEY,
  recommendedRunbook: 'RB-READONLY-RECHECK-001',
  automationEligibility: 'AUTO_SAFE',
  severity: 'info',
  summary:
    'Synthetic fixture: re-run the approved read-only recheck runbook once the freshness precondition passes.',
  evidenceKeys: [FIXTURE_EVIDENCE_KEY],
  createdAt: FIXTURE_TIMESTAMP,
};

export const canonicalRepairRequest: RepairRequest = {
  repairRequestId: 'repair-fixture-0001',
  proposalId: 'proposal-fixture-0001',
  environmentKey: FIXTURE_ENVIRONMENT_KEY,
  issueCode: 'BACKUP_FIXTURE_STALE',
  runbookKey: 'RB-READONLY-RECHECK-001',
  runbookVersion: '1.0.0',
  authorityTier: 'A',
  proposalState: 'proposed',
  attemptState: 'pending',
  idempotencyKey: 'idem-fixture-0001',
  requestedAt: FIXTURE_TIMESTAMP,
};

export const canonicalAuditEvent: AuditEvent = {
  eventId: 'audit-fixture-0001',
  environmentKey: FIXTURE_ENVIRONMENT_KEY,
  eventType: 'remediation_attempt',
  actor: 'controller:remediation',
  occurredAt: FIXTURE_TIMESTAMP,
  reasonCode: 'ATTEMPT_STARTED',
  resultCode: 'ACCEPTED',
  summary: 'Synthetic fixture: a Tier A repair attempt was recorded.',
  evidenceKeys: [FIXTURE_EVIDENCE_KEY],
};

export const canonicalHealthAssessmentEnvelope: ContractEnvelope<HealthAssessment> = {
  contractVersion: '1',
  recordType: 'health_assessment',
  emittedAt: FIXTURE_TIMESTAMP,
  environmentKey: FIXTURE_ENVIRONMENT_KEY,
  payload: canonicalHealthAssessment,
};
