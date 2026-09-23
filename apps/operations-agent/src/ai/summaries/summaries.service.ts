/**
 * Summaries/answers service (AI-brain phase, KIMI plan 7b Worker B).
 *
 * FROZEN PUBLIC SURFACE (coordinator skeleton). Worker B implements the
 * internals behind this exact signature; Worker C writes blind evals against
 * it. Contract:
 *
 * - fixed prompt templates fed ONLY with already-sanitized observer/digest
 *   views; every evidence text field is treated as untrusted data and
 *   wrapped via the contracts package `labelUntrustedText`;
 * - model output validated with `validateHealthAssessment` (closed schema,
 *   enums, evidence-key membership, bounded summary); refusal, malformed,
 *   contradictory or canary-leaking output collapses to the deterministic
 *   fallback — deterministic checks are ALWAYS authoritative;
 * - gate -> budget -> route -> call -> validate -> record/audit pipeline,
 *   mirroring the shadow-mode adapter; no mutation tool is ever exposed;
 * - `getExplanation` returns bounded plain text safe for Telegram `/explain`.
 *
 * Pipeline (mirrors the shadow-mode adapter): gate.assertEnabled() ->
 * budget.canCall() (deny -> deterministic fallback) -> route via ModelRouter
 * -> closed explanation prompt (finding excerpt wrapped via
 * labelUntrustedText) -> client.complete with a bounded-timeout race ->
 * parse JSON -> validateHealthAssessment -> contradiction check
 * (deterministic always wins) -> secret-canary scan -> cost estimate ->
 * budget.record + one closed audit event. Every failure collapses to the
 * deterministic fallback with costEur 0; getExplanation never rejects.
 */

import {
  HealthAssessment,
  detectCanaryLeak,
  validateHealthAssessment,
} from '@cloudit/operations-agent-contracts';
import { AiAdapterOptions, AiGate, BudgetGate } from '../ai-adapter.service';
import { estimateCostEur } from '../cost';
import { LlmClient, LlmError, LlmRequest, LlmResponse } from '../llm';
import { ModelRouter } from '../model-router';
import { buildExplanationPrompt } from './explanation-prompt';
import {
  SummariesAborted,
  SummariesAuditEvent,
  SummariesOutcomeCode,
  outcomeOf,
} from './outcomes';

export interface SummariesServiceOptions {
  ai: AiAdapterOptions['ai'];
  client: LlmClient;
  budget: BudgetGate;
  gate: AiGate;
  audit?: { record(event: unknown): unknown };
  now?: () => number;
}

export interface GetExplanationInput {
  /** Deterministic verdict produced by the supervisor — ALWAYS authoritative. */
  deterministic: HealthAssessment;
  /** Already-sanitized, bounded finding text; treated as untrusted data. */
  findingSummary: string;
  /** Sanitized evidence hash for audit/correlation. Opaque, no PII. */
  evidenceHash: string;
  ownerRequestedDeepExplanation?: boolean;
}

export interface GetExplanationResult {
  assessment: HealthAssessment;
  /** Bounded plain-text explanation, safe for Telegram. */
  explanation: string;
  /** Model alias used, or 'deterministic' when falling back. */
  model: string;
  fallback: boolean;
  costEur: number;
  tokensIn: number;
  tokensOut: number;
}

const EXPLANATION_MAX_CHARS = 1_000;

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

export class SummariesService {
  private readonly router: ModelRouter;
  private readonly now: () => number;

  constructor(private readonly options: SummariesServiceOptions) {
    this.router = new ModelRouter({
      routineModel: options.ai.routineModel,
      escalationModel: options.ai.escalationModel,
      maxEscalationsPerDay: options.ai.maxEscalationsPerDay,
      now: options.now,
    });
    this.now = options.now ?? (() => Date.now());
  }

  /**
   * Bounded explanation for one sanitized finding. Never rejects: any
   * failure mode (AI disabled, budget denied, model failure, invalid or
   * contradictory output) produces the deterministic fallback with
   * costEur 0.
   */
  async getExplanation(input: GetExplanationInput): Promise<GetExplanationResult> {
    try {
      return await this.attempt(input);
    } catch (error) {
      const outcome = outcomeOf(error);
      return this.fallbackResult(input, outcome);
    }
  }

  private async attempt(input: GetExplanationInput): Promise<GetExplanationResult> {
    // 1. Kill switch. Disabled AI -> deterministic fallback (never throws out).
    try {
      this.options.gate.assertEnabled();
    } catch {
      throw new SummariesAborted('AI_DISABLED');
    }

    // 2. Budget gate. Deny -> deterministic fallback, no call attempted.
    if (!this.options.budget.canCall()) {
      throw new SummariesAborted('BUDGET_DENIED');
    }

    // 3. Route. The summaries service never feeds conflicting signals; the
    //    low-confidence and owner-requested-deep-explanation rules still apply.
    const routing = this.router.decide({
      deterministicStatus: input.deterministic.assessment,
      conflictingSignals: false,
      lowConfidence: input.deterministic.confidence === 'LOW',
      ownerRequestedDeepExplanation: input.ownerRequestedDeepExplanation ?? false,
    });
    const model = this.router.resolveModel(routing);

    // 4. Closed explanation prompt; the finding excerpt is untrusted data.
    const prompt = buildExplanationPrompt({
      deterministic: input.deterministic,
      findingSummary: input.findingSummary,
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

    // 6. Parse strict JSON (fences stripped).
    let parsed: unknown;
    try {
      parsed = parseJsonObject(response.text);
    } catch {
      throw new SummariesAborted('LLM_MALFORMED_JSON');
    }

    // 7. Structural validation (closed schema + enums).
    const validated = validateHealthAssessment(parsed);
    if (!validated.ok) {
      throw new SummariesAborted('LLM_INVALID_ASSESSMENT');
    }

    // 8. Deterministic always wins: any category contradiction discards the
    //    model output.
    if (validated.value.assessment !== input.deterministic.assessment) {
      throw new SummariesAborted('LLM_CONTRADICTS_DETERMINISTIC');
    }

    // 8b. Secret-canary scan: a schema-valid reply echoing secret-shaped
    //     content is discarded just like a contradiction.
    if (detectCanaryLeak(JSON.stringify(validated.value)).leaked) {
      throw new SummariesAborted('LLM_SECRET_CANARY');
    }

    // 9. Cost estimate (verified-derived rate table) + budget record + audit.
    const costEur = estimateCostEur(
      model,
      response.inputTokens,
      response.outputTokens,
      undefined,
      this.options.ai.fxUsdToEur,
    );
    this.options.budget.record(model, response.inputTokens, response.outputTokens, costEur);
    const result: GetExplanationResult = {
      assessment: validated.value,
      explanation: truncate(validated.value.summary, EXPLANATION_MAX_CHARS),
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
    input: GetExplanationInput,
    outcome: Exclude<SummariesOutcomeCode, 'AI_ACCEPTED'>,
  ): GetExplanationResult {
    const result: GetExplanationResult = {
      assessment: input.deterministic,
      explanation: truncate(
        `Deterministic verdict ${input.deterministic.assessment}: ${input.deterministic.summary}`,
        EXPLANATION_MAX_CHARS,
      ),
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
    input: GetExplanationInput,
    reasonCode: SummariesOutcomeCode,
    resultCode: SummariesAuditEvent['resultCode'],
    result: GetExplanationResult,
  ): void {
    if (!this.options.audit) return;
    const event: SummariesAuditEvent = {
      eventType: 'ai_explanation',
      actor: 'agent:summaries',
      occurredAt: new Date(this.now()).toISOString(),
      reasonCode,
      resultCode,
      summary: `AI explanation ${resultCode === 'AI_ACCEPTED' ? 'accepted' : 'replaced by deterministic fallback'} (model=${result.model})`,
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

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?[ \t]*\r?\n?/, '')
    .replace(/\r?\n?```[ \t]*$/, '');
  return JSON.parse(unfenced);
}
