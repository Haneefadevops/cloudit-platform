import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
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
});
