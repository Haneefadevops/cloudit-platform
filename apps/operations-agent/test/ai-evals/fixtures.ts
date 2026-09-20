/**
 * Shared synthetic fixtures for the Phase E adversarial AI evaluation suite
 * (Worker C). Everything here is obviously fake: synthetic model aliases,
 * synthetic evidence keys, synthetic hashes and the secret-canary values that
 * mirror the contract fixtures in `@cloudit/operations-agent-contracts`.
 *
 * This file is intentionally free of imports from the Phase E worker modules
 * (`src/ai`) so it can be smoke-checked standalone while those modules are
 * being built in parallel. The option/builder shapes below mirror the
 * integration contract for `AiAdapterService` and `ModelRouter` exactly;
 * TypeScript reconciles them structurally at integration time.
 */

import type { HealthAssessment, HealthStatus } from '@cloudit/operations-agent-contracts';

// --- synthetic model aliases (mirror src/config/agent-config.service.ts) ---

export const ROUTINE_MODEL = 'gpt-5.6-luna';
export const ESCALATION_MODEL = 'gpt-5.6-terra';

/** Synthetic adapter `ai` block; matches the AgentConfig.ai shape. */
export const SYNTHETIC_AI_CONFIG = {
  routineModel: ROUTINE_MODEL,
  escalationModel: ESCALATION_MODEL,
  requestTimeoutMs: 30_000,
  maxInputTokens: 8_000,
  maxOutputTokens: 1_000,
  maxEscalationsPerDay: 3,
} as const;

// --- deterministic assessment builder (per integration contract) ---

/**
 * Build a valid deterministic {@link HealthAssessment}; override individual
 * fields to plant adversarial content (injections, canaries) in specific
 * channels.
 */
export function makeDeterministic(
  verdict: HealthStatus,
  overrides: Partial<HealthAssessment> = {},
): HealthAssessment {
  return {
    assessment: verdict,
    summary: 'synthetic deterministic assessment',
    evidenceKeys: ['ev.synthetic.1'],
    confidence: 'MEDIUM',
    issueCode: 'NO_ISSUE',
    recommendedRunbook: 'none',
    automationEligibility: 'AUTO_SAFE',
    ...overrides,
  };
}

/**
 * Build a schema-valid model output that an agreeing fake client can return
 * on the happy path (or disagree with on false-alarm/missed-signal paths).
 */
export function makeModelOutput(overrides: Partial<HealthAssessment> = {}): HealthAssessment {
  return {
    assessment: 'GREEN',
    summary: 'synthetic model summary agreeing with the deterministic verdict',
    evidenceKeys: ['ev.synthetic.1'],
    confidence: 'HIGH',
    issueCode: 'NO_ISSUE',
    recommendedRunbook: 'none',
    automationEligibility: 'AUTO_SAFE',
    ...overrides,
  };
}

// --- fake LLM client (structurally assignable to the contract LlmClient) ---

export interface RecordedLlmRequest {
  model: string;
  system: string;
  input: string;
  maxOutputTokens: number;
}

export interface LlmResponseShape {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export type LlmHandler = (request: RecordedLlmRequest) => LlmResponseShape | Promise<LlmResponseShape>;

/**
 * Deterministic fake `LlmClient`: records every request it sees (so evals can
 * inspect the exact prompt the model received) and replies via a fixed
 * handler. Never touches the network.
 */
export class FakeLlmClient {
  readonly calls: RecordedLlmRequest[] = [];

  private constructor(
    private readonly handler: LlmHandler,
    private tokens: { input: number; output: number } = { input: 120, output: 45 },
  ) {}

  /** Override the synthetic token counts this client reports. */
  withTokens(input: number, output: number): FakeLlmClient {
    this.tokens = { input, output };
    return this;
  }

  async complete(request: RecordedLlmRequest): Promise<LlmResponseShape> {
    const recorded = { ...request };
    this.calls.push(recorded);
    const response = await this.handler(recorded);
    return {
      ...response,
      inputTokens: this.tokens.input,
      outputTokens: this.tokens.output,
    };
  }

  /** Fixed text reply (token counts come from `withTokens`, default 120/45). */
  static respondWith(text: string): FakeLlmClient {
    return new FakeLlmClient(() => ({ text, inputTokens: 120, outputTokens: 45 }));
  }

  /** Serialised-JSON reply from a value (valid or malformed by construction). */
  static fromJson(value: unknown): FakeLlmClient {
    return FakeLlmClient.respondWith(JSON.stringify(value));
  }

  /** Schema-valid agreeing (or disagreeing) assessment reply. */
  static fromAssessment(assessment: HealthAssessment): FakeLlmClient {
    return FakeLlmClient.fromJson(assessment);
  }

  /** Echoes the full prompt back, simulating a model that repeats its input. */
  static echo(): FakeLlmClient {
    return new FakeLlmClient((request) => ({
      text: `ECHO ${request.system}\n${request.input}`,
      inputTokens: 60,
      outputTokens: 60,
    }));
  }

  /** Throws a fixed error on every call (LlmError or unexpected). */
  static throwing(error: Error): FakeLlmClient {
    return new FakeLlmClient(() => {
      throw error;
    });
  }
}

/**
 * Attach a synthetic failure `code` to an error regardless of the LlmError
 * constructor arity, so unavailable-model evals work even if the constructor
 * signature drifts during integration. Immutable error types (e.g. a frozen
 * LlmError) are respected: when the error already carries the requested code
 * it is returned unchanged.
 */
export function withCode<T extends Error>(error: T, code: string): T {
  if ((error as { code?: unknown }).code === code) return error;
  Object.defineProperty(error, 'code', { value: code, enumerable: true, configurable: true });
  return error;
}

// --- budget / gate / audit stubs ---

export interface BudgetRecord {
  model: string;
  tokensIn: number;
  tokensOut: number;
  estimatedEur: number;
}

/** Budget stub with toggleable `canCall()` and a recording sink. */
export class RecordingBudget {
  readonly records: BudgetRecord[] = [];
  allowed = true;

  canCall(): boolean {
    return this.allowed;
  }

  record(model: string, tokensIn: number, tokensOut: number, estimatedEur: number): void {
    this.records.push({ model, tokensIn, tokensOut, estimatedEur });
  }
}

/** Kill-switch gate stub; assertEnabled() throws only when configured to. */
export class StubGate {
  constructor(private readonly disabledError?: Error) {}

  assertEnabled(): void {
    if (this.disabledError) throw this.disabledError;
  }
}

/** Audit sink that records every event verbatim for structural assertions. */
export class RecordingAuditSink {
  readonly events: unknown[] = [];

  record(event: unknown): unknown {
    this.events.push(event);
    return event;
  }
}

/** Deterministic injected clock so UTC-day escalation windows are exact. */
export class ManualClock {
  constructor(public current: number) {}

  now = (): number => this.current;

  set(current: number): void {
    this.current = current;
  }

  advance(ms: number): void {
    this.current += ms;
  }
}

// --- adapter/router option builders (mirror the integration contract) ---

export interface AdapterBudgetShape {
  canCall(): boolean;
  record(model: string, tokensIn: number, tokensOut: number, estimatedEur: number): void;
}

export interface AdapterGateShape {
  assertEnabled(): void;
}

export interface AdapterAuditShape {
  record(event: unknown): unknown;
}

/** Mirrors the `AiAdapterService` constructor options exactly. */
export interface AiAdapterOptionsShape {
  ai: {
    routineModel: string;
    escalationModel: string;
    requestTimeoutMs: number;
    maxInputTokens: number;
    maxOutputTokens: number;
    maxEscalationsPerDay: number;
  };
  client: {
    complete(request: {
      model: string;
      system: string;
      input: string;
      maxOutputTokens: number;
    }): Promise<{ text: string; inputTokens: number; outputTokens: number }>;
  };
  budget: AdapterBudgetShape;
  gate: AdapterGateShape;
  audit?: AdapterAuditShape;
  now?: () => number;
}

export interface BuildAdapterOptionsOverrides {
  client?: FakeLlmClient;
  budget?: RecordingBudget;
  gate?: StubGate;
  audit?: RecordingAuditSink;
  now?: () => number;
  ai?: Partial<AiAdapterOptionsShape['ai']>;
}

export function buildAdapterOptions(overrides: BuildAdapterOptionsOverrides = {}): AiAdapterOptionsShape {
  const options: AiAdapterOptionsShape = {
    ai: { ...SYNTHETIC_AI_CONFIG, ...overrides.ai },
    client: overrides.client ?? FakeLlmClient.fromAssessment(makeModelOutput()),
    budget: overrides.budget ?? new RecordingBudget(),
    gate: overrides.gate ?? new StubGate(),
    ...(overrides.audit !== undefined ? { audit: overrides.audit } : {}),
    ...(overrides.now !== undefined ? { now: overrides.now } : {}),
  };
  return options;
}

/** Mirrors the `ModelRouter` constructor options exactly. */
export interface ModelRouterOptionsShape {
  routineModel: string;
  escalationModel: string;
  maxEscalationsPerDay: number;
  now?: () => number;
}

export function buildRouterOptions(
  overrides: Partial<ModelRouterOptionsShape> = {},
): ModelRouterOptionsShape {
  return {
    routineModel: ROUTINE_MODEL,
    escalationModel: ESCALATION_MODEL,
    maxEscalationsPerDay: 3,
    ...overrides,
  };
}

/**
 * Full AgentConfig-shaped stub (mirrors src/config/agent-config.service.ts,
 * including the `ai` and `telegram` blocks) for any eval that needs to prove
 * the adapter options line up with validated runtime configuration. Synthetic
 * values only.
 */
export function makeAgentConfigStub() {
  return {
    aiEnabled: true,
    telegramCommandsEnabled: false,
    autoRemediationEnabled: false,
    repairMasterEnabled: false,
    aiMonthlyEurCeiling: 7,
    aiDailyCallMax: 10,
    operationsApiBaseUrl: 'http://127.0.0.1:3017',
    n8nApiBaseUrl: 'http://127.0.0.1:5678',
    syncScanIntervalMs: 900_000,
    telegram: {
      botToken: undefined,
      webhookSecret: undefined,
      allowedUserIds: [] as readonly number[],
      allowedChatIds: [] as readonly number[],
      maxBodyBytes: 65_536,
      maxCommandArgs: 8,
      rateLimitPerMinute: 20,
    },
    ai: { ...SYNTHETIC_AI_CONFIG },
  };
}

// --- structural prompt assertions (operator-plan 11.2) ---

/**
 * Assert that the prompt the fake client saw quarantines untrusted evidence
 * data away from instructions: at least two sections, an 'evidence' label
 * before the untrusted data, and the untrusted string never appearing before
 * that label. Marker wording is intentionally not asserted.
 */
export function assertEvidenceQuarantined(input: string, untrusted: string): void {
  const sections = input.split(/\r?\n[ \t]*(?:[-=]{3,}[ \t]*)?\r?\n/);
  expect(sections.length).toBeGreaterThanOrEqual(2);
  const dataIndex = input.indexOf(untrusted);
  expect(dataIndex).toBeGreaterThanOrEqual(0);
  const labelIndex = input.slice(0, dataIndex).search(/evidence/i);
  expect(labelIndex).toBeGreaterThanOrEqual(0);
}

/** Recursively collect every string value carried by an unknown event/object. */
export function collectStrings(value: unknown, into: string[] = []): string[] {
  if (typeof value === 'string') {
    into.push(value);
    return into;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, into);
    return into;
  }
  if (typeof value === 'object' && value !== null) {
    for (const item of Object.values(value)) collectStrings(item, into);
  }
  return into;
}

/** Shape used by tenant-isolation evals: ids of other environments/tenants. */
export const TENANT_SHAPED_PATTERN = /\b(?:ten|tenant|client|env)_[a-z0-9]/i;
