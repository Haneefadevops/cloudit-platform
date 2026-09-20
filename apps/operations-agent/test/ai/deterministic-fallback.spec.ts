import { HealthAssessment, SECRET_CANARY_FIXTURES, detectCanaryLeak, validateHealthAssessment } from '@cloudit/operations-agent-contracts';
import { buildDeterministicFallback } from '../../src/ai';
import { DETERMINISTIC_RED } from './fixtures';

describe('buildDeterministicFallback', () => {
  it('retains the deterministic verdict fields unchanged', () => {
    const fallback = buildDeterministicFallback(DETERMINISTIC_RED);
    expect(fallback.assessment).toBe(DETERMINISTIC_RED.assessment);
    expect(fallback.evidenceKeys).toEqual(DETERMINISTIC_RED.evidenceKeys);
    expect(fallback.issueCode).toBe(DETERMINISTIC_RED.issueCode);
  });

  it('retains the supervisor-written summary verbatim (summary is supervisor-owned)', () => {
    const fallback = buildDeterministicFallback(DETERMINISTIC_RED);
    expect(fallback.summary).toBe(DETERMINISTIC_RED.summary);
  });

  it('replaces the summary with the fixed template when the deterministic text carries a secret canary', () => {
    const canary = SECRET_CANARY_FIXTURES[0].value;
    const laced: HealthAssessment = {
      ...DETERMINISTIC_RED,
      summary: `collector note mentions ${canary}`,
    };
    const fallback = buildDeterministicFallback(laced);
    expect(fallback.summary).toBe(
      `Deterministic assessment retained. findings=${DETERMINISTIC_RED.evidenceKeys.length}`,
    );
    expect(detectCanaryLeak(JSON.stringify(fallback)).leaked).toBe(false);
  });

  it('collapses AI-owned fields to safe defaults (LOW / none / OWNER_REQUIRED)', () => {
    const fallback = buildDeterministicFallback({
      ...DETERMINISTIC_RED,
      confidence: 'HIGH',
      recommendedRunbook: 'runbook:restart-agent',
      automationEligibility: 'AUTO_SAFE',
    });
    expect(fallback.confidence).toBe('LOW');
    expect(fallback.recommendedRunbook).toBe('none');
    expect(fallback.automationEligibility).toBe('OWNER_REQUIRED');
  });

  it('does not alias the input evidenceKeys array (pure function)', () => {
    const fallback = buildDeterministicFallback(DETERMINISTIC_RED);
    expect(fallback.evidenceKeys).not.toBe(DETERMINISTIC_RED.evidenceKeys);
    fallback.evidenceKeys.push('mutated');
    expect(DETERMINISTIC_RED.evidenceKeys).toHaveLength(2);
  });

  it('output always passes the contracts validator', () => {
    const fallback = buildDeterministicFallback(DETERMINISTIC_RED);
    expect(validateHealthAssessment(fallback).ok).toBe(true);
  });
});
