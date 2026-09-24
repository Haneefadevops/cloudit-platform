/**
 * Chat responder port: the AI chat seam for free-text Telegram messages
 * (chat-bind phase).
 *
 * The implementation is the AI chat engine (`src/ai/chat`, injected by the
 * coordinator); the command layer only knows this interface. Contract:
 *  - The implementation NEVER rejects: it fails closed internally, turning
 *    provider/transport/prompt failures into a safe bounded fallback text.
 *  - The returned text is sanitized and bounded by the implementation; the
 *    command service additionally runs it through `finalize` (sanitize + cap)
 *    as defense in depth before anything reaches Telegram.
 *  - `question` is the verbatim inbound message text (never split into args)
 *    and is treated as untrusted data, never as an instruction.
 */

/** Minimal AI chat seam consumed by the Telegram command layer. */
export interface ChatResponder {
  /** Answer one free-text operator question; resolves (never rejects). */
  answer(input: { userId: number; chatId: number; question: string }): Promise<{ text: string }>;
}
