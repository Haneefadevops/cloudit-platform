/**
 * Security spec 4: replay defense (operator-plan 6.2 — persist and deduplicate
 * update_id before processing). Same update_id twice -> 409; a fresh id is
 * fine; once the receipt TTL expires (injected clock) the id is accepted again.
 */

import { TelegramWebhookService } from '../../src/telegram/webhook';
import {
  authedHeaders,
  buildBody,
  buildUpdate,
  buildWebhookOptions,
  FIRST_UPDATE_ID,
  ManualClock,
  RecordingAuditSink,
  RecordingCommandHandler,
} from './fixtures';

const RECEIPT_TTL_MS = 300_000;

describe('TelegramWebhookService — update_id replay defense', () => {
  it('rejects a duplicated update_id with 409 and processes a fresh id', async () => {
    const handler = new RecordingCommandHandler();
    const service = new TelegramWebhookService(
      buildWebhookOptions({ commandHandler: handler, now: new ManualClock().now }),
    );

    const first = await service.handle(
      buildBody(buildUpdate({ updateId: FIRST_UPDATE_ID, text: '/status' })),
      authedHeaders(),
    );
    expect(first.status).toBe('handled');
    expect(first.statusCode).toBe(200);

    const replay = await service.handle(
      buildBody(buildUpdate({ updateId: FIRST_UPDATE_ID, text: '/status' })),
      authedHeaders(),
    );
    expect(replay.statusCode).toBe(409);
    expect(['rejected', 'ignored']).toContain(replay.status);

    const fresh = await service.handle(
      buildBody(buildUpdate({ updateId: FIRST_UPDATE_ID + 1, text: '/status' })),
      authedHeaders(),
    );
    expect(fresh.status).toBe('handled');
    expect(fresh.statusCode).toBe(200);

    // The replayed update must not be processed twice.
    expect(handler.invocations).toHaveLength(2);
  });

  it('accepts the same update_id again once the receipt TTL has expired', async () => {
    const clock = new ManualClock();
    const handler = new RecordingCommandHandler();
    const service = new TelegramWebhookService(
      buildWebhookOptions({ commandHandler: handler, now: clock.now, receiptTtlMs: RECEIPT_TTL_MS }),
    );

    const body = buildBody(buildUpdate({ updateId: FIRST_UPDATE_ID + 10, text: '/status' }));

    await service.handle(body, authedHeaders());
    clock.advance(RECEIPT_TTL_MS / 2);
    const earlyReplay = await service.handle(body, authedHeaders());
    expect(earlyReplay.statusCode).toBe(409);

    clock.advance(RECEIPT_TTL_MS / 2 + 1_000);
    const afterExpiry = await service.handle(body, authedHeaders());
    expect(afterExpiry.status).toBe('handled');
    expect(afterExpiry.statusCode).toBe(200);
    expect(handler.invocations).toHaveLength(2);
  });

  it('records a replay attempt in the audit trail without message content', async () => {
    const audit = new RecordingAuditSink();
    const service = new TelegramWebhookService(
      buildWebhookOptions({ audit, now: new ManualClock().now }),
    );

    const body = buildBody(buildUpdate({ updateId: FIRST_UPDATE_ID + 20, text: '/status' }));
    await service.handle(body, authedHeaders());
    await service.handle(body, authedHeaders());

    expect(audit.events).toHaveLength(2);
    const serialized = JSON.stringify(audit.events);
    expect(serialized).not.toContain('/status');
  });
});
