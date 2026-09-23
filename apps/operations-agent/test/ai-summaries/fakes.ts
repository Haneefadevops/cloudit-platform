/**
 * Shared fakes for the summaries/answers service tests (mirrors
 * test/ai/fixtures.ts patterns). No network, no real keys — the client is
 * always a FakeLlmClient bound by each test.
 */

import { AiGate, BudgetGate } from '../../src/ai';
import { LlmClient, LlmRequest, LlmResponse } from '../../src/ai';

export class FakeLlmClient implements LlmClient {
  calls: LlmRequest[] = [];
  constructor(private readonly handler: (request: LlmRequest) => Promise<LlmResponse>) {}
  complete(request: LlmRequest): Promise<LlmResponse> {
    this.calls.push(request);
    return this.handler(request);
  }
}

export class FakeBudgetGate implements BudgetGate {
  allowed = true;
  records: Array<{ model: string; tokensIn: number; tokensOut: number; estimatedEur: number }> = [];
  canCall(): boolean {
    return this.allowed;
  }
  record(model: string, tokensIn: number, tokensOut: number, estimatedEur: number): void {
    this.records.push({ model, tokensIn, tokensOut, estimatedEur });
  }
}

export class EnabledGate implements AiGate {
  constructor(private readonly enabled = true) {}
  assertEnabled(): void {
    if (!this.enabled) throw new Error('capability "ai" is disabled by kill switch (AI_DISABLED)');
  }
}
