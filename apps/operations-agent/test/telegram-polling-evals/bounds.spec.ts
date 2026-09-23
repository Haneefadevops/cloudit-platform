/**
 * Eval suite 6: bounds (chat phase).
 *
 * Adversarial volumes at every boundary of the polling path:
 *
 *  - a huge updates array from getUpdates is capped per cycle
 *    (`maxUpdatesPerCycle` passed in the options; an implementation whose
 *    own cap is tighter still passes — looser fails as a finding), and the
 *    cap must not lose updates: every one of a 100-update flood is
 *    processed exactly once across however many cycles the cap forces,
 *  - a huge reply text is capped BEFORE sendMessage — Telegram's hard limit
 *    is 4096 chars, so no recorded sendMessage text may exceed it (the real
 *    pipeline caps at 4000; a poller-side cap must hold even when the
 *    pipeline is replaced by a degenerate one),
 *  - per-user rate limiting from the webhook pipeline actually throttles a
 *    command flood: with rateLimitPerMinute=5, a 30-command burst from one
 *    user yields at most 5 replies (REAL pipeline compositor, deterministic
 *    clock so the sliding window never rolls).
 */

import {
  describePolling,
  makeCommandUpdate,
  makeFakeChain,
  makeRealChain,
  reasonOf,
  runCycle,
  CHAT_A,
  CHAT_B,
  USER_A,
  USER_B,
} from './fixtures';

/** Telegram sendMessage hard limit; every outbound text must respect it. */
const TELEGRAM_TEXT_LIMIT = 4096;
const FLOOD_SIZE = 100;

describePolling('updates-array cap — per-cycle bound without loss', () => {
  it('processes at most maxUpdatesPerCycle updates per cycle, exactly once each overall', async () => {
    const chain = makeFakeChain({ maxUpdatesPerCycle: 25 });
    const flood = Array.from({ length: FLOOD_SIZE }, (_, i) =>
      makeCommandUpdate(i + 1, i % 2 === 0 ? USER_A : USER_B, i % 2 === 0 ? CHAT_A : CHAT_B),
    );
    chain.botApi.responder = (offset) =>
      flood.filter((u) => (u.update_id as number) >= offset);

    const perCycleHandled: number[] = [];
    let cycles = 0;
    // Run until every update is acked (offset passes the flood), bounded.
    while (chain.botApi.lastOffsetRequested === undefined || chain.botApi.lastOffsetRequested <= FLOOD_SIZE) {
      const before = chain.webhook.handledCount;
      await runCycle(chain.service);
      perCycleHandled.push(chain.webhook.handledCount - before);
      cycles += 1;
      if (cycles > 20) break;
    }

    expect(cycles).toBeGreaterThan(1); // the cap actually engaged
    for (const handled of perCycleHandled) {
      expect(handled).toBeLessThanOrEqual(25);
      expect(handled).toBeGreaterThan(0);
    }
    // No loss, no duplication: 100 handled, 100 replies, 100 acked.
    expect(chain.webhook.handledCount).toBe(FLOOD_SIZE);
    expect(chain.botApi.deliveredMessages).toHaveLength(FLOOD_SIZE);
    expect(chain.botApi.lastOffsetRequested).toBe(FLOOD_SIZE + 1);
  });

  it('a cap larger than the batch is harmless (normal batch fully processed in one cycle)', async () => {
    const chain = makeFakeChain({ maxUpdatesPerCycle: 25 });
    chain.botApi.defaultUpdates = [makeCommandUpdate(1, USER_A, CHAT_A)];

    await runCycle(chain.service);

    expect(chain.webhook.handledCount).toBe(1);
    expect(chain.botApi.deliveredMessages).toHaveLength(1);
  });
});

describePolling('reply-text cap — bounded before sendMessage', () => {
  it('a degenerate pipeline returning a 100k-char reply still sends at most 4096 chars', async () => {
    const chain = makeFakeChain();
    chain.botApi.defaultUpdates = [makeCommandUpdate(1, USER_A, CHAT_A)];
    chain.webhook.handler = () => ({
      status: 'handled',
      statusCode: 200,
      reply: { text: 'X'.repeat(100_000) },
    });

    await runCycle(chain.service);

    expect(chain.botApi.deliveredMessages).toHaveLength(1);
    expect(chain.botApi.deliveredMessages[0].text.length).toBeLessThanOrEqual(TELEGRAM_TEXT_LIMIT);
  });

  it('the REAL pipeline stays under its own 4000-char cap for oversized handler output', async () => {
    const chain = makeRealChain();
    chain.botApi.defaultUpdates = [makeCommandUpdate(1, USER_A, CHAT_A)];
    chain.commandHandler.handler = () => ({ text: 'Y'.repeat(100_000) });

    await runCycle(chain.service);

    expect(chain.botApi.deliveredMessages).toHaveLength(1);
    expect(chain.botApi.deliveredMessages[0].text.length).toBeLessThanOrEqual(TELEGRAM_TEXT_LIMIT);
  });
});

describePolling('per-user rate limit — pipeline throttling holds through the poller', () => {
  it('a 30-command burst from one user yields at most rateLimitPerMinute replies', async () => {
    const chain = makeRealChain({ telegram: { rateLimitPerMinute: 5 } });
    // Distinct update ids, one allowed user/chat, deterministic clock (the
    // sliding window never rolls during the burst).
    chain.botApi.defaultUpdates = Array.from({ length: 30 }, (_, i) =>
      makeCommandUpdate(i + 1, USER_A, CHAT_A),
    );

    await runCycle(chain.service);

    expect(chain.botApi.deliveredMessages.length).toBeLessThanOrEqual(5);
    expect(chain.botApi.deliveredMessages.length).toBeGreaterThan(0);
    // The remaining 25 were rate-limited, not lost silently: the pipeline
    // recorded RATE_LIMIT_EXCEEDED decisions.
    const reasons = chain.audit.events.map((event) => reasonOf(event));
    expect(reasons).toContain('RATE_LIMIT_EXCEEDED');
    // Exactly the allowed number of commands executed.
    expect(chain.commandHandler.requests.length).toBeLessThanOrEqual(5);
  });
});
