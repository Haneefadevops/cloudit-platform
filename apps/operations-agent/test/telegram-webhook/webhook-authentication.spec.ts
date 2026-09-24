/**
 * Phase D acceptance tests: webhook authentication, kill switch,
 * authorization allowlists and inbound validation (all offline, synthetic).
 */
import { TelegramWebhookService } from '../../src/telegram/webhook';
import type { CommandRequest } from '../../src/telegram/telegram.types';
import {
  baseTelegramSettings,
  callbackQueryUpdate,
  CHAT_ID,
  makeHarness,
  messageUpdate,
  secretHeaders,
  TEST_SECRET,
  UNKNOWN_USER_ID,
  USER_ID,
  WRONG_CHAT_ID,
} from './helpers';

describe('TelegramWebhookService - authentication and validation', () => {
  describe('webhook secret token', () => {
    it('rejects a missing secret-token header with 401 and no detail', async () => {
      const { options, auditEvents } = makeHarness();
      const service = new TelegramWebhookService(options);

      const outcome = await service.handle(messageUpdate(1001), {});

      expect(outcome).toEqual({ status: 'unauthorized', statusCode: 401 });
      expect(JSON.stringify(outcome)).not.toContain(TEST_SECRET);
      expect(auditEvents).toHaveLength(1);
    });

    it('rejects a wrong-length forged secret with 401', async () => {
      const { options } = makeHarness();
      const service = new TelegramWebhookService(options);

      const outcome = await service.handle(
        messageUpdate(1002),
        secretHeaders('short'),
      );

      expect(outcome).toEqual({ status: 'unauthorized', statusCode: 401 });
    });

    it('rejects an equal-length wrong secret with 401 via the digest path', async () => {
      const { options, auditEvents } = makeHarness();
      const service = new TelegramWebhookService(options);
      const forged = 'x'.repeat(TEST_SECRET.length);

      const outcome = await service.handle(messageUpdate(1003), secretHeaders(forged));

      expect(outcome).toEqual({ status: 'unauthorized', statusCode: 401 });
      expect(auditEvents).toHaveLength(1);
      const audit = auditEvents[0] as { resultCode: string; summary: string };
      expect(audit.resultCode).toBe('WEBHOOK_UNAUTHORIZED');
      expect(JSON.stringify(audit)).not.toContain(forged);
    });

    it('accepts the correct secret (case-insensitive header name)', async () => {
      const { options, commandHandler } = makeHarness();
      const service = new TelegramWebhookService(options);

      const outcome = await service.handle(messageUpdate(1004), secretHeaders(TEST_SECRET));

      expect(outcome.status).toBe('handled');
      expect(outcome.statusCode).toBe(200);
      expect(commandHandler.execute).toHaveBeenCalledTimes(1);
    });

    it('fails closed when no webhook secret is configured', async () => {
      const { options } = makeHarness({
        telegram: { ...baseTelegramSettings(), webhookSecret: undefined },
      });
      const service = new TelegramWebhookService(options);

      const outcome = await service.handle(messageUpdate(1005), secretHeaders(TEST_SECRET));

      expect(outcome).toEqual({ status: 'unauthorized', statusCode: 401 });
    });
  });

  describe('commands kill switch', () => {
    it('rejects with 403 even when the secret is valid', async () => {
      const { options, commandHandler, auditEvents } = makeHarness({ commandsEnabled: false });
      const service = new TelegramWebhookService(options);

      const outcome = await service.handle(messageUpdate(1010), secretHeaders(TEST_SECRET));

      expect(outcome).toEqual({ status: 'rejected', statusCode: 403 });
      expect(commandHandler.execute).not.toHaveBeenCalled();
      expect(auditEvents).toHaveLength(1);
      expect((auditEvents[0] as { reasonCode: string }).reasonCode).toBe('COMMANDS_DISABLED');
    });
  });

  describe('authorization allowlists', () => {
    it('rejects an unknown user with a generic denial', async () => {
      const { options } = makeHarness();
      const service = new TelegramWebhookService(options);

      const outcome = await service.handle(
        messageUpdate(1020, { userId: UNKNOWN_USER_ID }),
        secretHeaders(TEST_SECRET),
      );

      expect(outcome).toEqual({
        status: 'unauthorized',
        statusCode: 403,
        reply: { text: 'Not authorized.' },
      });
    });

    it('rejects a known user in the wrong chat with a generic denial', async () => {
      const { options } = makeHarness();
      const service = new TelegramWebhookService(options);

      const outcome = await service.handle(
        messageUpdate(1021, { chatId: WRONG_CHAT_ID }),
        secretHeaders(TEST_SECRET),
      );

      expect(outcome).toEqual({
        status: 'unauthorized',
        statusCode: 403,
        reply: { text: 'Not authorized.' },
      });
    });

    it('returns identical outcomes for unknown user, wrong chat and both (no oracle)', async () => {
      const { options } = makeHarness();
      const service = new TelegramWebhookService(options);

      const unknownUser = await service.handle(
        messageUpdate(1030, { userId: UNKNOWN_USER_ID }),
        secretHeaders(TEST_SECRET),
      );
      const wrongChat = await service.handle(
        messageUpdate(1031, { chatId: WRONG_CHAT_ID }),
        secretHeaders(TEST_SECRET),
      );
      const bothWrong = await service.handle(
        messageUpdate(1032, { userId: UNKNOWN_USER_ID, chatId: WRONG_CHAT_ID }),
        secretHeaders(TEST_SECRET),
      );

      expect(unknownUser).toEqual(wrongChat);
      expect(wrongChat).toEqual(bothWrong);
      expect(JSON.stringify(unknownUser)).not.toContain(String(UNKNOWN_USER_ID));
      expect(JSON.stringify(unknownUser)).not.toContain(String(WRONG_CHAT_ID));
    });

    it('rejects a message with no from/chat identity', async () => {
      const { options } = makeHarness();
      const service = new TelegramWebhookService(options);
      const anonymous = JSON.stringify({
        update_id: 1033,
        message: { message_id: 1, chat: { type: 'private' }, date: 1_727_000_000, text: '/status' },
      });

      const outcome = await service.handle(anonymous, secretHeaders(TEST_SECRET));

      expect(outcome.status).toBe('unauthorized');
      expect(outcome.statusCode).toBe(403);
      expect(outcome.reply).toEqual({ text: 'Not authorized.' });
    });
  });

  describe('inbound validation', () => {
    it('rejects an oversized body with 413 before any other check', async () => {
      const { options } = makeHarness({
        telegram: { ...baseTelegramSettings(), maxBodyBytes: 256 },
      });
      const service = new TelegramWebhookService(options);
      const oversized = JSON.stringify({
        update_id: 1040,
        message: {
          message_id: 1,
          from: { id: USER_ID },
          chat: { id: CHAT_ID },
          text: `/status ${'x'.repeat(500)}`,
        },
      });
      expect(Buffer.byteLength(oversized, 'utf8')).toBeGreaterThan(256);

      const outcome = await service.handle(oversized, secretHeaders(TEST_SECRET));

      expect(outcome).toEqual({ status: 'rejected', statusCode: 413 });
    });

    it('rejects malformed JSON with 400', async () => {
      const { options } = makeHarness();
      const service = new TelegramWebhookService(options);

      const outcome = await service.handle('{not json', secretHeaders(TEST_SECRET));

      expect(outcome).toEqual({ status: 'rejected', statusCode: 400 });
    });

    it('rejects an update missing update_id', async () => {
      const { options } = makeHarness();
      const service = new TelegramWebhookService(options);

      const outcome = await service.handle(
        JSON.stringify({ message: { text: '/status' } }),
        secretHeaders(TEST_SECRET),
      );

      expect(outcome).toEqual({ status: 'rejected', statusCode: 400 });
    });

    it('rejects a non-integer update_id', async () => {
      const { options } = makeHarness();
      const service = new TelegramWebhookService(options);

      const outcome = await service.handle(
        JSON.stringify({ update_id: '1041', message: { text: '/status' } }),
        secretHeaders(TEST_SECRET),
      );

      expect(outcome).toEqual({ status: 'rejected', statusCode: 400 });
    });

    it('rejects an invalid command name with 400', async () => {
      const { options, commandHandler } = makeHarness();
      const service = new TelegramWebhookService(options);

      const outcome = await service.handle(
        messageUpdate(1042, { text: '/bad-name! x' }),
        secretHeaders(TEST_SECRET),
      );

      expect(outcome).toEqual({ status: 'rejected', statusCode: 400 });
      expect(commandHandler.execute).not.toHaveBeenCalled();
    });

    it('ignores unknown extra top-level fields on an otherwise valid command', async () => {
      const { options } = makeHarness();
      const service = new TelegramWebhookService(options);
      const update = JSON.stringify({
        update_id: 1043,
        message: {
          message_id: 2,
          from: { id: USER_ID },
          chat: { id: CHAT_ID },
          date: 1_727_000_000,
          text: '/status',
        },
        future_field: { nested: true },
      });

      const outcome = await service.handle(update, secretHeaders(TEST_SECRET));

      expect(outcome.status).toBe('handled');
      expect(outcome.statusCode).toBe(200);
    });
  });

  describe('update type gate', () => {
    it('ignores a callback query with 200 and a safe audit note', async () => {
      const { options, auditEvents } = makeHarness();
      const service = new TelegramWebhookService(options);

      const outcome = await service.handle(
        callbackQueryUpdate(1050),
        secretHeaders(TEST_SECRET),
      );

      expect(outcome).toEqual({ status: 'ignored', statusCode: 200 });
      const audit = auditEvents[0] as { reasonCode: string; resultCode: string; summary: string };
      expect(audit.resultCode).toBe('WEBHOOK_IGNORED');
      expect(audit.summary).toContain('callback');
    });

    it('ignores a service message with no text', async () => {
      const { options } = makeHarness();
      const service = new TelegramWebhookService(options);

      const outcome = await service.handle(
        messageUpdate(1051, { text: null, extraMessageFields: { photo: [] } }),
        secretHeaders(TEST_SECRET),
      );

      expect(outcome).toEqual({ status: 'ignored', statusCode: 200 });
    });

    it('routes plain chat text to the command handler as a chat request', async () => {
      const harness = makeHarness();
      const service = new TelegramWebhookService(harness.options);

      const outcome = await service.handle(
        messageUpdate(1052, { text: 'hello bot' }),
        secretHeaders(TEST_SECRET),
      );

      expect(outcome).toEqual({
        status: 'handled',
        statusCode: 200,
        reply: { text: 'synthetic status: ok' },
      });
      const request = harness.commandHandler.execute.mock.calls[0][0] as CommandRequest;
      expect(request.command).toBe('chat');
      expect(request.args).toEqual([]);
      expect(request.rawText).toBe('hello bot');
    });
  });
});
