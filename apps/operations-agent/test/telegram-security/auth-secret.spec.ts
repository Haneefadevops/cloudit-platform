/**
 * Security spec 1: webhook secret authentication (operator-plan 6.2).
 *
 * A forged, missing or homoglyph-substituted `secret_token` must produce an
 * identical neutral 401 outcome that reveals nothing about why verification
 * failed, and must never reach the command layer.
 */

import { TelegramWebhookService } from '../../src/telegram/webhook';
import {
  ALLOWED_USER_ID,
  authedHeaders,
  buildBody,
  buildUpdate,
  buildWebhookOptions,
  HOMOGLYPH_SECRET,
  noSecretHeaders,
  RecordingAuditSink,
  RecordingCommandHandler,
  SECRET_HEADER_NAME,
  TEST_BOT_TOKEN,
  TEST_WEBHOOK_SECRET,
  WRONG_SECRET_OTHER_LENGTH,
  WRONG_SECRET_SAME_LENGTH,
} from './fixtures';

describe('TelegramWebhookService — webhook secret authentication', () => {
  it('accepts the correct secret under the exact and differently-cased header names', async () => {
    const handler = new RecordingCommandHandler();
    const service = new TelegramWebhookService(buildWebhookOptions({ commandHandler: handler }));

    for (const headerName of [SECRET_HEADER_NAME, 'X-Telegram-Bot-Api-Secret-Token', 'X-TELEGRAM-BOT-API-SECRET-TOKEN']) {
      const outcome = await service.handle(
        buildBody(buildUpdate({ text: '/status' })),
        authedHeaders(TEST_WEBHOOK_SECRET, headerName),
      );
      expect(outcome.status).toBe('handled');
      expect(outcome.statusCode).toBe(200);
    }
    expect(handler.invocations).toHaveLength(3);
    expect(handler.invocations.every((r) => r.command === 'status')).toBe(true);
  });

  it('returns an identical neutral 401 for every secret failure mode', async () => {
    const outcomes = [];
    const handler = new RecordingCommandHandler();
    const audit = new RecordingAuditSink();
    const service = new TelegramWebhookService(
      buildWebhookOptions({ commandHandler: handler, audit }),
    );

    // Sanity: the homoglyph secret really is length-equal but byte-different.
    expect(HOMOGLYPH_SECRET).toHaveLength(TEST_WEBHOOK_SECRET.length);
    expect(HOMOGLYPH_SECRET).not.toBe(TEST_WEBHOOK_SECRET);

    const attempts: Array<{ name: string; headers: Record<string, string> }> = [
      { name: 'wrong secret, equal length', headers: authedHeaders(WRONG_SECRET_SAME_LENGTH) },
      { name: 'wrong secret, different length', headers: authedHeaders(WRONG_SECRET_OTHER_LENGTH) },
      { name: 'missing secret header', headers: noSecretHeaders() },
      { name: 'unicode homoglyph secret', headers: authedHeaders(HOMOGLYPH_SECRET) },
    ];

    for (const attempt of attempts) {
      const outcome = await service.handle(
        buildBody(buildUpdate({ text: '/status' })),
        attempt.headers,
      );
      expect(outcome.status).toBe('unauthorized');
      expect(outcome.statusCode).toBe(401);
      outcomes.push(outcome);
    }

    // Identical neutral outcome: no oracle revealing which check failed.
    for (const outcome of outcomes) {
      expect(outcome).toEqual(outcomes[0]);
    }
  });

  it('leaks no internal detail in a 401 outcome', async () => {
    const service = new TelegramWebhookService(buildWebhookOptions());
    const outcome = await service.handle(
      buildBody(buildUpdate({ text: '/status' })),
      authedHeaders(WRONG_SECRET_SAME_LENGTH),
    );

    const serialized = JSON.stringify(outcome);
    expect(serialized).not.toContain(TEST_WEBHOOK_SECRET);
    expect(serialized).not.toContain(TEST_BOT_TOKEN);
    expect(serialized).not.toContain(String(ALLOWED_USER_ID));
    expect(outcome.reply).toBeUndefined();
  });

  it('never invokes the command layer or skips auditing on a 401', async () => {
    const handler = new RecordingCommandHandler();
    const audit = new RecordingAuditSink();
    const service = new TelegramWebhookService(
      buildWebhookOptions({ commandHandler: handler, audit }),
    );

    await service.handle(buildBody(buildUpdate({ text: '/status' })), authedHeaders(undefined));

    expect(handler.invocations).toHaveLength(0);
    expect(audit.events).toHaveLength(1);
  });
});
