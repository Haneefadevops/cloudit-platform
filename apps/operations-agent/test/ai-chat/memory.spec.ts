/**
 * ChatMemoryStore specs: hard turn cap, lazy TTL pruning on access,
 * per-key isolation and fail-closed constructor validation.
 */

import {
  ChatMemoryStore,
  CHAT_MEMORY_MAX_TURNS_DEFAULT,
  CHAT_MEMORY_TTL_MS_DEFAULT,
} from '../../src/ai';

describe('ChatMemoryStore', () => {
  describe('constructor validation (fail-closed)', () => {
    it('rejects a non-positive or non-integer maxTurns', () => {
      expect(() => new ChatMemoryStore({ maxTurns: 0 })).toThrow();
      expect(() => new ChatMemoryStore({ maxTurns: -1 })).toThrow();
      expect(() => new ChatMemoryStore({ maxTurns: 2.5 })).toThrow();
      expect(() => new ChatMemoryStore({ maxTurns: Number.NaN })).toThrow();
    });

    it('rejects a non-positive or non-integer ttlMs', () => {
      expect(() => new ChatMemoryStore({ ttlMs: 0 })).toThrow();
      expect(() => new ChatMemoryStore({ ttlMs: -100 })).toThrow();
      expect(() => new ChatMemoryStore({ ttlMs: Number.POSITIVE_INFINITY })).toThrow();
    });

    it('applies the documented defaults', () => {
      const store = new ChatMemoryStore();
      expect(CHAT_MEMORY_MAX_TURNS_DEFAULT).toBe(6);
      expect(CHAT_MEMORY_TTL_MS_DEFAULT).toBe(30 * 60 * 1_000);
      store.remember('k', 'q', 'a');
      expect(store.recall('k')).toHaveLength(2);
    });
  });

  describe('remember/recall', () => {
    it('stores a user and an assistant turn and returns them oldest first', () => {
      const store = new ChatMemoryStore({ now: () => 1_000 });
      store.remember('chat:1', 'what is red?', 'two sources are red.');
      expect(store.recall('chat:1')).toEqual([
        { role: 'user', content: 'what is red?' },
        { role: 'assistant', content: 'two sources are red.' },
      ]);
    });

    it('caps retention at 6 turns and drops the oldest', () => {
      let clock = 0;
      const store = new ChatMemoryStore({ now: () => clock });
      // 4 asks -> 8 turns; the 2 oldest (first question + first answer) drop.
      for (let i = 0; i < 4; i += 1) {
        clock += 1;
        store.remember('k', `question ${i}`, `answer ${i}`);
      }
      const turns = store.recall('k');
      expect(turns).toHaveLength(6);
      expect(turns[0]).toEqual({ role: 'user', content: 'question 1' });
      expect(turns[5]).toEqual({ role: 'assistant', content: 'answer 3' });
    });

    it('forgets a conversation 30 minutes after the last access (lazy pruning)', () => {
      let clock = 0;
      const store = new ChatMemoryStore({ now: () => clock });
      store.remember('k', 'q1', 'a1');
      clock += 29 * 60 * 1_000; // 29 minutes idle -> still alive
      expect(store.recall('k')).toHaveLength(2);
      clock += 2 * 60 * 1_000; // 31 since remember, but only 2 since the recall above
      expect(store.recall('k')).toHaveLength(2); // access refreshes the idle window
      clock += 31 * 60 * 1_000; // 31 minutes since the last access -> forgotten
      expect(store.recall('k')).toEqual([]);
    });

    it('a recall within the TTL refreshes the idle window', () => {
      let clock = 0;
      const store = new ChatMemoryStore({ now: () => clock });
      store.remember('k', 'q1', 'a1');
      for (let i = 0; i < 3; i += 1) {
        clock += 20 * 60 * 1_000; // 20-minute gaps, always under 30 since last access
        expect(store.recall('k')).toHaveLength(2);
      }
    });

    it('isolated conversations per key', () => {
      const store = new ChatMemoryStore({ now: () => 0 });
      store.remember('chat:1:user:1', 'q for one', 'a for one');
      store.remember('chat:2:user:9', 'q for two', 'a for two');
      expect(store.recall('chat:1:user:1')).toEqual([
        { role: 'user', content: 'q for one' },
        { role: 'assistant', content: 'a for one' },
      ]);
      expect(store.recall('chat:2:user:9')).toEqual([
        { role: 'user', content: 'q for two' },
        { role: 'assistant', content: 'a for two' },
      ]);
    });

    it('returns copies so callers cannot mutate stored turns', () => {
      const store = new ChatMemoryStore({ now: () => 0 });
      store.remember('k', 'q', 'a');
      const turns = store.recall('k');
      turns[0].content = 'tampered';
      expect(store.recall('k')[0].content).toBe('q');
    });
  });
});
