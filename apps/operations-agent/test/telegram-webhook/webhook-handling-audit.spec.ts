/**
 * Phase D acceptance tests: command routing, reply sanitization, failure
 * handling and the one-event-per-call audit contract (all offline, synthetic).
 */
import { validateAuditEvent } from '@cloudit/operations-agent-contracts';
import type { CommandRequest } from '../../src/telegram/telegram.types';
import {
  TelegramWebhookService,
  TELEGRAM_WEBHOOK_ACTOR,
  TELEGRAM_WEBHOOK_EVENT_TYPE,
} from '../../src/telegram/webhook';
import {
  baseTelegramSettings,
  CHAT_ID,
  makeHarness,
  messageUpdate,
  secretHeaders,
  TEST_BOT_TOKEN,
  TEST_SECRET,
  USER_ID,
} from './helpers';

const CANARY = 'canary-token-a1b2c3d4e5';

describe('TelegramWebhookService - command handling and sanitization', () => {
  it('routes a valid /status command to the handler and replies 200', async () => {
    const harness = makeHarness();
    const service = new TelegramWebhookService(harness.options);

    const outcome = await service.handle(messageUpdate(3001), secretHeaders(TEST_SECRET));

    expect(outcome.status).toBe('handled');
    expect(outcome.statusCode).toBe(200);
    expect(outcome.reply).toEqual({ text: 'synthetic status: ok' });
    const request = harness.commandHandler.execute.mock.calls[0][0] as CommandRequest;
    expect(request).toEqual({
      command: 'status',
      args: [],
      userId: USER_ID,
      chatId: CHAT_ID,
      correlationId: 'tg-3001',
    });
  });

  it('lowercases the command and caps args at maxCommandArgs (extras dropped)', async () => {
    const harness = makeHarness({
      telegram: { ...baseTelegramSettings(), maxCommandArgs: 2 },
    });
    const service = new TelegramWebhookService(harness.options);

    await service.handle(
      messageUpdate(3002, { text: '/EXPLAIN one two three four' }),
      secretHeaders(TEST_SECRET),
    );

    const request = harness.commandHandler.execute.mock.calls[0][0] as CommandRequest;
    expect(request.command).toBe('explain');
    expect(request.args).toEqual(['one', 'two']);
  });

  it('sanitizes the command reply: injected <script> never appears raw', async () => {
    const harness = makeHarness();
    harness.commandHandler.execute.mockResolvedValue({
      text: 'status: <script>alert(1)</script> all green',
    });
    const service = new TelegramWebhookService(harness.options);

    const outcome = await service.handle(messageUpdate(3003), secretHeaders(TEST_SECRET));

    expect(outcome.status).toBe('handled');
    expect(outcome.reply?.text).toBe('status: [redacted] all green');
    expect(outcome.reply?.text).not.toContain('<script>');
    expect(JSON.stringify(outcome)).not.toContain('<script');
  });

  it('canary-like text in the command args never appears raw in outcomes or audit', async () => {
    const harness = makeHarness();
    harness.commandHandler.execute.mockImplementation(async (request: CommandRequest) => ({
      text: `answer for ${request.args.length} args`,
    }));
    const service = new TelegramWebhookService(harness.options);

    const outcome = await service.handle(
      messageUpdate(3004, { text: `/ask ${CANARY} <script>alert(1)</script>` }),
      secretHeaders(TEST_SECRET),
    );

    const leaked = JSON.stringify({ outcome, audit: harness.auditEvents });
    expect(leaked).not.toContain('<script');
    expect(leaked).not.toContain(CANARY);
    // The handler still received the raw args (Worker B's contract boundary).
    const request = harness.commandHandler.execute.mock.calls[0][0] as CommandRequest;
    expect(request.args[0]).toBe(CANARY);
  });

  it('caps the reply at 4000 characters', async () => {
    const harness = makeHarness();
    harness.commandHandler.execute.mockResolvedValue({ text: 'y'.repeat(5000) });
    const service = new TelegramWebhookService(harness.options);

    const outcome = await service.handle(messageUpdate(3005), secretHeaders(TEST_SECRET));

    expect(outcome.status).toBe('handled');
    expect(outcome.reply?.text).toHaveLength(4000);
  });

  it('maps a throwing command handler to 500 with COMMAND_FAILED', async () => {
    const harness = makeHarness();
    harness.commandHandler.execute.mockRejectedValue(new Error('synthetic boom'));
    const service = new TelegramWebhookService(harness.options);

    const outcome = await service.handle(messageUpdate(3006), secretHeaders(TEST_SECRET));

    expect(outcome).toEqual({ status: 'rejected', statusCode: 500 });
    expect((harness.auditEvents[0] as { resultCode: string }).resultCode).toBe('COMMAND_FAILED');
    // The raw error message must never leak.
    expect(JSON.stringify(outcome)).not.toContain('synthetic boom');
    expect(JSON.stringify(harness.auditEvents)).not.toContain('synthetic boom');
  });

  it('rejects an invalid response shape from the handler with 500', async () => {
    const harness = makeHarness();
    harness.commandHandler.execute.mockResolvedValue(undefined as never);
    const service = new TelegramWebhookService(harness.options);

    const outcome = await service.handle(messageUpdate(3007), secretHeaders(TEST_SECRET));

    expect(outcome).toEqual({ status: 'rejected', statusCode: 500 });
    expect((harness.auditEvents[0] as { reasonCode: string }).reasonCode).toBe('COMMAND_ERROR');
  });
});

describe('TelegramWebhookService - audit contract', () => {
  it('records exactly one audit event per handle() call across all outcomes', async () => {
    const harness = makeHarness();
    const service = new TelegramWebhookService(harness.options);
    const calls = 8;

    await service.handle(messageUpdate(3100), {}); // 401
    await service.handle(messageUpdate(3101), secretHeaders('wrong-secret-value')); // 401
    await service.handle(messageUpdate(3102), secretHeaders(TEST_SECRET)); // handled
    await service.handle(messageUpdate(3102), secretHeaders(TEST_SECRET)); // 409 replay
    await service.handle(messageUpdate(3103, { text: 'plain chat' }), secretHeaders(TEST_SECRET)); // handled as chat
    await service.handle('{broken', secretHeaders(TEST_SECRET)); // 400
    await service.handle('x'.repeat(5000), secretHeaders(TEST_SECRET)); // 413
    await service.handle(messageUpdate(3104, { userId: 999999999 }), secretHeaders(TEST_SECRET)); // 403

    expect(harness.auditEvents).toHaveLength(calls);
  });

  it('emits only contract-valid AuditEvents with safe result codes', async () => {
    const harness = makeHarness();
    const service = new TelegramWebhookService(harness.options);

    await service.handle(messageUpdate(3110), {}); // unauthorized
    await service.handle(messageUpdate(3111), secretHeaders(TEST_SECRET)); // handled
    await service.handle(messageUpdate(3112, { text: 'no command' }), secretHeaders(TEST_SECRET)); // handled as chat
    harness.commandHandler.execute.mockRejectedValueOnce(new Error('boom'));
    await service.handle(messageUpdate(3113), secretHeaders(TEST_SECRET)); // command failed

    const allowedResults = new Set([
      'WEBHOOK_UNAUTHORIZED',
      'WEBHOOK_REJECTED',
      'WEBHOOK_RATE_LIMITED',
      'WEBHOOK_IGNORED',
      'COMMAND_HANDLED',
      'COMMAND_FAILED',
    ]);
    for (const event of harness.auditEvents) {
      const validated = validateAuditEvent(event);
      expect(validated.ok).toBe(true);
      if (!validated.ok) throw new Error('audit event failed contract validation');
      expect(validated.value.actor).toBe(TELEGRAM_WEBHOOK_ACTOR);
      expect(validated.value.eventType).toBe(TELEGRAM_WEBHOOK_EVENT_TYPE);
      expect(allowedResults.has(validated.value.resultCode)).toBe(true);
    }
  });

  it('never records inbound text, tokens or secrets in audit events', async () => {
    const harness = makeHarness();
    const service = new TelegramWebhookService(harness.options);
    const inboundText = `/ask ${CANARY} private-question`;

    await service.handle(messageUpdate(3120, { text: inboundText }), secretHeaders(TEST_SECRET));
    await service.handle(messageUpdate(3121, { text: inboundText }), secretHeaders(TEST_SECRET)); // replay path

    const serialized = JSON.stringify(harness.auditEvents);
    expect(serialized).not.toContain(CANARY);
    expect(serialized).not.toContain(inboundText);
    expect(serialized).not.toContain(TEST_SECRET);
    expect(serialized).not.toContain(TEST_BOT_TOKEN);
  });

  it('keeps summaries bounded and correlation ids in evidenceKeys only', async () => {
    const harness = makeHarness();
    const service = new TelegramWebhookService(harness.options);

    await service.handle(messageUpdate(3130), secretHeaders(TEST_SECRET));

    const event = harness.auditEvents[0] as {
      summary: string;
      evidenceKeys: string[];
      resultCode: string;
    };
    expect(event.summary.length).toBeLessThanOrEqual(1000);
    expect(event.resultCode).toBe('COMMAND_HANDLED');
    expect(event.evidenceKeys).toEqual(['tg-3130']);
  });

  it('still returns the decision if the audit port throws', async () => {
    const { options } = makeHarness({
      audit: {
        record: () => {
          throw new Error('audit sink down');
        },
      },
    });
    const service = new TelegramWebhookService(options);

    const outcome = await service.handle(messageUpdate(3140), secretHeaders(TEST_SECRET));

    expect(outcome.status).toBe('handled');
    expect(outcome.statusCode).toBe(200);
  });
});
