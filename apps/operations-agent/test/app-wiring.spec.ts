import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { AiAdapterService, AiMaintenanceReadModel } from '../src/ai';
import { AuditService } from '../src/platform/audit/audit.service';
import { SupervisorModule, AUDIT_SINK } from '../src/supervisor';
import { SYNC_AUDIT_SINK, SyncService } from '../src/sync';
import { TelegramCommandService } from '../src/telegram/commands';
import { TELEGRAM_COMMAND_HANDLER, TelegramWebhookService } from '../src/telegram/webhook';

/**
 * Coordinator wiring spec: proves the application composes and that every
 * module records audit events into ONE shared append-only store.
 */
describe('AppModule composition (coordinator wiring)', () => {
  it('binds supervisor and sync audit ports to the shared platform AuditService', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    const platformAudit = moduleRef.get(AuditService);
    const supervisorSink = moduleRef.get(AUDIT_SINK);
    const syncSink = moduleRef.get(SYNC_AUDIT_SINK);

    expect(supervisorSink).toBe(platformAudit);
    expect(syncSink).toBe(platformAudit);

    await moduleRef.close();
  });

  it('fails closed on sync scans while observation sources are unbound', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    const sync = moduleRef.get(SyncService);
    await expect(sync.scan()).rejects.toThrow(/not bound/);

    await moduleRef.close();
  });

  it('composes the Telegram webhook with the commands handler (inert by default)', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    const webhook = moduleRef.get(TelegramWebhookService);
    const handler = moduleRef.get(TELEGRAM_COMMAND_HANDLER);
    expect(handler).toBeInstanceOf(TelegramCommandService);

    // Inert by default: no webhook secret is configured, so even a perfectly
    // formed request is denied before any command runs.
    const outcome = await webhook.handle(
      JSON.stringify({
        update_id: 1,
        message: { chat: { id: 1 }, from: { id: 1 }, text: '/status' },
      }),
      { 'x-telegram-bot-api-secret-token': 'x' },
    );
    expect(outcome.statusCode).toBe(401);

    await moduleRef.close();
  });

  it('composes the AI adapter and read model (inert by default) and records AI audit events into the shared store', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    const adapter = moduleRef.get(AiAdapterService);
    const readModel = moduleRef.get(AiMaintenanceReadModel);
    const platformAudit = moduleRef.get(AuditService);

    // The read model fails closed until real sources are bound: no findings,
    // budget zeroed, all switches off, drift unknown.
    const projection = readModel.getProjection();
    expect(projection.findings).toEqual([]);
    expect(projection.budget.aiEnabled).toBe(false);
    expect(projection.killSwitches.aiEnabled).toBe(false);
    expect(projection.drift.state).toBe('unknown');

    // Inert by default: the 'ai' kill switch is off and the LLM port is the
    // fail-closed stand-in, so any assessment collapses to the deterministic
    // fallback and one closed audit event lands in the shared store.
    const before = platformAudit.count();
    const result = await adapter.assess({
      deterministic: {
        assessment: 'AMBER',
        summary: 'synthetic deterministic assessment',
        evidenceKeys: ['ev:synthetic:1'],
        confidence: 'MEDIUM',
        issueCode: 'NO_ISSUE',
        recommendedRunbook: 'none',
        automationEligibility: 'OWNER_REQUIRED',
      },
      conflictingSignals: false,
      evidenceHash: 'sha256:app-wiring',
    });
    expect(result.fallback).toBe(true);
    expect(result.model).toBe('deterministic');
    expect(platformAudit.count()).toBe(before + 1);
    const lastEvent = platformAudit.getEvents()[platformAudit.count() - 1];
    expect(lastEvent.eventType).toBe('ai_assessment');
    expect(lastEvent.actor).toBe('agent:ai-adapter');
    expect(lastEvent.reasonCode).toBe('AI_DISABLED');

    await moduleRef.close();
  });
});
