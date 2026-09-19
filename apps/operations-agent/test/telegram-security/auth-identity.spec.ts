/**
 * Security spec 2: user/chat allowlist authorization (operator-plan 6.2).
 *
 * Wrong user, wrong chat, allowed-user-but-wrong-chat and allowed-chat-but-
 * wrong-user must all produce the SAME generic 403 denial — no oracle that
 * reveals which of the two checks failed.
 */

import { TelegramWebhookService } from '../../src/telegram/webhook';
import {
  ALLOWED_CHAT_ID,
  ALLOWED_USER_ID,
  authedHeaders,
  buildBody,
  buildUpdate,
  buildWebhookOptions,
  FOREIGN_CHAT_ID,
  FOREIGN_USER_ID,
  RecordingCommandHandler,
  TEST_WEBHOOK_SECRET,
} from './fixtures';

describe('TelegramWebhookService — user/chat allowlist authorization', () => {
  it('returns the same generic 403 for every allowlist failure mode', async () => {
    const handler = new RecordingCommandHandler();
    const service = new TelegramWebhookService(buildWebhookOptions({ commandHandler: handler }));

    const attempts: Array<{ name: string; userId: number; chatId: number }> = [
      { name: 'wrong user id', userId: FOREIGN_USER_ID, chatId: ALLOWED_CHAT_ID },
      { name: 'wrong chat id', userId: ALLOWED_USER_ID, chatId: FOREIGN_CHAT_ID },
      { name: 'user allowed but chat not', userId: ALLOWED_USER_ID, chatId: FOREIGN_CHAT_ID },
      { name: 'chat allowed but user not', userId: FOREIGN_USER_ID, chatId: ALLOWED_CHAT_ID },
    ];

    const outcomes = [];
    for (const attempt of attempts) {
      const outcome = await service.handle(
        buildBody(buildUpdate({ userId: attempt.userId, chatId: attempt.chatId, text: '/status' })),
        authedHeaders(),
      );
      expect(outcome.statusCode).toBe(403);
      expect(['rejected', 'ignored']).toContain(outcome.status);
      outcomes.push(outcome);
    }

    // Same generic denial text across ALL failure modes (no failure oracle).
    const denialTexts = outcomes.map((o) => o.reply?.text ?? null);
    for (const text of denialTexts) {
      expect(text).toBe(denialTexts[0]);
    }
    expect(denialTexts[0]).not.toBeNull();
  });

  it('reveals neither the failed check nor allowlist internals in the 403 reply', async () => {
    const service = new TelegramWebhookService(buildWebhookOptions());
    const outcome = await service.handle(
      buildBody(buildUpdate({ userId: FOREIGN_USER_ID, chatId: ALLOWED_CHAT_ID, text: '/status' })),
      authedHeaders(),
    );

    const replyText = outcome.reply?.text ?? '';
    expect(replyText).not.toContain(String(ALLOWED_USER_ID));
    expect(replyText).not.toContain(String(ALLOWED_CHAT_ID));
    expect(replyText).not.toContain(String(FOREIGN_USER_ID));
    expect(JSON.stringify(outcome)).not.toContain(TEST_WEBHOOK_SECRET);
  });

  it('never invokes the command layer on a 403', async () => {
    const handler = new RecordingCommandHandler();
    const service = new TelegramWebhookService(buildWebhookOptions({ commandHandler: handler }));

    await service.handle(
      buildBody(buildUpdate({ userId: FOREIGN_USER_ID, chatId: FOREIGN_CHAT_ID, text: '/status' })),
      authedHeaders(),
    );

    expect(handler.invocations).toHaveLength(0);
  });

  it('still handles an update for the exact allowlisted user/chat pair', async () => {
    const handler = new RecordingCommandHandler();
    const service = new TelegramWebhookService(buildWebhookOptions({ commandHandler: handler }));

    const outcome = await service.handle(
      buildBody(buildUpdate({ userId: ALLOWED_USER_ID, chatId: ALLOWED_CHAT_ID, text: '/status' })),
      authedHeaders(),
    );

    expect(outcome.status).toBe('handled');
    expect(outcome.statusCode).toBe(200);
    expect(handler.invocations).toHaveLength(1);
  });
});
