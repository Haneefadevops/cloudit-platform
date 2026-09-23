/**
 * Eval suite 5: outage fail-closed behavior (chat phase).
 *
 * The Bot API contract states a poller treats a getUpdates rejection as
 * "try again next cycle", never fatal. Adversarial conditions:
 *
 *  - persistent getUpdates outage: every cycle survives and retries; the
 *    poller never crashes the loop and never invents updates,
 *  - intermittent getUpdates outage: the cycle after the failure picks up
 *    normally,
 *  - sendMessage outage for one chat: the poller survives, later updates
 *    still get processed (same batch or retry cycle — at-least-once from
 *    suite 4 guarantees eventual delivery),
 *  - malformed update objects in a batch (nulls, primitives, unparseable
 *    ids, stray shapes): never crash a cycle; the well-formed update in the
 *    same batch is still processed; the batch still makes forward progress.
 *
 * Malformed handling is probed through the REAL webhook pipeline, which owns
 * strict validation (raw updates arrive as `unknown`; every validation
 * decision is the pipeline's, reused unchanged by the poller).
 */

import {
  describePolling,
  makeCallbackUpdate,
  makeCommandUpdate,
  makeFakeChain,
  makeRealChain,
  makeTextUpdate,
  reasonOf,
  runCycle,
  CHAT_A,
  USER_A,
} from './fixtures';

const OUTAGE_ERROR = new Error('synthetic transport outage: connection reset');

describePolling('getUpdates outage — cycle survives and retries', () => {
  it('a persistent getUpdates rejection never breaks the cycle (retry every cycle)', async () => {
    const chain = makeRealChain();
    chain.botApi.persistentGetUpdatesError = OUTAGE_ERROR;

    await expect(runCycle(chain.service)).resolves.toBeDefined();
    await expect(runCycle(chain.service)).resolves.toBeDefined();
    await expect(runCycle(chain.service)).resolves.toBeDefined();

    expect(chain.botApi.getUpdatesCalls).toBe(3);
    expect(chain.botApi.sendMessageCalls).toBe(0);
    expect(chain.commandHandler.requests).toEqual([]);
  });

  it('an intermittent getUpdates failure is retried on the very next cycle', async () => {
    const chain = makeRealChain();
    chain.botApi.queue(OUTAGE_ERROR);
    chain.botApi.defaultUpdates = [makeCommandUpdate(1, USER_A, CHAT_A)];

    await expect(runCycle(chain.service)).resolves.toBeDefined();
    expect(chain.botApi.deliveredMessages).toEqual([]);

    await expect(runCycle(chain.service)).resolves.toBeDefined();
    expect(chain.botApi.messagesFor(CHAT_A)).toHaveLength(1);
  });

  it('an outage cycle makes NO progress claim: offset stays put for the retry', async () => {
    const chain = makeRealChain();
    chain.botApi.queue(OUTAGE_ERROR);
    chain.botApi.defaultUpdates = [];

    await runCycle(chain.service);
    const baseOffset = chain.botApi.offsetsRequested[0];
    await runCycle(chain.service);
    // After a failed cycle the poller retries from the SAME offset.
    expect(chain.botApi.offsetsRequested[1]).toBe(baseOffset);
  });
});

describePolling('sendMessage outage — poller survives, pipeline continues', () => {
  it('a sendMessage rejection does not kill the poller and the failed update is retried', async () => {
    // Fake chain: the fake pipeline has no replay receipts, so the retried
    // update is reprocessed and its reply delivered once the outage clears.
    // (With the real pipeline, receipts ack before send success — the
    // at-least-once retry guarantee across a send outage is suite 4's fake-
    // chain property; here we probe that the poller itself survives.)
    const chain = makeFakeChain();
    chain.botApi.defaultUpdates = [makeCommandUpdate(1, USER_A, CHAT_A)];
    chain.botApi.persistentSendMessageError = OUTAGE_ERROR;

    await expect(runCycle(chain.service)).resolves.toBeDefined();
    expect(chain.botApi.deliveredMessages).toEqual([]);

    chain.botApi.persistentSendMessageError = undefined;
    await expect(runCycle(chain.service)).resolves.toBeDefined();
    expect(chain.botApi.messagesFor(CHAT_A)).toHaveLength(1);
  });

  it('later updates in subsequent cycles are processed during a sustained partial outage', async () => {
    const chain = makeFakeChain();
    chain.botApi.defaultUpdates = [makeCommandUpdate(10, USER_A, CHAT_A)];
    chain.botApi.persistentSendMessageError = OUTAGE_ERROR;
    await runCycle(chain.service);

    chain.botApi.persistentSendMessageError = undefined;
    chain.botApi.defaultUpdates = [makeCommandUpdate(11, USER_A, CHAT_A)];
    await runCycle(chain.service);

    expect(chain.botApi.deliveredMessages.map((m) => m.chatId)).toEqual([CHAT_A]);
    expect(chain.botApi.getUpdatesCalls).toBeGreaterThanOrEqual(2);
  });
});

describePolling('malformed updates — never crash a cycle', () => {
  const malformedBatch = (): unknown[] => [
    null,
    42,
    'just a string',
    [],
    {},
    { update_id: 'not-a-number' },
    { update_id: -1 },
    { update_id: 1.5 },
    makeTextUpdate(900, USER_A, CHAT_A, 'plain chatter, no command'),
    makeCallbackUpdate(901, USER_A),
  ];

  it('a batch laced with malformed updates still yields the one valid command reply', async () => {
    const chain = makeRealChain();
    const valid = makeCommandUpdate(777, USER_A, CHAT_A);
    chain.botApi.defaultUpdates = [...malformedBatch(), valid];

    await expect(runCycle(chain.service)).resolves.toBeDefined();

    expect(chain.commandHandler.requests).toHaveLength(1);
    expect(chain.commandHandler.requests[0].command).toBe('status');
    expect(chain.botApi.messagesFor(CHAT_A)).toHaveLength(1);
  });

  it('the malformed entries are individually decided (rejected or ignored), not executed', async () => {
    const chain = makeRealChain();
    chain.botApi.defaultUpdates = [...malformedBatch(), makeCommandUpdate(777, USER_A, CHAT_A)];

    await runCycle(chain.service);

    const reasons = chain.audit.events.map((event) => reasonOf(event));
    // Strict validation rejects the shapeless entries; the non-command
    // message and the callback are ignored; exactly one command executes.
    expect(reasons).toContain('UPDATE_INVALID');
    expect(reasons).toContain('NON_COMMAND_MESSAGE');
    expect(reasons).toContain('UNSUPPORTED_UPDATE');
    expect(reasons).toContain('COMMAND_EXECUTED');
    expect(reasons).not.toContain('COMMAND_ERROR');
  });

  it('forward progress is guaranteed: the next cycle is past every delivered update_id', async () => {
    const chain = makeRealChain();
    const valid = makeCommandUpdate(777, USER_A, CHAT_A);
    chain.botApi.defaultUpdates = [...malformedBatch(), valid];

    await runCycle(chain.service);
    await runCycle(chain.service);

    // The numeric-id entries (777 handled, 900 ignored, 901 ignored) were
    // all acked via the offset; the poller never stalls below them.
    expect(chain.botApi.offsetsRequested[1]).toBeGreaterThan(777);
  });
});
