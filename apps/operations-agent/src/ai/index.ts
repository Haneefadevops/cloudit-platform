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
