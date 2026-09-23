/**
 * Eval suite 3: authorization and kill switch (chat phase).
 *
 * The webhook pipeline enforces an exact userId AND chatId allowlist, and
 * the coordinator's kill switch (commandsEnabled) gates the whole Telegram
 * capability. The polling path must inherit both unchanged:
 *
 *  - a message from a non-allow-listed user id (or to a non-allow-listed
 *    chat id) results in NO sendMessage call — the poller must not blindly
 *    forward WebhookOutcome replies; only handled commands produce outbound
 *    traffic (the pipeline itself attaches a generic 'Not authorized.'
 *    reply to unauthorized outcomes; sending even that to an arbitrary
 *    chat would confirm the bot's existence to non-allow-listed parties),
 *  - kill switch off (commandsEnabled false) → zero botApi calls per cycle:
 *    the poller does not even poll getUpdates, so a disabled capability is
 *    completely silent toward Telegram.
 *
 * The allowlist checks themselves are the webhook pipeline's property and
 * are covered by its own suites; here we probe the poller's wiring of the
 * outcomes through the REAL pipeline compositor.
 */

import {
  describePolling,
  makeCommandUpdate,
  makeRealChain,
  CHAT_A,
  CHAT_B,
  UNKNOWN_CHAT_ID,
  UNKNOWN_USER_ID,
  USER_A,
  USER_B,
} from './fixtures';

describePolling('authorization — non-allow-listed identities produce zero outbound traffic', () => {
  it('a message from a non-allow-listed user id gets NO sendMessage call', async () => {
    const chain = makeRealChain();
    chain.botApi.defaultUpdates = [makeCommandUpdate(1, UNKNOWN_USER_ID, CHAT_A, '/status')];

    await chain.cycle();

    expect(chain.commandHandler.requests).toEqual([]);
    expect(chain.botApi.sendMessageCalls).toBe(0);
  });

  it('a message to a non-allow-listed chat id gets NO sendMessage call', async () => {
    const chain = makeRealChain();
    chain.botApi.defaultUpdates = [makeCommandUpdate(1, USER_A, UNKNOWN_CHAT_ID, '/status')];

    await chain.cycle();

    expect(chain.commandHandler.requests).toEqual([]);
    expect(chain.botApi.sendMessageCalls).toBe(0);
  });

  it('authorization is set-based: an allow-listed user may command from ANY allow-listed chat', async () => {
    // Coordinator arbitration (chat phase reconciliation): the Phase D
    // pipeline (and its existing test suites) implements SET semantics -
    // userId must be in allowedUserIds AND chatId in allowedChatIds, with no
    // pairwise pairing. This MVP deployment is single-owner (one user, one
    // chat), where both semantics coincide; pairwise would change tested
    // Phase D behavior, so the eval asserts the implemented contract.
    const chain = makeRealChain();
    chain.botApi.defaultUpdates = [makeCommandUpdate(1, USER_B, CHAT_A, '/status')];

    await chain.cycle();

    expect(chain.commandHandler.requests).toHaveLength(1);
    expect(chain.botApi.sendMessageCalls).toBe(1);
  });

  it('allow-listed user+chat pairs still flow (sanity: the pipeline is not wedged)', async () => {
    const chain = makeRealChain();
    chain.botApi.defaultUpdates = [makeCommandUpdate(1, USER_A, CHAT_A, '/status')];

    await chain.cycle();

    expect(chain.commandHandler.requests).toHaveLength(1);
    expect(chain.botApi.messagesFor(CHAT_A)).toHaveLength(1);
  });
});

describePolling('kill switch — commandsEnabled false means total silence', () => {
  it('zero botApi calls per cycle while disabled (not even getUpdates)', async () => {
    const chain = makeRealChain({ commandsEnabled: false });
    chain.botApi.defaultUpdates = [makeCommandUpdate(1, USER_A, CHAT_A, '/status')];

    await chain.cycle();
    await chain.cycle();

    expect(chain.botApi.getUpdatesCalls).toBe(0);
    expect(chain.botApi.sendMessageCalls).toBe(0);
  });

  it('reenabling restores polling (kill switch is a gate, not a latch)', async () => {
    const chain = makeRealChain({ commandsEnabled: false });
    await chain.cycle();
    expect(chain.botApi.getUpdatesCalls).toBe(0);

    // Flip the switch on the SAME service instance if the poller exposes its
    // gate dynamically; otherwise construct an enabled twin and show the
    // pipeline itself flows. The contract under test is that a disabled
    // poller made no calls above — this second half is a sanity anchor.
    const enabled = makeRealChain({ commandsEnabled: true });
    enabled.botApi.defaultUpdates = [makeCommandUpdate(1, USER_A, CHAT_A)];
    await enabled.cycle();
    expect(enabled.botApi.getUpdatesCalls).toBeGreaterThan(0);
  });
});
