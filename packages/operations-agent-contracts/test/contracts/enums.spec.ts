import {
  AUTHORITY_TIERS,
  AUTOMATION_ELIGIBILITIES,
  CONFIDENCE_LEVELS,
  FINDING_STATES,
  HEALTH_STATUSES,
  isMember,
  REPAIR_ATTEMPT_STATES,
  REPAIR_PROPOSAL_STATES,
  SEVERITIES,
} from '../../src/contracts/enums';
import { RECORD_TYPES } from '../../src/contracts/envelope';

describe('closed enums', () => {
  it('HEALTH_STATUSES contains exactly the spec members', () => {
    expect([...HEALTH_STATUSES]).toEqual(['GREEN', 'AMBER', 'RED', 'NO_DATA', 'UNKNOWN']);
  });

  it('SEVERITIES contains exactly the spec members', () => {
    expect([...SEVERITIES]).toEqual(['none', 'info', 'warning', 'critical']);
  });

  it('CONFIDENCE_LEVELS contains exactly the spec members', () => {
    expect([...CONFIDENCE_LEVELS]).toEqual(['LOW', 'MEDIUM', 'HIGH']);
  });

  it('FINDING_STATES contains exactly the spec members', () => {
    expect([...FINDING_STATES]).toEqual(['open', 'acknowledged', 'resolved', 'dismissed']);
  });

  it('REPAIR_PROPOSAL_STATES contains exactly the spec members', () => {
    expect([...REPAIR_PROPOSAL_STATES]).toEqual(['proposed', 'approved', 'expired', 'rejected']);
  });

  it('REPAIR_ATTEMPT_STATES contains exactly the spec members', () => {
    expect([...REPAIR_ATTEMPT_STATES]).toEqual([
      'pending',
      'running',
      'succeeded',
      'failed',
      'rolled_back',
    ]);
  });

  it('AUTOMATION_ELIGIBILITIES contains exactly the spec members', () => {
    expect([...AUTOMATION_ELIGIBILITIES]).toEqual([
      'AUTO_SAFE',
      'OWNER_REQUIRED',
      'PROHIBITED',
    ]);
  });

  it('AUTHORITY_TIERS contains exactly the spec members', () => {
    expect([...AUTHORITY_TIERS]).toEqual(['A', 'B', 'C', 'D']);
  });

  it('RECORD_TYPES contains exactly the contract record types', () => {
    expect([...RECORD_TYPES]).toEqual([
      'health_assessment',
      'finding',
      'recommendation',
      'repair_request',
      'audit_event',
    ]);
  });

  it('isMember rejects values outside every closed enum', () => {
    expect(isMember('BLUE', HEALTH_STATUSES)).toBe(false);
    expect(isMember('debug', SEVERITIES)).toBe(false);
    expect(isMember('CERTAIN', CONFIDENCE_LEVELS)).toBe(false);
    expect(isMember('GREEN', HEALTH_STATUSES)).toBe(true);
    expect(isMember(42, HEALTH_STATUSES)).toBe(false);
    expect(isMember(null, SEVERITIES)).toBe(false);
  });
});
