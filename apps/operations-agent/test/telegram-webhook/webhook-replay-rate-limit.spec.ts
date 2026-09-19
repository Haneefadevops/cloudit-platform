/**
 * Phase D acceptance tests: replay protection (injectable clock) and
 * per-user sliding-window rate limiting (all offline, synthetic).
 */
import { TelegramWebhookService } from '../../src/telegram/webhook';
import {
  baseTelegramSettings,
  makeHarness,
  messageUpdate,
  OTHER_USER_ID,
  secretHeaders,
  TEST_SECRET,
  USER_ID,
} from './helpers';

describe('TelegramWebhookService - replay protection', () => {
  it('rejects a replayed update_id with 409', async () => {
    const { options } = makeHarness();
    const service = new TelegramWebhookService(options);

    const first = await service.handle(messageUpdate(2001), secretHeaders(TEST_SECRET));
    const replay = await service.handle(messageUpdate(2001), secretHeaders(TEST_SECRET));

    expect(first.status).toBe('handled');
    expect(replay).toEqual({ status: 'rejected', statusCode: 409 });
  });

  it('expires the receipt after receiptTtlMs on the injected clock', async () => {
    const harness = makeHarness({ receiptTtlMs: 1000 });
    const service = new TelegramWebhookService(harness.options);

    const first = await service.handle(messageUpdate(2002), secretHeaders(TEST_SECRET));
    expect(first.status).toBe('handled');

    // Just inside the TTL: still a replay.
    harness.advance(999);
    const replay = await service.handle(messageUpdate(2002), secretHeaders(TEST_SECRET));
    expect(replay).toEqual({ status: 'rejected', statusCode: 409 });

    // Past the TTL: the receipt is pruned and the same update_id is fresh again.
    harness.advance(2);
    const afterExpiry = await service.handle(messageUpdate(2002), secretHeaders(TEST_SECRET));
    expect(afterExpiry.status).toBe('handled');
    expect(afterExpiry.statusCode).toBe(200);
  });

  it('does not treat distinct update_ids as replays', async () => {
    const { options } = makeHarness();
    const service = new TelegramWebhookService(options);

    for (const updateId of [2010, 2011, 2012]) {
      const outcome = await service.handle(messageUpdate(updateId), secretHeaders(TEST_SECRET));
      expect(outcome.status).toBe('handled');
    }
  });
});

describe('TelegramWebhookService - per-user rate limit', () => {
  it('rate-limits the (limit+1)-th rapid update from one user with 429', async () => {
    const limit = 3;
    const { options, auditEvents } = makeHarness({
      telegram: { ...baseTelegramSettings(), rateLimitPerMinute: limit },
    });
    const service = new TelegramWebhookService(options);

    const outcomes = [];
    for (let i = 0; i < limit + 1; i += 1) {
      outcomes.push(await service.handle(messageUpdate(2100 + i), secretHeaders(TEST_SECRET)));
    }

    expect(outcomes.slice(0, limit).map((o) => o.status)).toEqual([
      'handled',
      'handled',
      'handled',
    ]);
    expect(outcomes[limit]).toEqual({ status: 'rate_limited', statusCode: 429 });
    expect(auditEvents).toHaveLength(limit + 1);
    expect((auditEvents[limit] as { resultCode: string }).resultCode).toBe(
      'WEBHOOK_RATE_LIMITED',
    );
  });

  it('does not rate-limit a different user', async () => {
    const limit = 1;
    const { options } = makeHarness({
      telegram: {
        ...baseTelegramSettings(),
        rateLimitPerMinute: limit,
        allowedUserIds: [USER_ID, OTHER_USER_ID],
      },
    });
    const service = new TelegramWebhookService(options);

    const first = await service.handle(messageUpdate(2110), secretHeaders(TEST_SECRET));
    const second = await service.handle(messageUpdate(2111), secretHeaders(TEST_SECRET));
    const otherUser = await service.handle(
      messageUpdate(2112, { userId: OTHER_USER_ID }),
      secretHeaders(TEST_SECRET),
    );

    expect(first.status).toBe('handled');
    expect(second).toEqual({ status: 'rate_limited', statusCode: 429 });
    expect(otherUser.status).toBe('handled');
  });

  it('slides the window on the injected clock: old requests stop counting', async () => {
    const limit = 2;
    const harness = makeHarness({
      telegram: { ...baseTelegramSettings(), rateLimitPerMinute: limit },
    });
    const service = new TelegramWebhookService(harness.options);

    await service.handle(messageUpdate(2120), secretHeaders(TEST_SECRET));
    await service.handle(messageUpdate(2121), secretHeaders(TEST_SECRET));
    const limited = await service.handle(messageUpdate(2122), secretHeaders(TEST_SECRET));
    expect(limited.status).toBe('rate_limited');

    // Advance beyond the 60s window: the user has budget again.
    harness.advance(60_001);
    const recovered = await service.handle(messageUpdate(2123), secretHeaders(TEST_SECRET));
    expect(recovered.status).toBe('handled');
  });

  it('does not record a rate-limited request as a replay receipt issue on retry', async () => {
    const { options } = makeHarness({
      telegram: { ...baseTelegramSettings(), rateLimitPerMinute: 1 },
    });
    const service = new TelegramWebhookService(options);

    const accepted = await service.handle(messageUpdate(2130), secretHeaders(TEST_SECRET));
    const limited = await service.handle(messageUpdate(2131), secretHeaders(TEST_SECRET));
    expect(accepted.status).toBe('handled');
    expect(limited.status).toBe('rate_limited');

    // Telegram retries the *same* update after backoff: replay wins over rate limit.
    const retry = await service.handle(messageUpdate(2131), secretHeaders(TEST_SECRET));
    expect(retry).toEqual({ status: 'rejected', statusCode: 409 });
  });
});
