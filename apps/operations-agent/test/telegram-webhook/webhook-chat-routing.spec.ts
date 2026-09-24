/**
 * Chat-bind acceptance tests: free-text Telegram messages (no leading slash)
 * are routed to the command layer as command 'chat' with the verbatim
 * message text in rawText, through the exact same downstream pipeline as
 * slash commands (all offline, synthetic).
 */
import type { CommandRequest } from '../../src/telegram/telegram.types';
import { TelegramWebhookService } from '../../src/telegram/webhook';
import {
  baseTelegramSettings,
  CHAT_ID,
  makeHarness,
  messageUpdate,
  secretHeaders,
  TEST_SECRET,
  USER_ID,
} from './helpers';

describe('TelegramWebhookService - free-text chat routing', () => {
  it('routes a free-text question to execute() as command chat with verbatim rawText', async () => {
    const harness = makeHarness();
    harness.commandHandler.execute.mockResolvedValue({ text: 'ai: backups are GREEN' });
    const service = new TelegramWebhookService(harness.options);

    const question = 'how are the backups doing?';
    const outcome = await service.handle(
      messageUpdate(5001, { text: question }),
      secretHeaders(TEST_SECRET),
    );

    expect(outcome).toEqual({ status: 'handled', statusCode: 200, reply: { text: 'ai: backups are GREEN' } });
    const request = harness.commandHandler.execute.mock.calls[0][0] as CommandRequest;
    expect(request).toEqual({
      command: 'chat',
      args: [],
      rawText: question,
      userId: USER_ID,
      chatId: CHAT_ID,
      correlationId: 'tg-5001',
    });
  });

  it('routes emoji/unicode and long free text verbatim (body limit already applied)', async () => {
    const harness = makeHarness();
    const service = new TelegramWebhookService(harness.options);
    const text = `status 🚀 héllo wörld — backups? ${'x'.repeat(2000)}`;

    const outcome = await service.handle(
      messageUpdate(5002, { text }),
      secretHeaders(TEST_SECRET),
    );

    expect(outcome.status).toBe('handled');
    const request = harness.commandHandler.execute.mock.calls[0][0] as CommandRequest;
    expect(request.command).toBe('chat');
    expect(request.rawText).toBe(text);
  });

  it('ignores whitespace-only text without calling the command handler', async () => {
    const harness = makeHarness();
    const service = new TelegramWebhookService(harness.options);

    const outcome = await service.handle(
      messageUpdate(5003, { text: '   \n\t  ' }),
      secretHeaders(TEST_SECRET),
    );

    expect(outcome).toEqual({ status: 'ignored', statusCode: 200 });
    expect(harness.commandHandler.execute).not.toHaveBeenCalled();
    expect((harness.auditEvents[0] as { reasonCode: string }).reasonCode).toBe(
      'NON_COMMAND_MESSAGE',
    );
  });

  it('maps a rejecting downstream command handler to 500 COMMAND_FAILED (not swallowed)', async () => {
    const harness = makeHarness();
    harness.commandHandler.execute.mockRejectedValue(new Error('synthetic chat boom'));
    const service = new TelegramWebhookService(harness.options);

    const outcome = await service.handle(
      messageUpdate(5004, { text: 'any question' }),
      secretHeaders(TEST_SECRET),
    );

    expect(outcome).toEqual({ status: 'rejected', statusCode: 500 });
    expect((harness.auditEvents[0] as { resultCode: string }).resultCode).toBe('COMMAND_FAILED');
    // The raw error message must never leak.
    expect(JSON.stringify(outcome)).not.toContain('synthetic chat boom');
    expect(JSON.stringify(harness.auditEvents)).not.toContain('synthetic chat boom');
  });

  it('sanitizes and caps the chat reply before sending it', async () => {
    const harness = makeHarness();
    harness.commandHandler.execute.mockResolvedValue({
      text: `chat: <script>alert(1)</script> ${'y'.repeat(5000)}`,
    });
    const service = new TelegramWebhookService(harness.options);

    const outcome = await service.handle(
      messageUpdate(5005, { text: 'question' }),
      secretHeaders(TEST_SECRET),
    );

    expect(outcome.status).toBe('handled');
    expect(outcome.reply?.text.length).toBeLessThanOrEqual(4000);
    expect(outcome.reply?.text).not.toContain('<script>');
    // The free-text pipeline reuses COMMAND_EXECUTED like slash commands.
    expect((harness.auditEvents[0] as { reasonCode: string }).reasonCode).toBe('COMMAND_EXECUTED');
  });

  it('applies the rate limit to free text exactly like slash commands', async () => {
    const harness = makeHarness({
      telegram: { ...baseTelegramSettings(), rateLimitPerMinute: 1 },
    });
    const service = new TelegramWebhookService(harness.options);

    const first = await service.handle(
      messageUpdate(5010, { text: 'first question' }),
      secretHeaders(TEST_SECRET),
    );
    const second = await service.handle(
      messageUpdate(5011, { text: 'second question' }),
      secretHeaders(TEST_SECRET),
    );

    expect(first.status).toBe('handled');
    expect(second).toEqual({ status: 'rate_limited', statusCode: 429 });
    expect((harness.auditEvents[1] as { reasonCode: string }).reasonCode).toBe(
      'RATE_LIMIT_EXCEEDED',
    );
  });
});

describe('TelegramWebhookService - slash command routing is unchanged', () => {
  it.each([
    ['/status', 'status', []],
    ['/explain finding-x', 'explain', ['finding-x']],
    ['/foo', 'foo', []],
    ['/start', 'start', []],
  ])('routes %s through the existing command path', async (text, command, args) => {
    const harness = makeHarness();
    const service = new TelegramWebhookService(harness.options);

    const outcome = await service.handle(messageUpdate(5020, { text }), secretHeaders(TEST_SECRET));

    expect(outcome.status).toBe('handled');
    const request = harness.commandHandler.execute.mock.calls[0][0] as CommandRequest;
    expect(request.command).toBe(command);
    expect(request.args).toEqual(args);
    // Slash commands never carry rawText.
    expect('rawText' in request).toBe(false);
  });

  it('still rejects an invalid slash command name with COMMAND_INVALID', async () => {
    const harness = makeHarness();
    const service = new TelegramWebhookService(harness.options);

    const outcome = await service.handle(
      messageUpdate(5021, { text: '/bad-name! x' }),
      secretHeaders(TEST_SECRET),
    );

    expect(outcome).toEqual({ status: 'rejected', statusCode: 400 });
    expect(harness.commandHandler.execute).not.toHaveBeenCalled();
  });
});
