/**
 * Chat service registry — the same coordinator seam as
 * telegram/evidence/observer-status.registry.ts, for the same reason: the
 * ChatService provider lives in the AppModule root scope (it needs the LLM
 * client, budget gate, AI gate, audit port and clock tokens), while the
 * Telegram chat responder is bound inside the commands module. The root
 * factory publishes the constructed service exactly once at startup; the
 * responder reads it through this registry. Single agent process,
 * bind-once at composition, read-only afterwards. While nothing is bound
 * (standalone module tests, unconfigured app) the responder degrades to a
 * fixed fail-closed notice instead of answering.
 */
import type { ChatService } from '../ai';

let bound: ChatService | null = null;

export const chatServiceRegistry = {
  bind(service: ChatService | null): void {
    bound = service;
  },
  get(): ChatService | null {
    return bound;
  },
};
