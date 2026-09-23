/**
 * Eval suite 4: offset progress and delivery semantics (chat phase).
 *
 * getUpdates is acked exclusively through the offset the poller passes next,
 * so offset discipline IS the delivery contract:
 *
 *  - offset advances to max(update_id)+1 over a fully processed batch,
 *  - an empty batch is a no-op (offset unchanged, no outbound traffic),
 *  - the outbound REPLY is best-effort (coordinator arbitration): a
 *    sendMessage rejection never stalls the queue — once the pipeline
 *    handled and audited an update, the poller acknowledges it. Processing
 *    itself (webhook handle()) stays at-least-once: a handle() failure holds
 *    the offset so the update is re-requested next cycle,
 *  - duplicate update_ids delivered again (a misbehaving/duplicating edge)
 *    produce at most ONE reply per update: the webhook pipeline's replay
 *    dedup must hold through the poller,
 *  - updates within a cycle are processed sequentially, in order.
 *
 * Deterministic fake chain for offset arithmetic and ordering; the REAL
 * webhook pipeline compositor for the dedup property (receipts live in the
 * pipeline, not in the poller).
 */

import {
  describePolling,
  makeCommandUpdate,
  makeFakeChain,
  makeRealChain,
  CHAT_A,
  CHAT_B,
  USER_A,
  USER_B,
} from './fixtures';

describePolling('offset progress — fake chain (deterministic offset arithmetic)', () => {
  it('advances the next requested offset to max(update_id)+1', async () => {
    const chain = makeFakeChain();
    chain.botApi.responder = (offset) => (offset <= 13 ? [11, 12, 13].map((id) => makeCommandUpdate(id, USER_A, CHAT_A)) : []);

    await chain.cycle();
    const base = chain.botApi.offsetsRequested[0];
    expect(chain.botApi.lastOffsetRequested).toBe(base);
    await chain.cycle();

    // max(update_id)+1 over the batch [11,12,13], independent of the base.
    expect(chain.botApi.offsetsRequested[1]).toBe(14);
  });

  it('treats an empty batch as a no-op (offset unchanged, nothing sent)', async () => {
    const chain = makeFakeChain();
    chain.botApi.defaultUpdates = [];

    await chain.cycle();
    await chain.cycle();

    expect(chain.botApi.offsetsRequested[0]).toBe(chain.botApi.offsetsRequested[1]);
    expect(chain.botApi.sendMessageCalls).toBe(0);
    expect(chain.webhook.handledCount).toBe(0);
  });

  it('a send failure does NOT stall the queue: the update is acked (command executed + audited), the reply is best-effort', async () => {
    // Coordinator arbitration (chat phase reconciliation): PROCESSING is
    // at-least-once (a webhook handle() failure holds the offset), but the
    // outbound REPLY is best-effort — once the pipeline handled and audited
    // an update, the poller acknowledges it even if sendMessage fails, so a
    // transport blip can never wedge the polling loop.
    const chain = makeFakeChain();
    const batch = [
      makeCommandUpdate(5, USER_A, CHAT_A),
      makeCommandUpdate(6, USER_B, CHAT_B),
      makeCommandUpdate(7, USER_A, CHAT_A),
    ];
    chain.botApi.responder = (offset) => batch.filter((u) => (u.update_id as number) >= offset);
    let failedOnce = false;
    chain.botApi.sendMessageRule = (chatId) => {
      if (chatId === CHAT_B && !failedOnce) {
        failedOnce = true;
        return new Error('synthetic sendMessage transport failure');
      }
      return undefined;
    };

    await chain.cycle();
    // All three updates were processed and acked despite the send failure.
    expect(chain.webhook.handledCount).toBe(3);
    // The failed reply was lost (best-effort); commands still executed.
    expect(chain.botApi.messagesFor(CHAT_A)).toHaveLength(2);
    expect(chain.botApi.messagesFor(CHAT_B)).toHaveLength(0);

    // The ack becomes visible on the next request: the poll starts past the
    // whole batch (offset 8), not at the failed update.
    await chain.cycle();
    expect(chain.botApi.lastOffsetRequested).toBe(8);
    expect(chain.webhook.handledCount).toBe(3);
    // Nothing left to fetch; the loop stays healthy.
    expect(chain.botApi.lastOffsetRequested).toBe(8);
    expect(chain.webhook.handledCount).toBe(3);
  });

  it('processes updates sequentially, in update_id order', async () => {
    const chain = makeFakeChain();
    chain.botApi.defaultUpdates = [
      makeCommandUpdate(1, USER_A, CHAT_A),
      makeCommandUpdate(2, USER_B, CHAT_B),
      makeCommandUpdate(3, USER_A, CHAT_A),
    ];

    await chain.cycle();

    expect(chain.webhook.handledUpdateIds).toEqual([1, 2, 3]);
    expect(chain.botApi.deliveredMessages.map((message) => message.chatId)).toEqual([
      CHAT_A,
      CHAT_B,
      CHAT_A,
    ]);
  });
});

describePolling('replay dedup — real webhook pipeline through the poller', () => {
  it('duplicate update_ids across cycles produce at most one reply per update', async () => {
    const chain = makeRealChain();
    const firstBatch = [
      makeCommandUpdate(5, USER_A, CHAT_A),
      makeCommandUpdate(6, USER_B, CHAT_B),
      makeCommandUpdate(7, USER_A, CHAT_A),
    ];
    chain.botApi.defaultUpdates = firstBatch;

    await chain.cycle();
    expect(chain.botApi.messagesFor(CHAT_A)).toHaveLength(2);
    expect(chain.botApi.messagesFor(CHAT_B)).toHaveLength(1);
    const afterFirstCycle = chain.botApi.getUpdatesCalls;

    // A duplicating edge: the next poll at offset 8 is (incorrectly) answered
    // with updates 6 and 7 again. The pipeline's replay receipts must absorb
    // them — zero additional replies.
    chain.botApi.byOffset.set(8, [firstBatch[1], firstBatch[2]]);
    await chain.cycle();

    expect(chain.botApi.getUpdatesCalls).toBe(afterFirstCycle + 1);
    expect(chain.botApi.messagesFor(CHAT_A)).toHaveLength(2);
    expect(chain.botApi.messagesFor(CHAT_B)).toHaveLength(1);
    expect(chain.commandHandler.requests).toHaveLength(3);
  });
});
