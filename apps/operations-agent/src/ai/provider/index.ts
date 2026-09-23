// Provider client — public API (Worker A, AI-brain phase).
// Exported shapes are contractual: Worker C writes evals against them blind.
export {
  OpenAiResponsesClientOptions,
  OpenAiResponsesLlmClient,
} from './openai-responses.client';
