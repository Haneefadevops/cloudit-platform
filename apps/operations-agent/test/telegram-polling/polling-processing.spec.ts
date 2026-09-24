/**
 * Chat phase polling acceptance tests: update processing through the real
 * fail-closed webhook pipeline, at-least-once offset semantics, per-cycle
 * bounding, sequential processing and never-throws failure handling (all
 * offline, synthetic, deterministic).
 */
import type { WebhookOutcome } from '../../src/telegram/telegram.types';
import {
  CHAT_ID,
  commandUpdate,
  flush,
  makeHarness,
  REPLY_TEXT,
  USER_ID,
} from './helpers';

const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

function handledOutcome(text: string): WebhookOutcome {
  return { status: 'handled', statusCode: 200, reply: { text } };
}

describe('TelegramPollingService - update processing through the webhook pipeline', () => {
  it('happy path: update in -> pipeline -> sanitized reply sent, offset advanced', async () => {
    const { service, botApi, commandHandler } = makeHarness();
    botApi.queueUpdates([commandUpdate(1001)]);

    const outcome = await service.cycle();

    expect(outcome).toEqual({ status: 'COMPLETED', fetched: 1, processed: 1, repliesSent: 1 });
    expect(botApi.getUpdatesMock).toHaveBeenCalledWith(0);
    // The full fail-closed pipeline ran: secret gate, validation, allowlist,
    // command parsing.
    expect(commandHandler.execute).toHaveBeenCalledTimes(1);
    const request = commandHandler.execute.mock.calls[0][0];
    expect(request).toEqual({
      command: 'status',
      args: [],
      userId: USER_ID,
      chatId: CHAT_ID,
      correlationId: 'tg-1001',
    });
    expect(botApi.sendMessageMock).toHaveBeenCalledWith(CHAT_ID, REPLY_TEXT);
    expect(service.getOffset()).toBe(1002);

    // The next cycle polls from the advanced offset.
    botApi.queueUpdates([]);
    await service.cycle();
    expect(botApi.getUpdatesMock).toHaveBeenLastCalledWith(1002);
  });

  it('forwards the configured webhook secret to the pipeline on every update', async () => {
    const { service, botApi, webhookService } = makeHarness();
    const handleSpy = jest.spyOn(webhookService!, 'handle');
    botApi.queueUpdates([commandUpdate(1010), commandUpdate(1011)]);

    const outcome = await service.cycle();

    expect(outcome).toEqual({ status: 'COMPLETED', fetched: 2, processed: 2, repliesSent: 2 });
    expect(handleSpy).toHaveBeenCalledTimes(2);
    for (const [rawBody, headers] of handleSpy.mock.calls) {
      expect(typeof rawBody).toBe('string');
      expect(headers).toEqual({ [SECRET_HEADER]: 'test-webhook-secret-1' });
    }
    handleSpy.mockRestore();
  });

  it('routes a free-text update to the chat command and still advances', async () => {
    const { service, botApi, commandHandler } = makeHarness();
    const base = commandUpdate(1020);
    const freeText = {
      ...base,
      message: { ...(base.message as Record<string, unknown>), text: 'hello there' },
    };
    botApi.queueUpdates([freeText]);

    const outcome = await service.cycle();

    expect(outcome).toEqual({ status: 'COMPLETED', fetched: 1, processed: 1, repliesSent: 1 });
    expect(commandHandler.execute).toHaveBeenCalledTimes(1);
    const request = commandHandler.execute.mock.calls[0][0];
    expect(request.command).toBe('chat');
    expect(request.args).toEqual([]);
    expect(request.rawText).toBe('hello there');
    expect(botApi.sendMessageMock).toHaveBeenCalledWith(CHAT_ID, REPLY_TEXT);
    expect(service.getOffset()).toBe(1021);
  });

  it('never sends a reply for non-handled outcomes (unauthorized carries no send)', async () => {
    const { service, botApi } = makeHarness();
    const stranger = {
      update_id: 1030,
      message: {
        message_id: 2,
        from: { id: 999999999, is_bot: false, first_name: 'Intruder' },
        chat: { id: 888888888, type: 'private' },
        date: 1_727_000_000,
        text: '/status',
      },
    };
    botApi.queueUpdates([stranger]);

    const outcome = await service.cycle();

    // The pipeline itself attaches a 'Not authorized.' reply, but the poller
    // must only send replies for status 'handled'.
    expect(outcome).toEqual({ status: 'COMPLETED', fetched: 1, processed: 1, repliesSent: 0 });
    expect(botApi.sendMessageMock).not.toHaveBeenCalled();
    expect(service.getOffset()).toBe(1031);
  });

  it('treats a non-array getUpdates result as "no updates"', async () => {
    const { service, botApi, errors } = makeHarness();
    botApi.queueUpdates({ not: 'an array' });

    const outcome = await service.cycle();

    expect(outcome).toEqual({ status: 'COMPLETED', fetched: 0, processed: 0, repliesSent: 0 });
    expect(botApi.sendMessageMock).not.toHaveBeenCalled();
    expect(service.getOffset()).toBe(0);
    expect(errors).toEqual([]);
  });

  it('survives a getUpdates rejection, keeps the offset and retries next cycle', async () => {
    const { service, botApi, errors } = makeHarness();
    botApi.queueUpdates(new Error('synthetic transport failure'));

    await expect(service.cycle()).resolves.toEqual({ status: 'FETCH_FAILED' });
    expect(errors).toEqual(['GET_UPDATES_FAILED']);
    expect(service.getOffset()).toBe(0);

    // The loop continues: next cycle refetches from the unchanged offset.
    botApi.queueUpdates([commandUpdate(1040)]);
    const outcome = await service.cycle();
    expect(outcome).toEqual({ status: 'COMPLETED', fetched: 1, processed: 1, repliesSent: 1 });
    expect(botApi.getUpdatesMock).toHaveBeenLastCalledWith(0);
    expect(service.getOffset()).toBe(1041);
  });

  it('survives a sendMessage rejection, advances and keeps processing the batch', async () => {
    const { service, botApi, errors } = makeHarness();
    botApi.sendMessageMock.mockRejectedValueOnce(new Error('synthetic send failure'));
    botApi.queueUpdates([commandUpdate(1050), commandUpdate(1051)]);

    const outcome = await service.cycle();

    expect(outcome).toEqual({ status: 'COMPLETED', fetched: 2, processed: 2, repliesSent: 1 });
    expect(errors).toEqual(['SEND_MESSAGE_FAILED']);
    expect(botApi.sendMessageMock).toHaveBeenCalledTimes(2);
    // Both updates were handled (audited by the pipeline); the failed reply
    // is best-effort and must not stall the queue.
    expect(service.getOffset()).toBe(1052);

    botApi.queueUpdates([]);
    await service.cycle();
    expect(botApi.getUpdatesMock).toHaveBeenLastCalledWith(1052);
  });

  it('does not advance past an unprocessed update when the batch fails mid-cycle', async () => {
    const seen: number[] = [];
    let failOn: number | null = 1061;
    const stubWebhook = {
      handle: jest.fn(async (rawBody: string): Promise<WebhookOutcome> => {
        const update = JSON.parse(rawBody) as { update_id: number };
        seen.push(update.update_id);
        if (failOn !== null && update.update_id === failOn) {
          throw new Error('synthetic pipeline failure');
        }
        return handledOutcome(REPLY_TEXT);
      }),
    };
    const { service, botApi, errors } = makeHarness({ webhook: stubWebhook });
    botApi.queueUpdates([commandUpdate(1060), commandUpdate(1061), commandUpdate(1062)]);

    const outcome = await service.cycle();

    expect(outcome).toEqual({
      status: 'BATCH_INTERRUPTED',
      processed: 1,
      repliesSent: 1,
      failedUpdateId: 1061,
    });
    expect(errors).toEqual(['HANDLE_FAILED']);
    expect(seen).toEqual([1060, 1061]);
    // Offset acknowledges only the processed prefix.
    expect(service.getOffset()).toBe(1061);

    // At-least-once: the next cycle refetches from the failed update on;
    // the already-processed prefix is safe to redeliver (replay dedup).
    failOn = null;
    // At-least-once: the same window is refetched; the stub pipeline (no
    // dedup) processes all three, standing in for the real pipeline where
    // the replay dedup absorbs the 1060 redelivery.
    botApi.queueUpdates([commandUpdate(1060), commandUpdate(1061), commandUpdate(1062)]);
    const retry = await service.cycle();
    expect(retry).toEqual({ status: 'COMPLETED', fetched: 3, processed: 3, repliesSent: 3 });
    expect(botApi.getUpdatesMock).toHaveBeenLastCalledWith(1061);
    expect(service.getOffset()).toBe(1063);
  });

  it('caps the number of updates processed per cycle', async () => {
    const { service, botApi, commandHandler } = makeHarness({
      maxUpdatesPerCycle: 100,
      rateLimitPerMinute: 10_000,
    });
    const batch = Array.from({ length: 105 }, (_, i) => commandUpdate(2000 + i));
    botApi.queueUpdates(batch);

    const outcome = await service.cycle();

    expect(outcome).toEqual({ status: 'COMPLETED', fetched: 105, processed: 100, repliesSent: 100 });
    expect(commandHandler.execute).toHaveBeenCalledTimes(100);
    expect(service.getOffset()).toBe(2100);

    // The remaining 5 updates arrive in the next cycle.
    botApi.queueUpdates([]);
    await service.cycle();
    expect(botApi.getUpdatesMock).toHaveBeenLastCalledWith(2100);
  });

  it('processes updates strictly sequentially within a cycle', async () => {
    const order: string[] = [];
    const gate: { release?: () => void } = {};
    const firstGate = new Promise<void>((resolve) => {
      gate.release = resolve;
    });
    let call = 0;
    const stubWebhook = {
      handle: jest.fn(async (rawBody: string): Promise<WebhookOutcome> => {
        call += 1;
        const update = JSON.parse(rawBody) as { update_id: number };
        order.push(`start:${update.update_id}`);
        if (call === 1) await firstGate;
        order.push(`end:${update.update_id}`);
        return handledOutcome(REPLY_TEXT);
      }),
    };
    const { service, botApi } = makeHarness({ webhook: stubWebhook });
    botApi.queueUpdates([commandUpdate(3000), commandUpdate(3001)]);

    const pending = service.cycle();
    await flush();
    // The first update is parked on the gate; the second must not start.
    expect(order).toEqual(['start:3000']);

    gate.release?.();
    await pending;

    expect(order).toEqual(['start:3000', 'end:3000', 'start:3001', 'end:3001']);
    expect(service.getOffset()).toBe(3002);
  });

  it('skips the reply when chat id extraction fails but still acknowledges', async () => {
    const stubWebhook = {
      handle: jest.fn(async (): Promise<WebhookOutcome> => handledOutcome(REPLY_TEXT)),
    };
    const { service, botApi, errors } = makeHarness({ webhook: stubWebhook });
    // Handled by the stub pipeline, but message.chat.id is not a number.
    botApi.queueUpdates([
      { update_id: 3010, message: { from: { id: USER_ID }, chat: { id: 'oops' } } },
    ]);

    const outcome = await service.cycle();

    expect(outcome).toEqual({ status: 'COMPLETED', fetched: 1, processed: 1, repliesSent: 0 });
    expect(botApi.sendMessageMock).not.toHaveBeenCalled();
    expect(errors).toEqual([]);
    expect(service.getOffset()).toBe(3011);
  });

  it('survives a totally malformed update object without advancing or crashing', async () => {
    const { service, botApi, errors } = makeHarness();
    botApi.queueUpdates(['not even an object', 42]);

    const outcome = await service.cycle();

    expect(outcome).toEqual({ status: 'COMPLETED', fetched: 2, processed: 2, repliesSent: 0 });
    expect(botApi.sendMessageMock).not.toHaveBeenCalled();
    // Neither value carried a valid update_id, so the offset cannot advance.
    expect(service.getOffset()).toBe(0);
    expect(errors).toEqual([]);
  });

  it('never propagates errors even when the observability callback throws', async () => {
    const { service, botApi } = makeHarness({
      onError: () => {
        throw new Error('synthetic observability failure');
      },
    });
    botApi.queueUpdates(new Error('synthetic transport failure'));

    await expect(service.cycle()).resolves.toEqual({ status: 'FETCH_FAILED' });
  });
});
