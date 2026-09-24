// Chat engine — public API (Worker A, chat-bind phase).
// Exported shapes are contractual: the coordinator wires this service into
// Nest DI and the Telegram layer binds it blind.
export {
  ChatAnswerInput,
  ChatAnswerResult,
  ChatServiceOptions,
  ChatService,
} from './chat.service';
export {
  ChatMemoryStore,
  ChatMemoryStoreOptions,
  ChatTurn,
  CHAT_MEMORY_MAX_TURNS_DEFAULT,
  CHAT_MEMORY_TTL_MS_DEFAULT,
} from './memory';
export {
  BuiltChatPrompt,
  ChatEvidenceContext,
  ChatPromptInput,
  ChatVerdict,
  buildChatPrompt,
  buildDeterministicChatBrief,
  CHAT_ANSWER_MAX_CHARS,
} from './chat-prompt';
export {
  ChatAborted,
  ChatAuditEvent,
  ChatOutcomeCode,
  outcomeOf,
} from './outcomes';
