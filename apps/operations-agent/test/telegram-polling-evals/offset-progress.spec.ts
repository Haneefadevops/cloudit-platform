/**
 * Eval suite 4: offset progress and delivery semantics (chat phase).
 *
 * getUpdates is acked exclusively through the offset the poller passes next,
 * so offset discipline IS the delivery contract:
 *
 *  - offset advances to max(update_id)+1 over a fully processed batch,
 *  - an empty batch is a no-op (offset unchanged, no outbound traffic),
 *  - a mid-batch failure (a sendMessage rejection) must not skip the failed
 *    or any later update: the next cycle re-requests from the failed
 *    update's id (at-least-once),
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

  it('a mid-batch send failure re-requests from the FAILED update (at-least-once, no skip)', async () => {
    const chain = makeFakeChain();
    const failedUpdate = 6;
    const batch = [
      makeCommandUpdate(5, USER_A, CHAT_A),
      makeCommandUpdate(failedUpdate, USER_B, CHAT_B),
      makeCommandUpdate(7, USER_A, CHAT_A),
    ];
    // Offset-aware edge: each poll returns exactly the not-yet-acked updates.
    chain.botApi.responder = (offset) => batch.filter((u) => (u.update_id as number) >= offset);
    let failedOnce = false;
    chain.botApi.sendMessageRule = (chatId) => {
      // Fail exactly the first send destined for the failed update's chat.
      if (chatId === CHAT_B && !failedOnce) {
        failedOnce = true;
        return new Error('synthetic sendMessage transport failure');
      }
      return undefined;
    };

    await chain.cycle();
    // Update 5 was processed and acked; 6 failed and 7 must NOT be skipped,
    // so the next cycle MUST start at update 6's id — retrying 6 and 7.
    expect(chain.botApi.offsetsRequested[1]).toBe(failedUpdate);

    await chain.cycle();
    // No update lost: 5 and 7 reached CHAT_A (7 may lawfully be re-delivered
    // under at-least-once retry semantics) and 6 finally reached CHAT_B.
    expect(chain.botApi.messagesFor(CHAT_A).length).toBeGreaterThanOrEqual(2);
    expect(chain.botApi.messagesFor(CHAT_B)).toHaveLength(1);
    expect(chain.botApi.lastOffsetRequested).toBe(8);
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
