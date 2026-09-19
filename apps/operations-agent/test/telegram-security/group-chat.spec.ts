/**
 * Security spec 3: group chats. Group chat ids are subject to the exact same
 * allowlist as private chats — no group-specific trust. A group id that is
 * explicitly allowlisted behaves like any other allowed chat.
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
  GROUP_CHAT_ID,
  RecordingCommandHandler,
} from './fixtures';

describe('TelegramWebhookService — group chat allowlisting', () => {
  it('denies a group chat id that is not in the allowlist, with the generic 403', async () => {
    const handler = new RecordingCommandHandler();
    const service = new TelegramWebhookService(buildWebhookOptions({ commandHandler: handler }));

    const groupOutcome = await service.handle(
      buildBody(buildUpdate({ chatId: GROUP_CHAT_ID, text: '/status' })),
      authedHeaders(),
    );
    const privateOutcome = await service.handle(
      buildBody(buildUpdate({ chatId: FOREIGN_CHAT_ID, text: '/status' })),
      authedHeaders(),
    );

    expect(groupOutcome.statusCode).toBe(403);
    expect((groupOutcome.reply?.text ?? null)).toBe(privateOutcome.reply?.text ?? null);
    expect(handler.invocations).toHaveLength(0);
  });

  it('handles a normal message once the group id is allowlisted', async () => {
    const handler = new RecordingCommandHandler();
    const service = new TelegramWebhookService(
      buildWebhookOptions({
        commandHandler: handler,
        allowedChatIds: [ALLOWED_CHAT_ID, GROUP_CHAT_ID],
      }),
    );

    const outcome = await service.handle(
      buildBody(
        buildUpdate({ userId: ALLOWED_USER_ID, chatId: GROUP_CHAT_ID, text: '/status' }),
      ),
      authedHeaders(),
    );

    expect(outcome.status).toBe('handled');
    expect(outcome.statusCode).toBe(200);
    expect(handler.invocations).toHaveLength(1);
    expect(handler.invocations[0].command).toBe('status');
    expect(handler.invocations[0].chatId).toBe(GROUP_CHAT_ID);
  });
});
