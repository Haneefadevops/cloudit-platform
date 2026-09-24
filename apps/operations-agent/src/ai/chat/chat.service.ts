/**
 * Natural-language chat engine (chat-bind phase).
 *
 * Free-text operator questions (routed from Telegram by the coordinator) are
 * answered by the model ONLY from a small, already-sanitized evidence snapshot
 * the caller supplies, plus a short in-memory conversation window. Contract:
 *
 * - fixed prompt templates; every free-text field (evidence lines, budget
 *   line, prior memory turns, the operator's own question) is untrusted data
 *   wrapped via the contracts package `labelUntrustedText`;
 * - model output is validated deterministically: empty, oversized or
 *   canary-leaking output collapses to the deterministic fallback — checks
 *   are ALWAYS authoritative over model text;
 * - gate -> budget -> route -> call -> validate -> record/audit pipeline,
 *   mirroring SummariesService; no mutation tool is ever exposed and the
 *   model is told to say so honestly when the evidence does not cover the
 *   question;
 * - conversation memory is a bounded, TTL'd in-process cushion
 *   (see memory.ts), remembered ONLY for accepted answers, never on fallback;
 * - `ask` never rejects: disabled/budget-denied produce fixed refusal text,
 *   every other failure produces a deterministic brief assembled from the
 *   context, all with costEur 0 and one closed audit event.
 *
 * Pipeline (mirrors SummariesService.getExplanation): gate.assertEnabled() ->
 * budget.canCall() (deny -> refusal) -> route via ModelRouter (chat never
 * feeds conflicting signals; UNKNOWN verdicts count as low confidence) ->
 * closed chat prompt -> client.complete with a bounded-timeout race ->
 * empty/oversize/canary validation -> cost estimate -> budget.record + one
 * closed audit event -> memory.remember on success only.
 */

import { detectCanaryLeak } from '@cloudit/operations-agent-contracts';
import { AiAdapterOptions, AiGate, BudgetGate } from '../ai-adapter.service';
import { estimateCostEur } from '../cost';
import { LlmClient, LlmError, LlmRequest, LlmResponse } from '../llm';
import { ModelRouter } from '../model-router';
import {
  buildChatPrompt,
  buildDeterministicChatBrief,
  CHAT_ANSWER_MAX_CHARS,
  ChatEvidenceContext,
} from './chat-prompt';
import { ChatMemoryStore } from './memory';
import { ChatAborted, ChatAuditEvent, ChatOutcomeCode, outcomeOf } from './outcomes';

export interface ChatServiceOptions {
  ai: AiAdapterOptions['ai'];
  client: LlmClient;
  budget: BudgetGate;
  gate: AiGate;
  audit?: { record(event: unknown): unknown };
  now?: () => number;
  /** Optional pre-built memory store (shared or test-injected). */
  memory?: ChatMemoryStore;
}

export interface ChatAnswerInput {
  /**
   * Opaque conversation key supplied by the caller (the coordinator passes
   * `${chatId}:${userId}`). Used only to scope the in-memory turn store.
   */
  userKey: string;
  /** Operator free-text question; treated as untrusted data. */
  question: string;
  /** Small, already-sanitized grounding snapshot for the current window. */
  context: ChatEvidenceContext;
}

export interface ChatAnswerResult {
  /** Bounded plain-text answer (model or deterministic), safe for chat delivery. */
  text: string;
  /** Model alias used, or 'deterministic' when falling back. */
  model: string;
  fallback: boolean;
  costEur: number;
  tokensIn: number;
  tokensOut: number;
}

const USER_KEY_AUDIT_MAX_CHARS = 128;

export class ChatService {
  private readonly router: ModelRouter;
  private readonly now: () => number;
  private readonly memory: ChatMemoryStore;

  constructor(private readonly options: ChatServiceOptions) {
    this.router = new ModelRouter({
      routineModel: options.ai.routineModel,
      escalationModel: options.ai.escalationModel,
      maxEscalationsPerDay: options.ai.maxEscalationsPerDay,
      now: options.now,
    });
    this.now = options.now ?? (() => Date.now());
    this.memory = options.memory ?? new ChatMemoryStore({ now: options.now });
  }

  /**
   * Answer one operator question. Never rejects: disabled AI and exhausted
   * budget produce fixed refusal text; any model failure, empty, oversized or
   * canary-leaking output produces the deterministic fallback brief. All
   * failure modes report fallback=true, model='deterministic', costEur 0 and
   * are never written to memory.
   */
  async ask(input: ChatAnswerInput): Promise<ChatAnswerResult> {
    try {
      return await this.attempt(input);
    } catch (error) {
      const outcome = outcomeOf(error);
      return this.fallbackResult(input, outcome);
    }
  }

  private async attempt(input: ChatAnswerInput): Promise<ChatAnswerResult> {
    // 1. Kill switch. Disabled AI -> fixed refusal (never throws out).
    try {
      this.options.gate.assertEnabled();
    } catch {
      throw new ChatAborted('AI_DISABLED');
    }

    // 2. Budget gate. Deny -> refusal with budget context, no call attempted.
    if (!this.options.budget.canCall()) {
      throw new ChatAborted('BUDGET_DENIED');
    }

    // 3. Route. Chat never feeds conflicting signals; an UNKNOWN overall
    //    verdict means the deterministic supervisor could not decide, which
    //    routes like a low-confidence result.
    const routing = this.router.decide({
      deterministicStatus: input.context.overallVerdict,
      conflictingSignals: false,
      lowConfidence: input.context.overallVerdict === 'UNKNOWN',
      ownerRequestedDeepExplanation: false,
    });
    const model = this.router.resolveModel(routing);

    // 4. Closed chat prompt; evidence, memory turns and question are
    //    untrusted data wrapped via labelUntrustedText inside the builder.
    const prompt = buildChatPrompt({
      context: input.context,
      question: input.question,
      memory: this.memory.recall(input.userKey),
      maxOutputTokens: this.options.ai.maxOutputTokens,
    });
    const request: LlmRequest = {
      model,
      system: prompt.system,
      input: prompt.user,
      maxOutputTokens: this.options.ai.maxOutputTokens,
    };

    // 5. Model call with timeout guard; LlmError/unexpected throw -> fallback.
    const response = await this.completeWithTimeout(request);

    // 6. Deterministic validation — ALWAYS authoritative over model text.
    const text = typeof response.text === 'string' ? response.text.trim() : '';
    if (!text) {
      throw new ChatAborted('LLM_EMPTY_RESPONSE');
    }
    if (text.length > CHAT_ANSWER_MAX_CHARS) {
      throw new ChatAborted('LLM_OVERSIZED_RESPONSE');
    }
    if (detectCanaryLeak(text).leaked) {
      throw new ChatAborted('LLM_SECRET_CANARY');
    }

    // 7. Cost estimate (verified-derived rate table) + budget record + audit.
    const costEur = estimateCostEur(
      model,
      response.inputTokens,
      response.outputTokens,
      undefined,
      this.options.ai.fxUsdToEur,
    );
    this.options.budget.record(model, response.inputTokens, response.outputTokens, costEur);
    const result: ChatAnswerResult = {
      text,
      model,
      fallback: false,
      costEur,
      tokensIn: response.inputTokens,
      tokensOut: response.outputTokens,
    };
    // 8. Remember ONLY accepted answers; fallbacks never reach memory.
    this.memory.remember(input.userKey, input.question, text);
    this.recordAudit(input, 'AI_ACCEPTED', 'AI_ACCEPTED', result);
    return result;
  }

  private async completeWithTimeout(request: LlmRequest): Promise<LlmResponse> {
    const timeoutMs = this.options.ai.requestTimeoutMs;
    const pending = this.options.client.complete(request);
    // Keep the losing side of the race from surfacing as an unhandled
    // rejection when the timeout wins.
    void pending.catch(() => undefined);
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      return pending;
    }
    const timeout = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new LlmError('timeout')), timeoutMs);
      timer.unref?.();
    });
    return Promise.race([pending, timeout]);
  }

  private fallbackResult(
    input: ChatAnswerInput,
    outcome: Exclude<ChatOutcomeCode, 'AI_ACCEPTED'>,
  ): ChatAnswerResult {
    let text: string;
    if (outcome === 'AI_DISABLED') {
      text =
        'AI chat is disabled by the operator right now. Ask again once the AI capability is re-enabled.';
    } else if (outcome === 'BUDGET_DENIED') {
      text = `AI chat is unavailable: the daily AI budget is exhausted (${input.context.budgetLine}). Ask again once the budget resets.`;
    } else {
      text = buildDeterministicChatBrief(input.context);
    }
    const result: ChatAnswerResult = {
      text,
      model: 'deterministic',
      fallback: true,
      costEur: 0,
      tokensIn: 0,
      tokensOut: 0,
    };
    this.recordAudit(input, outcome, 'AI_FALLBACK_DETERMINISTIC', result);
    return result;
  }

  private recordAudit(
    input: ChatAnswerInput,
    reasonCode: ChatOutcomeCode,
    resultCode: ChatAuditEvent['resultCode'],
    result: ChatAnswerResult,
  ): void {
    if (!this.options.audit) return;
    const event: ChatAuditEvent = {
      eventType: 'ai_chat',
      actor: 'agent:chat',
      occurredAt: new Date(this.now()).toISOString(),
      reasonCode,
      resultCode,
      summary: `AI chat answer ${resultCode === 'AI_ACCEPTED' ? 'accepted' : 'replaced by deterministic fallback'} (model=${result.model})`,
      userKey:
        input.userKey.length > USER_KEY_AUDIT_MAX_CHARS
          ? `${input.userKey.slice(0, USER_KEY_AUDIT_MAX_CHARS - 1)}…`
          : input.userKey,
      evidenceKeys: [],
      model: result.model,
      fallback: result.fallback,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      costEur: result.costEur,
    };
    this.options.audit.record(event);
  }
}
