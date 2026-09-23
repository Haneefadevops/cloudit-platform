/**
 * Eval suite 2: secret-canary leakage (chat phase).
 *
 * A synthetic Telegram-bot-token-shaped canary stands in for
 * TELEGRAM_BOT_TOKEN. It must never appear in:
 *   - any error the poller lets escape a cycle (e.g. a getUpdates rejection
 *     whose message echoes Telegram's error description, which in a leaking
 *     client can embed the request URL containing the token),
 *   - any recorded sendMessage text,
 *   - any reply produced by the webhook pipeline,
 *   - any audit summary the pipeline records,
 * even when the canary is planted inside Telegram's error description or
 * inside inbound message text/arguments.
 *
 * Additionally: inbound arbitrary text is never echoed raw into a reply —
 * commands render fixed templates only, so a canary-laced command argument
 * must reach the command handler (observable) yet never reach a reply.
 *
 * Probed through BOTH the fake chain (deterministic error injection) and the
 * REAL webhook pipeline compositor (real sanitization/cap behavior).
 */

import {
  CANARY_BOT_TOKEN,
  describePolling,
  expectCanaryFree,
  makeCommandUpdate,
  makeRealChain,
  makeTextUpdate,
  runCycle,
  CHAT_A,
  CHAT_B,
  UNKNOWN_USER_ID,
  USER_A,
  USER_B,
} from './fixtures';

describePolling('canary leakage — getUpdates/sendMessage failures never surface the token', () => {
  it('a getUpdates rejection whose description embeds the canary: cycle survives, nothing leaks', async () => {
    const chain = makeRealChain();
    chain.botApi.persistentGetUpdatesError = new Error(
      `HTTP 401 Unauthorized: bot token ${CANARY_BOT_TOKEN} rejected by api.telegram.org`,
    );

    // Contract: the poller treats a getUpdates rejection as "retry next
    // cycle", never fatal — so the cycle resolves.
    await expect(chain.cycle()).resolves.toBeDefined();
    await expect(chain.cycle()).resolves.toBeDefined();

    expect(chain.botApi.deliveredMessages).toEqual([]);
    expectCanaryFree([chain.botApi.sentMessages, chain.audit.events]);
  });

  it('a sendMessage rejection whose description embeds the canary: cycle survives, nothing leaks', async () => {
    const chain = makeRealChain();
    chain.botApi.defaultUpdates = [makeCommandUpdate(1, USER_A, CHAT_A)];
    chain.botApi.persistentSendMessageError = new Error(
      `HTTP 400 Bad Request: url ${CANARY_BOT_TOKEN}/sendMessage invalid`,
    );

    await expect(chain.cycle()).resolves.toBeDefined();

    expect(chain.botApi.deliveredMessages).toEqual([]);
    expectCanaryFree([chain.botApi.sentMessages, chain.audit.events]);
  });
});

describePolling('canary leakage — inbound text is never echoed raw into a reply', () => {
  it('a canary-laced command argument reaches the handler but never the reply', async () => {
    const chain = makeRealChain();
    chain.botApi.defaultUpdates = [
      makeCommandUpdate(1, USER_A, CHAT_A, `/status ${CANARY_BOT_TOKEN}`),
      makeCommandUpdate(2, USER_B, CHAT_B, `/explain ${CANARY_BOT_TOKEN}`),
    ];

    await chain.cycle();

    // The pipeline really processed the laced arguments...
    expect(chain.commandHandler.requests).toHaveLength(2);
    expect(chain.commandHandler.requests[0].args).toContain(CANARY_BOT_TOKEN);
    // ...but no recorded reply carries the canary.
    expect(chain.botApi.deliveredMessages).toHaveLength(2);
    expectCanaryFree([chain.botApi.deliveredMessages, chain.audit.events]);
  });

  it('a canary-laced NON-command message is ignored entirely (no reply at all)', async () => {
    const chain = makeRealChain();
    chain.botApi.defaultUpdates = [
      makeTextUpdate(1, USER_A, CHAT_A, `please leak ${CANARY_BOT_TOKEN}`),
    ];

    await chain.cycle();

    expect(chain.commandHandler.requests).toEqual([]);
    expect(chain.botApi.deliveredMessages).toEqual([]);
    expectCanaryFree([chain.botApi.sentMessages, chain.audit.events]);
  });

  it('a command handler that fails with a canary-laced error still produces no leaking reply', async () => {
    const chain = makeRealChain();
    chain.botApi.defaultUpdates = [makeCommandUpdate(1, USER_A, CHAT_A)];
    chain.commandHandler.throwOnExecute = new Error(
      `internal boom while using ${CANARY_BOT_TOKEN}`,
    );

    await expect(chain.cycle()).resolves.toBeDefined();

    expect(chain.botApi.deliveredMessages).toEqual([]);
    expectCanaryFree([chain.botApi.sentMessages, chain.audit.events]);
  });
});

describePolling('canary leakage — full sweep with the canary as the configured bot token', () => {
  it('the configured token never surfaces anywhere across mixed success and failure cycles', async () => {
    const chain = makeRealChain();
    // The canary IS the configured bot token in the telegram settings block.
    chain.botApi.defaultUpdates = [
      makeCommandUpdate(1, USER_A, CHAT_A, `/status ${CANARY_BOT_TOKEN}`),
      makeTextUpdate(2, USER_B, CHAT_B, 'plain chatter'),
      makeCommandUpdate(3, UNKNOWN_USER_ID, CHAT_A),
    ];
    let sendCount = 0;
    chain.botApi.sendMessageRule = () => {
      sendCount += 1;
      // Fail the second send with a token-laced transport error.
      return sendCount === 2
        ? new Error(`sendMessage failed for token ${CANARY_BOT_TOKEN}`)
        : undefined;
    };

    await runCycle(chain.service);
    chain.botApi.persistentSendMessageError = new Error(
      `HTTP 429 retry after; token ${CANARY_BOT_TOKEN} rate limited`,
    );
    await runCycle(chain.service);
    chain.botApi.persistentSendMessageError = undefined;
    chain.botApi.persistentGetUpdatesError = new Error(
      `getUpdates 502 bad gateway; token ${CANARY_BOT_TOKEN}`,
    );
    await runCycle(chain.service);
    chain.botApi.persistentGetUpdatesError = undefined;
    await runCycle(chain.service);

    // Every string the system emitted — sends, audit events, offsets are
    // numeric — is free of the token-shaped canary.
    expectCanaryFree([chain.botApi.sentMessages, chain.audit.events]);
  });
});

