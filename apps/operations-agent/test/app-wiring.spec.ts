import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { AiAdapterService, AiMaintenanceReadModel } from '../src/ai';
import { AlertEngine } from '../src/alerts';
import { AuditService } from '../src/platform/audit/audit.service';
import { DURABLE_OUTBOX } from '../src/platform/outbox/durable-outbox';
import { RemediationEngine } from '../src/remediation';
import { SoakDriver } from '../src/observer';
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

  it('composes the alert engine (inert by default) with real read-model budget/kill-switch bindings', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    const alerts = moduleRef.get(AlertEngine);
    const platformAudit = moduleRef.get(AuditService);
    const outbox = moduleRef.get(DURABLE_OUTBOX);

    // Read model shows the REAL budget meter limits and switch states.
    const readModel = moduleRef.get(AiMaintenanceReadModel);
    const projection = readModel.getProjection();
    expect(projection.budget.aiEnabled).toBe(false);
    expect(projection.budget.dayCallsMax).toBe(10);
    expect(projection.budget.monthEurCeiling).toBe(7);
    expect(projection.killSwitches.telegramCommandsEnabled).toBe(false);

    // Inert by default: the 'telegram' kill switch is off, so dispatch is
    // blocked before any sender call and exactly one closed audit event
    // lands in the shared store. Nothing contacts Telegram.
    const before = platformAudit.count();
    const decision = await alerts.handle('default', {
      assessment: 'RED',
      summary: 'synthetic deterministic assessment',
      evidenceKeys: ['ev:synthetic:1'],
      confidence: 'MEDIUM',
      issueCode: 'WF_STALE_SNAPSHOT',
      recommendedRunbook: 'none',
      automationEligibility: 'OWNER_REQUIRED',
    });
    expect(decision.action).toBe('BLOCKED_KILL_SWITCH');
    expect(platformAudit.count()).toBe(before + 1);
    const lastEvent = platformAudit.getEvents()[platformAudit.count() - 1];
    expect(lastEvent.eventType).toBe('alert_dispatch');
    expect(lastEvent.actor).toBe('agent:alerts');
    expect(lastEvent.reasonCode).toBe('BLOCKED_KILL_SWITCH');
    expect(outbox.pendingEntries()).toHaveLength(0);

    await moduleRef.close();
  });

  it('binds the real Telegram sender when the server env provides token and chat, and stays inert while the switch is off', async () => {
    // Server-like env: token + allow-listed chat present, but the master
    // switch stays OFF. AgentConfigService reads process.env at construction,
    // so set the values before compiling the module.
    const savedToken = process.env.TELEGRAM_BOT_TOKEN;
    const savedChats = process.env.TELEGRAM_ALLOWED_CHAT_IDS;
    process.env.TELEGRAM_BOT_TOKEN = 'synthetic-token-for-wiring-spec-0000';
    process.env.TELEGRAM_ALLOWED_CHAT_IDS = '424242';
    try {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

      const alerts = moduleRef.get(AlertEngine);
      const platformAudit = moduleRef.get(AuditService);
      const outbox = moduleRef.get(DURABLE_OUTBOX);

      // The real sender is composed, but the 'telegram' kill switch is still
      // off: dispatch is blocked before any sender call, exactly one closed
      // audit event lands, and nothing contacts Telegram.
      const before = platformAudit.count();
      const decision = await alerts.handle('default', {
        assessment: 'RED',
        summary: 'synthetic deterministic assessment',
        evidenceKeys: ['ev:synthetic:1'],
        confidence: 'MEDIUM',
        issueCode: 'WF_STALE_SNAPSHOT',
        recommendedRunbook: 'none',
        automationEligibility: 'OWNER_REQUIRED',
      });
      expect(decision.action).toBe('BLOCKED_KILL_SWITCH');
      expect(platformAudit.count()).toBe(before + 1);
      expect(outbox.pendingEntries()).toHaveLength(0);

      await moduleRef.close();
    } finally {
      if (savedToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
      else process.env.TELEGRAM_BOT_TOKEN = savedToken;
      if (savedChats === undefined) delete process.env.TELEGRAM_ALLOWED_CHAT_IDS;
      else process.env.TELEGRAM_ALLOWED_CHAT_IDS = savedChats;
    }
  });

  it('composes the soak driver only when the operations_reader password is configured (fail closed otherwise)', async () => {
    // AgentConfigService reads process.env at construction, so set/restore
    // around each compile like the telegram-sender wiring test above.
    const savedPassword = process.env.OPERATIONS_DB_PASSWORD;

    // Without the password: the provider resolves to null and the observer
    // never touches the operations DB.
    delete process.env.OPERATIONS_DB_PASSWORD;
    const inertRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    expect(inertRef.get(SoakDriver)).toBeNull();
    await inertRef.close();

    // With the password: a real read-only driver is composed (its first tick
    // is 15 minutes out; the module closes long before any DB contact).
    process.env.OPERATIONS_DB_PASSWORD = 'synthetic-reader-password-for-wiring-spec';
    try {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
      const driver = moduleRef.get(SoakDriver);
      expect(driver).toBeInstanceOf(SoakDriver);
      await moduleRef.close();
    } finally {
      if (savedPassword === undefined) delete process.env.OPERATIONS_DB_PASSWORD;
      else process.env.OPERATIONS_DB_PASSWORD = savedPassword;
    }
  });

  it('composes the remediation engine (execute-nothing) and records remediation audit events into the shared store', async () => {    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    const remediation = moduleRef.get(RemediationEngine);
    const platformAudit = moduleRef.get(AuditService);

    // Proposing a runbook the default registry knows returns PROPOSED and
    // lands exactly one closed remediation_proposal event in the shared
    // store (evt-rem eventId prefix via the shared audit adapter).
    const before = platformAudit.count();
    const decision = remediation.propose('default', 'WF_STALE_SNAPSHOT');
    expect(decision.action).toBe('PROPOSED');
    expect(decision.proposal?.status).toBe('PROPOSED');
    expect(platformAudit.count()).toBe(before + 1);
    const lastEvent = platformAudit.getEvents()[platformAudit.count() - 1];
    expect(lastEvent.eventType).toBe('remediation_proposal');
    expect(lastEvent.eventId).toBe(`evt-rem-default-1`);
    expect(lastEvent.actor).toBe('agent:remediation');

    await moduleRef.close();
  });
});
