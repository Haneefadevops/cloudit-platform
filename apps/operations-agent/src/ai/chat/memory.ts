/**
 * In-memory conversation memory for the chat engine (chat-bind phase).
 *
 * Per-conversation turn store keyed by a caller-supplied opaque string (the
 * coordinator passes `${chatId}:${userId}`). The store is a short-lived
 * conversational cushion, NOT a system of record:
 *
 *  - HARD BOUNDS: at most {@link ChatMemoryStoreOptions.maxTurns} turns are
 *    retained per key; the oldest turns are dropped past the cap.
 *  - A whole conversation is forgotten once it has been idle for
 *    {@link ChatMemoryStoreOptions.ttlMs} (default 30 minutes). Expiry is
 *    lazy: pruning happens on access, driven by the injectable `now` clock
 *    so tests are deterministic.
 *  - Everything lives in process memory; nothing is persisted, logged or
 *    shared across keys. `recall` returns a copy so callers cannot mutate
 *    stored state.
 *
 * Fail-closed: the constructor validates its bounds and rejects
 * non-positive, non-integer or non-finite configuration.
 */

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatMemoryStoreOptions {
  /** Maximum turns retained per key. Defaults to 6. Must be a positive integer. */
  maxTurns?: number;
  /** Idle TTL in milliseconds after which a conversation is forgotten. Defaults to 30 minutes. */
  ttlMs?: number;
  /** Injectable clock (epoch ms) for deterministic tests. */
  now?: () => number;
}

export const CHAT_MEMORY_MAX_TURNS_DEFAULT = 6;
export const CHAT_MEMORY_TTL_MS_DEFAULT = 30 * 60 * 1_000;

interface Conversation {
  turns: ChatTurn[];
  lastAccess: number;
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer, received ${value}`);
  }
}

export class ChatMemoryStore {
  private readonly maxTurns: number;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly conversations = new Map<string, Conversation>();

  constructor(options: ChatMemoryStoreOptions = {}) {
    const maxTurns = options.maxTurns ?? CHAT_MEMORY_MAX_TURNS_DEFAULT;
    const ttlMs = options.ttlMs ?? CHAT_MEMORY_TTL_MS_DEFAULT;
    assertPositiveInteger('maxTurns', maxTurns);
    assertPositiveInteger('ttlMs', ttlMs);
    if (typeof options.now !== 'undefined' && typeof options.now !== 'function') {
      throw new Error('now must be a function returning epoch milliseconds');
    }
    this.maxTurns = maxTurns;
    this.ttlMs = ttlMs;
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * Append one user question and its assistant answer to the conversation,
   * drop the oldest turns past the cap, and refresh the idle TTL. Both
   * strings are stored verbatim as untrusted data; they are only ever
   * re-serialized into the labeled UNTRUSTED prompt section downstream.
   */
  remember(key: string, question: string, answer: string): void {
    const at = this.now();
    const conversation = this.liveConversation(key, at);
    conversation.turns.push(
      { role: 'user', content: question },
      { role: 'assistant', content: answer },
    );
    if (conversation.turns.length > this.maxTurns) {
      conversation.turns.splice(0, conversation.turns.length - this.maxTurns);
    }
    conversation.lastAccess = at;
  }

  /**
   * Return the retained turns for a key (oldest first), or an empty array
   * when the conversation is unknown or its idle TTL has expired. Reading a
   * live conversation refreshes its idle TTL.
   */
  recall(key: string): ChatTurn[] {
    const at = this.now();
    const conversation = this.liveConversation(key, at);
    conversation.lastAccess = at;
    return conversation.turns.map((turn) => ({ ...turn }));
  }

  private liveConversation(key: string, at: number): Conversation {
    const existing = this.conversations.get(key);
    if (existing && at - existing.lastAccess > this.ttlMs) {
      this.conversations.delete(key);
      const forgotten: Conversation = { turns: [], lastAccess: at };
      this.conversations.set(key, forgotten);
      return forgotten;
    }
    if (existing) return existing;
    const created: Conversation = { turns: [], lastAccess: at };
    this.conversations.set(key, created);
    return created;
  }
}
