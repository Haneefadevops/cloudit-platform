import { Test } from '@nestjs/testing';
import { AiAdapterService, AiMaintenanceReadModel, AiModule } from '../../src/ai';
import { LlmRequest, LlmResponse } from '../../src/ai';
import { DETERMINISTIC_RED, EVIDENCE_HASH, FIXED_NOW, aiExplanation } from './fixtures';

const AI_CONFIG = {
  routineModel: 'gpt-5.6-luna',
  escalationModel: 'gpt-5.6-terra',
  requestTimeoutMs: 5_000,
  maxInputTokens: 8_000,
  maxOutputTokens: 1_000,
  maxEscalationsPerDay: 3,
};

describe('AiModule (token wiring)', () => {
  it('compiles and resolves both exported providers with fake ports', async () => {
    const auditEvents: unknown[] = [];
    const moduleRef = await Test.createTestingModule({
      imports: [
        AiModule.register({
          ai: AI_CONFIG,
          client: {
            complete: (_request: LlmRequest): Promise<LlmResponse> =>
              Promise.resolve({ text: JSON.stringify(aiExplanation()), inputTokens: 10, outputTokens: 5 }),
          },
          budget: {
            canCall: () => true,
            record: () => undefined,
          },
          gate: { assertEnabled: () => undefined },
          audit: { record: (event: unknown) => auditEvents.push(event) },
          environmentKey: 'env-test',
          now: FIXED_NOW,
        }),
      ],
    }).compile();

    const adapter = moduleRef.get(AiAdapterService);
    const readModel = moduleRef.get(AiMaintenanceReadModel);
    expect(adapter).toBeInstanceOf(AiAdapterService);
    expect(readModel).toBeInstanceOf(AiMaintenanceReadModel);

    const result = await adapter.assess({
      deterministic: DETERMINISTIC_RED,
      conflictingSignals: false,
      evidenceHash: EVIDENCE_HASH,
    });
    expect(result.fallback).toBe(false);
    expect(auditEvents).toHaveLength(1);

    const projection = readModel.getProjection();
    expect(projection.environmentKey).toBe('env-test');
    expect(projection.budget.aiEnabled).toBe(false); // fail-closed default source
    await moduleRef.close();
  });

  it('compiles standalone with fail-closed defaults when read-model ports are omitted', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        AiModule.register({
          ai: AI_CONFIG,
          client: { complete: async () => ({ text: '{}', inputTokens: 0, outputTokens: 0 }) },
          budget: { canCall: () => false, record: () => undefined },
          gate: { assertEnabled: () => undefined },
        }),
      ],
    }).compile();

    const readModel = moduleRef.get(AiMaintenanceReadModel);
    const projection = readModel.getProjection();
    expect(projection.findings).toEqual([]);
    expect(projection.killSwitches).toEqual({
      aiEnabled: false,
      telegramCommandsEnabled: false,
      autoRemediationEnabled: false,
      repairMasterEnabled: false,
    });
    await moduleRef.close();
  });
});
