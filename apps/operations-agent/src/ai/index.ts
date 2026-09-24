// AI shadow-mode adapter — public API (Worker A, Phase E).
// Exported shapes are contractual: Worker C writes evals against them blind.
export {
  LlmRequest,
  LlmResponse,
  LlmErrorCode,
  LlmError,
  LlmClient,
} from './llm';
export {
  RoutingInput,
  RoutingDecision,
  EscalationReason,
  ModelRouterOptions,
  ModelRouter,
} from './model-router';
export { buildDeterministicFallback } from './deterministic-fallback';
export {
  BudgetGate,
  AiGate,
  AiAdapterOptions,
  AiAssessInput,
  AiAdapterResult,
  AiAssessmentAuditEvent,
  AiOutcomeCode,
  AiAdapterService,
} from './ai-adapter.service';
export {
  FindingsSource,
  AiMaintenanceReadModelOptions,
  AiMaintenanceReadModel,
} from './read-model';
export { AiModule, AiModuleOptions } from './ai.module';
export {
  OpenAiResponsesClientOptions,
  OpenAiResponsesLlmClient,
} from './provider';
export {
  GetExplanationInput,
  GetExplanationResult,
  SummariesServiceOptions,
  SummariesService,
} from './summaries';
export {
  ChatAnswerInput,
  ChatAnswerResult,
  ChatServiceOptions,
  ChatService,
  ChatMemoryStore,
  ChatMemoryStoreOptions,
  ChatTurn,
  CHAT_MEMORY_MAX_TURNS_DEFAULT,
  CHAT_MEMORY_TTL_MS_DEFAULT,
  ChatEvidenceContext,
  ChatVerdict,
  buildChatPrompt,
  buildDeterministicChatBrief,
  CHAT_ANSWER_MAX_CHARS,
} from './chat';
