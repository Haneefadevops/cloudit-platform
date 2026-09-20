import {
  AiFindingProjection,
  AiMaintenanceProjection,
} from '@cloudit/operations-agent-contracts';
import { AiMaintenanceReadModel } from '../../src/ai';
import { EVIDENCE_HASH, FIXED_NOW } from './fixtures';

const FINDING: AiFindingProjection = {
  findingKey: 'wf:backup-stale',
  severity: 'warning',
  safeTitle: 'Workflow snapshot is stale',
  assessment: 'RED',
  confidence: 'HIGH',
  issueCode: 'WF_STALE_SNAPSHOT',
  recommendedRunbook: 'none',
  explainedAt: new Date(FIXED_NOW()).toISOString(),
  model: 'gpt-5.6-terra',
};

function makeReadModel(overrides: Record<string, unknown> = {}): AiMaintenanceReadModel {
  return new AiMaintenanceReadModel({
    findings: { list: () => [FINDING] },
    budget: {
      summary: () => ({
        aiEnabled: true,
        dayCallsUsed: 4,
        dayCallsMax: 10,
        monthEurUsed: '0.42',
        monthEurCeiling: 7,
      }),
    },
    killSwitches: {
      states: () => ({
        aiEnabled: true,
        telegramCommandsEnabled: false,
        autoRemediationEnabled: false,
        repairMasterEnabled: false,
      }),
    },
    drift: {
      summary: () => ({ state: 'drift_detected', driftCount: 2, staleCount: 1, scannedAt: null }),
    },
    environmentKey: 'env-test',
    now: FIXED_NOW,
    ...overrides,
  });
}

describe('AiMaintenanceReadModel', () => {
  it('assembles a projection that structurally matches AiMaintenanceProjection', () => {
    const projection = makeReadModel().getProjection();

    // Structural key check against the contracts interface expectations.
    expect(Object.keys(projection).sort()).toEqual(
      ['budget', 'drift', 'environmentKey', 'findings', 'generatedAt', 'killSwitches'].sort(),
    );
    expect(Object.keys(projection.budget).sort()).toEqual(
      ['aiEnabled', 'dayCallsMax', 'dayCallsUsed', 'monthEurCeiling', 'monthEurUsed'].sort(),
    );
    expect(Object.keys(projection.killSwitches).sort()).toEqual(
      ['aiEnabled', 'autoRemediationEnabled', 'repairMasterEnabled', 'telegramCommandsEnabled'].sort(),
    );
    expect(Object.keys(projection.drift).sort()).toEqual(
      ['driftCount', 'scannedAt', 'staleCount', 'state'].sort(),
    );
    expect(projection.findings).toHaveLength(1);
    expect(Object.keys(projection.findings[0]).sort()).toEqual(
      [
        'assessment',
        'confidence',
        'explainedAt',
        'findingKey',
        'issueCode',
        'model',
        'recommendedRunbook',
        'safeTitle',
        'severity',
      ].sort(),
    );

    // Compile-time assignment proves type compatibility with the contracts.
    const typed: AiMaintenanceProjection = projection;
    expect(typed.environmentKey).toBe('env-test');
    expect(typed.generatedAt).toBe(new Date(FIXED_NOW()).toISOString());
    expect(typed.findings[0]).toEqual(FINDING);
    expect(typed.budget).toEqual({
      aiEnabled: true,
      dayCallsUsed: 4,
      dayCallsMax: 10,
      monthEurUsed: '0.42',
      monthEurCeiling: 7,
    });
    expect(typed.killSwitches).toEqual({
      aiEnabled: true,
      telegramCommandsEnabled: false,
      autoRemediationEnabled: false,
      repairMasterEnabled: false,
    });
    expect(typed.drift).toEqual({ state: 'drift_detected', driftCount: 2, staleCount: 1, scannedAt: null });
  });

  it('defaults environmentKey and serializes generatedAt as ISO-8601 UTC', () => {
    const projection = makeReadModel({ environmentKey: undefined }).getProjection();
    expect(projection.environmentKey).toBe('default');
    expect(Number.isNaN(Date.parse(projection.generatedAt))).toBe(false);
    expect(projection.generatedAt.endsWith('Z')).toBe(true);
  });

  it('contains no prompt, raw evidence, trace or secret material', () => {
    const projection = makeReadModel().getProjection();
    expect(JSON.stringify(projection)).not.toContain(EVIDENCE_HASH);
    expect(projection.findings[0].safeTitle).not.toContain('IGNORE');
  });
});
