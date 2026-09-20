/**
 * AI shadow-mode adapter (operator-plan sections 4.3, 8, 11.2, 12;
 * KIMI-AI-MAINTENANCE-EXECUTION-PLAN sections 7 and 9).
 *
 * Shadow mode: the deterministic supervisor verdict is ALWAYS authoritative.
 * The model only produces an explanation; any failure, invalid output or
 * contradiction collapses to the deterministic fallback. `assess` never
 * rejects and never performs provider I/O beyond the injected {@link LlmClient}
 * port (tests bind fakes; the real HTTP implementation is a later gated piece).
 *
 * Pipeline: gate.assertEnabled() -> budget.canCall() (deny -> deterministic
 * fallback) -> route via ModelRouter -> closed typed prompt (system separated
 * from evidence; evidence wrapped via labelUntrustedText) -> client.complete
 * (LlmError or unexpected throw -> deterministic fallback) -> parse JSON ->
 * validateHealthAssessment -> contradiction check (deterministic always wins)
 * -> secret-canary scan (schema-valid replies echoing secret-shaped content
 * are discarded) -> budget.record + one audit event. Cost estimate uses a synthetic
 * placeholder rate table (see cost.ts; plan 8.2 requires reverification);
 * costEur is 0 on fallback.
 */

import {
  HealthAssessment,
  detectCanaryLeak,
  validateHealthAssessment,
} from '@cloudit/operations-agent-contracts';
import { estimateCostEur } from './cost';
import { buildDeterministicFallback } from './deterministic-fallback';
import { LlmClient, LlmError, LlmRequest, LlmResponse } from './llm';
import { ModelRouter } from './model-router';
import { buildPrompt } from './prompt-builder';

export interface BudgetGate {
  canCall(): boolean;
  record(model: string, tokensIn: number, tokensOut: number, estimatedEur: number): void;
}

export interface AiGate {
  /** throws a typed safe error when AI is disabled */
  assertEnabled(): void;
}

export interface AiAdapterOptions {
  ai: {
    routineModel: string;
    escalationModel: string;
    requestTimeoutMs: number;
    maxInputTokens: number;
    maxOutputTokens: number;
    maxEscalationsPerDay: number;
  };
  client: LlmClient;
  budget: BudgetGate;
  gate: AiGate;
  audit?: { record(event: unknown): unknown };
  now?: () => number;
}

export interface AiAssessInput {
  /** Deterministic verdict produced by the supervisor — ALWAYS authoritative. */
  deterministic: HealthAssessment;
  conflictingSignals: boolean;
  ownerRequestedDeepExplanation?: boolean;
  /** Sanitized evidence hash for audit/correlation. Opaque, no PII. */
  evidenceHash: string;
}

export interface AiAdapterResult {
  assessment: HealthAssessment;
  /** Model alias used, or 'deterministic' when falling back. */
  model: string;
  fallback: boolean;
  costEur: number;
  tokensIn: number;
  tokensOut: number;
}

/** Closed, safe audit record for one assess() invocation. No raw errors. */
export interface AiAssessmentAuditEvent {
  eventType: 'ai_assessment';
  actor: 'agent:ai-adapter';
  occurredAt: string;
  /** Safe machine-readable outcome code. */
  reasonCode: AiOutcomeCode;
  resultCode: 'AI_ACCEPTED' | 'AI_FALLBACK_DETERMINISTIC';
  /** Fixed bounded template; never contains model free text or errors. */
  summary: string;
  evidenceKeys: string[];
  model: string;
  fallback: boolean;
  tokensIn: number;
  tokensOut: number;
  costEur: number;
}

export type AiOutcomeCode =
  | 'AI_ACCEPTED'
  | 'AI_DISABLED'
  | 'BUDGET_DENIED'
  | 'LLM_TIMEOUT'
  | 'LLM_RATE_LIMITED'
  | 'LLM_SERVER_ERROR'
  | 'LLM_REFUSED'
  | 'LLM_NETWORK_ERROR'
  | 'LLM_INVALID_RESPONSE'
  | 'LLM_MALFORMED_JSON'
  | 'LLM_INVALID_ASSESSMENT'
  | 'LLM_CONTRADICTS_DETERMINISTIC'
  | 'LLM_SECRET_CANARY'
  | 'UNEXPECTED_ERROR';

/** Internal control-flow signal; carries a safe outcome code, never raw text. */
class AssessmentAborted extends Error {
  constructor(readonly outcome: Exclude<AiOutcomeCode, 'AI_ACCEPTED'>) {
    super(outcome);
    this.name = 'AssessmentAborted';
  }
}

function outcomeOf(error: unknown): Exclude<AiOutcomeCode, 'AI_ACCEPTED'> {
  if (error instanceof LlmError) {
    switch (error.code) {
      case 'timeout':
        return 'LLM_TIMEOUT';
      case 'rate_limited':
        return 'LLM_RATE_LIMITED';
      case 'server':
        return 'LLM_SERVER_ERROR';
      case 'refused':
        return 'LLM_REFUSED';
      case 'network':
        return 'LLM_NETWORK_ERROR';
      case 'invalid_response':
        return 'LLM_INVALID_RESPONSE';
    }
  }
  if (error instanceof AssessmentAborted) return error.outcome;
  return 'UNEXPECTED_ERROR';
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?[ \t]*\r?\n?/, '')
    .replace(/\r?\n?```[ \t]*$/, '');
  return JSON.parse(unfenced);
}

export class AiAdapterService {
  private readonly router: ModelRouter;
  private readonly now: () => number;

  constructor(private readonly options: AiAdapterOptions) {
    this.router = new ModelRouter({
      routineModel: options.ai.routineModel,
      escalationModel: options.ai.escalationModel,
      maxEscalationsPerDay: options.ai.maxEscalationsPerDay,
      now: options.now,
    });
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * Shadow-mode assessment. Never rejects: every failure mode produces a
   * deterministic fallback result with costEur 0 and one audit event.
   */
  async assess(input: AiAssessInput): Promise<AiAdapterResult> {
    try {
      return await this.attempt(input);
    } catch (error) {
      const outcome = outcomeOf(error);
      return this.fallbackResult(input, outcome);
    }
  }

  private async attempt(input: AiAssessInput): Promise<AiAdapterResult> {
    // 1. Kill switch. Disabled AI -> deterministic fallback (never throws out).
    try {
      this.options.gate.assertEnabled();
    } catch {
      throw new AssessmentAborted('AI_DISABLED');
    }

    // 2. Budget gate. Deny -> deterministic fallback, no call attempted.
    if (!this.options.budget.canCall()) {
      throw new AssessmentAborted('BUDGET_DENIED');
    }

    // 3. Route. Low-confidence Luna output is derived from the deterministic
    //    verdict confidence (Phase E makes a single call per assessment).
    const routing = this.router.decide({
      deterministicStatus: input.deterministic.assessment,
      conflictingSignals: input.conflictingSignals,
      lowConfidence: input.deterministic.confidence === 'LOW',
      ownerRequestedDeepExplanation: input.ownerRequestedDeepExplanation ?? false,
    });
    const model = this.router.resolveModel(routing);

    // 4. Closed typed prompt; untrusted evidence wrapped via labelUntrustedText.
    const prompt = buildPrompt({
      deterministic: input.deterministic,
      conflictingSignals: input.conflictingSignals,
      ownerRequestedDeepExplanation: input.ownerRequestedDeepExplanation ?? false,
      evidenceHash: input.evidenceHash,
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

    // 6. Parse strict JSON.
    let parsed: unknown;
    try {
      parsed = parseJsonObject(response.text);
    } catch {
      throw new AssessmentAborted('LLM_MALFORMED_JSON');
    }

    // 7. Structural validation (closed schema + enums).
    const validated = validateHealthAssessment(parsed);
    if (!validated.ok) {
      throw new AssessmentAborted('LLM_INVALID_ASSESSMENT');
    }

    // 8. Deterministic always wins (plan 12): any category contradiction
    //    discards the model output.
    if (validated.value.assessment !== input.deterministic.assessment) {
      throw new AssessmentAborted('LLM_CONTRADICTS_DETERMINISTIC');
    }

    // 8b. Secret-canary scan (plan 11.2): a schema-valid reply that echoes
    //     secret-shaped content is discarded just like a contradiction.
    if (detectCanaryLeak(JSON.stringify(validated.value)).leaked) {
      throw new AssessmentAborted('LLM_SECRET_CANARY');
    }

    // 9. Cost estimate (synthetic rate table) + budget record + audit.
    const costEur = estimateCostEur(model, response.inputTokens, response.outputTokens);
    this.options.budget.record(model, response.inputTokens, response.outputTokens, costEur);
    const result: AiAdapterResult = {
      assessment: validated.value,
      model,
      fallback: false,
      costEur,
      tokensIn: response.inputTokens,
      tokensOut: response.outputTokens,
    };
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
    input: AiAssessInput,
    outcome: Exclude<AiOutcomeCode, 'AI_ACCEPTED'>,
  ): AiAdapterResult {
    const result: AiAdapterResult = {
      assessment: buildDeterministicFallback(input.deterministic),
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
    input: AiAssessInput,
    reasonCode: AiOutcomeCode,
    resultCode: AiAssessmentAuditEvent['resultCode'],
    result: AiAdapterResult,
  ): void {
    if (!this.options.audit) return;
    const event: AiAssessmentAuditEvent = {
      eventType: 'ai_assessment',
      actor: 'agent:ai-adapter',
      occurredAt: new Date(this.now()).toISOString(),
      reasonCode,
      resultCode,
      summary: `AI assessment ${resultCode === 'AI_ACCEPTED' ? 'accepted' : 'replaced by deterministic fallback'} (model=${result.model})`,
      evidenceKeys: [input.evidenceHash],
      model: result.model,
      fallback: result.fallback,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      costEur: result.costEur,
    };
    this.options.audit.record(event);
  }
}
