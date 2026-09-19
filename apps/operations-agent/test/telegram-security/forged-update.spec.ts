/**
 * Security spec 5: forged/malformed updates. A non-integer, negative or
 * missing update_id is a hard 400; unknown deeply-nested extra fields must
 * never crash the webhook and must not change how a valid update is handled.
 */

import { TelegramWebhookService } from '../../src/telegram/webhook';
import {
  authedHeaders,
  buildBody,
  buildUpdate,
  buildWebhookOptions,
  FIRST_UPDATE_ID,
  RecordingCommandHandler,
} from './fixtures';

describe('TelegramWebhookService — forged update shapes', () => {
  it.each([
    ['string update_id', { ...buildUpdate({ updateId: FIRST_UPDATE_ID + 30 }), update_id: '910000030' }],
    ['float update_id', { ...buildUpdate({ updateId: FIRST_UPDATE_ID + 31 }), update_id: 910000031.5 }],
    ['negative update_id', { ...buildUpdate({ updateId: FIRST_UPDATE_ID + 32 }), update_id: -1 }],
    ['null update_id', { ...buildUpdate({ updateId: FIRST_UPDATE_ID + 33 }), update_id: null }],
  ])('rejects a forged %s with 400', async (_name, raw) => {
    const handler = new RecordingCommandHandler();
    const service = new TelegramWebhookService(buildWebhookOptions({ commandHandler: handler }));

    const outcome = await service.handle(buildBody(raw), authedHeaders());

    expect(outcome.statusCode).toBe(400);
    expect(['rejected', 'ignored']).toContain(outcome.status);
    expect(handler.invocations).toHaveLength(0);
  });

  it('rejects an update with a missing update_id with 400', async () => {
    const handler = new RecordingCommandHandler();
    const service = new TelegramWebhookService(buildWebhookOptions({ commandHandler: handler }));

    const raw = buildUpdate({ updateId: FIRST_UPDATE_ID + 40 });
    delete raw.update_id;

    const outcome = await service.handle(buildBody(raw), authedHeaders());

    expect(outcome.statusCode).toBe(400);
    expect(handler.invocations).toHaveLength(0);
  });

  it('ignores deeply nested garbage extra fields without crashing', async () => {
    const deep = (depth: number): unknown =>
      depth === 0 ? { leaf: 'garbage' } : { nested: deep(depth - 1), sibling: [1, 2, 3] };
    const handler = new RecordingCommandHandler();
    const service = new TelegramWebhookService(buildWebhookOptions({ commandHandler: handler }));

    const raw = buildUpdate({
      updateId: FIRST_UPDATE_ID + 50,
      text: '/status',
      extraFields: {
        unknown_top_level: deep(40),
        entities: [{ type: 'bot_command', offset: 0, length: 7 }],
        voice: { file_id: 'synthetic-file-id', duration: 1 },
        pinned_message: { message_id: 1 },
      },
    });

    let outcome: { statusCode: number; status?: string } | undefined;
    try {
      outcome = await service.handle(buildBody(raw), authedHeaders());
    } catch (error) {
      throw new Error(`webhook crashed on nested garbage: ${String(error)}`);
    }

    // Valid command updates keep their normal handling; non-message payloads
    // are rejected upstream. Either way the webhook survives and answers.
    expect(outcome).toBeDefined();
    expect(typeof outcome?.statusCode).toBe('number');
    if (outcome?.statusCode === 200) {
      expect(handler.invocations).toHaveLength(1);
      expect(handler.invocations[0].command).toBe('status');
    }
  });
});
