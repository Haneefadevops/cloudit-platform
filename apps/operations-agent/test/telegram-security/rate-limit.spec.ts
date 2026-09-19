/**
 * Security spec 7: per-user rate limiting (operator-plan 6.2). With an
 * injected clock: rateLimitPerMinute requests pass, the next one is 429,
 * other allowlisted users are unaffected, and the window slides with time.
 */

import { TelegramWebhookService } from '../../src/telegram/webhook';
import {
  ALLOWED_USER_2_ID,
  ALLOWED_USER_ID,
  authedHeaders,
  buildBody,
  buildUpdate,
  buildWebhookOptions,
  ManualClock,
  RecordingCommandHandler,
} from './fixtures';

const RATE_LIMIT_PER_MINUTE = 3;

describe('TelegramWebhookService — per-user rate limit', () => {
  function buildService(handler: RecordingCommandHandler, clock: ManualClock) {
    return new TelegramWebhookService(
      buildWebhookOptions({
        commandHandler: handler,
        now: clock.now,
        rateLimitPerMinute: RATE_LIMIT_PER_MINUTE,
      }),
    );
  }

  it(`allows ${RATE_LIMIT_PER_MINUTE} updates/minute and 429s the next one`, async () => {
    const clock = new ManualClock();
    const handler = new RecordingCommandHandler();
    const service = buildService(handler, clock);

    for (let i = 0; i < RATE_LIMIT_PER_MINUTE; i += 1) {
      const outcome = await service.handle(buildBody(buildUpdate({ text: '/status' })), authedHeaders());
      expect(outcome.status).toBe('handled');
      expect(outcome.statusCode).toBe(200);
    }

    const flooded = await service.handle(buildBody(buildUpdate({ text: '/status' })), authedHeaders());
    expect(flooded.status).toBe('rate_limited');
    expect(flooded.statusCode).toBe(429);
    expect(handler.invocations).toHaveLength(RATE_LIMIT_PER_MINUTE);
  });

  it('does not rate-limit a different allowlisted user', async () => {
    const clock = new ManualClock();
    const handler = new RecordingCommandHandler();
    const service = new TelegramWebhookService(
      buildWebhookOptions({
        commandHandler: handler,
        now: clock.now,
        rateLimitPerMinute: RATE_LIMIT_PER_MINUTE,
        allowedUserIds: [ALLOWED_USER_ID, ALLOWED_USER_2_ID],
      }),
    );

    for (let i = 0; i < RATE_LIMIT_PER_MINUTE + 1; i += 1) {
      await service.handle(buildBody(buildUpdate({ text: '/status' })), authedHeaders());
    }

    const otherUser = await service.handle(
      buildBody(buildUpdate({ userId: ALLOWED_USER_2_ID, text: '/status' })),
      authedHeaders(),
    );
    expect(otherUser.status).toBe('handled');
    expect(otherUser.statusCode).toBe(200);
  });

  it('slides the window as the clock advances', async () => {
    const clock = new ManualClock();
    const handler = new RecordingCommandHandler();
    const service = buildService(handler, clock);

    for (let i = 0; i < RATE_LIMIT_PER_MINUTE; i += 1) {
      await service.handle(buildBody(buildUpdate({ text: '/status' })), authedHeaders());
    }
    const denied = await service.handle(buildBody(buildUpdate({ text: '/status' })), authedHeaders());
    expect(denied.statusCode).toBe(429);

    clock.advance(60_001);
    const afterWindow = await service.handle(buildBody(buildUpdate({ text: '/status' })), authedHeaders());
    expect(afterWindow.status).toBe('handled');
    expect(afterWindow.statusCode).toBe(200);
  });
});
