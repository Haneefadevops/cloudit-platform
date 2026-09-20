/**
 * NestJS module for the AI shadow-mode adapter (Phase E).
 *
 * The coordinator composes this at integration: real KillSwitchService,
 * BudgetService, findings/drift sources and (later, gated) the HTTP LlmClient
 * are bound through the tokens in tokens.ts. Read-model sources are optional
 * and default to fail-closed stand-ins so the module also compiles standalone.
 */

import { DynamicModule, Module, Provider } from '@nestjs/common';
import { AiAdapterOptions, AiAdapterService, BudgetGate, AiGate } from './ai-adapter.service';
import {
  AiMaintenanceReadModel,
  AiMaintenanceReadModelOptions,
  defaultBudgetSummarySource,
  defaultDriftSource,
  defaultFindingsSource,
  defaultKillSwitchSource,
  FindingsSource,
} from './read-model';
import { LlmClient } from './llm';
import {
  AI_AUDIT,
  AI_BUDGET_GATE,
  AI_BUDGET_SUMMARY_SOURCE,
  AI_CLIENT,
  AI_DRIFT_SOURCE,
  AI_ENVIRONMENT_KEY,
  AI_FINDINGS_SOURCE,
  AI_GATE,
  AI_KILL_SWITCH_SOURCE,
  AI_NOW,
} from './tokens';

export interface AiModuleOptions {
  /** AI adapter settings (coordinator copies from AgentConfigService.ai). */
  ai: AiAdapterOptions['ai'];
  /** Injected LLM port. Fake in tests; real HTTP client is a gated later piece. */
  client: LlmClient;
  /** Budget enforcement port (canCall/record). */
  budget: BudgetGate;
  /** Kill-switch gate (assertEnabled). */
  gate: AiGate;
  /** Optional audit sink; one closed event per assess() call. */
  audit?: { record(event: unknown): unknown };
  /** Read-model ports; fail-closed defaults when omitted. */
  findings?: FindingsSource;
  budgetSummary?: AiMaintenanceReadModelOptions['budget'];
  killSwitchStates?: AiMaintenanceReadModelOptions['killSwitches'];
  driftSummary?: AiMaintenanceReadModelOptions['drift'];
  environmentKey?: string;
  now?: () => number;
}

@Module({})
export class AiModule {
  static register(options: AiModuleOptions): DynamicModule {
    const providers: Provider[] = [
      { provide: AI_CLIENT, useValue: options.client },
      { provide: AI_BUDGET_GATE, useValue: options.budget },
      { provide: AI_GATE, useValue: options.gate },
      { provide: AI_AUDIT, useValue: options.audit ?? null },
      { provide: AI_FINDINGS_SOURCE, useValue: options.findings ?? defaultFindingsSource() },
      {
        provide: AI_BUDGET_SUMMARY_SOURCE,
        useValue: options.budgetSummary ?? defaultBudgetSummarySource(),
      },
      {
        provide: AI_KILL_SWITCH_SOURCE,
        useValue: options.killSwitchStates ?? defaultKillSwitchSource(),
      },
      { provide: AI_DRIFT_SOURCE, useValue: options.driftSummary ?? defaultDriftSource() },
      { provide: AI_ENVIRONMENT_KEY, useValue: options.environmentKey ?? 'default' },
      { provide: AI_NOW, useValue: options.now ?? (() => Date.now()) },
      {
        provide: AiAdapterService,
        useFactory: (
          client: LlmClient,
          budget: BudgetGate,
          gate: AiGate,
          audit: { record(event: unknown): unknown } | null,
          now: () => number,
        ) =>
          new AiAdapterService({
            ai: options.ai,
            client,
            budget,
            gate,
            audit: audit ?? undefined,
            now,
          }),
        inject: [AI_CLIENT, AI_BUDGET_GATE, AI_GATE, AI_AUDIT, AI_NOW],
      },
      {
        provide: AiMaintenanceReadModel,
        useFactory: (
          findings: FindingsSource,
          budget: AiMaintenanceReadModelOptions['budget'],
          killSwitches: AiMaintenanceReadModelOptions['killSwitches'],
          drift: AiMaintenanceReadModelOptions['drift'],
          environmentKey: string,
          now: () => number,
        ) =>
          new AiMaintenanceReadModel({
            findings,
            budget,
            killSwitches,
            drift,
            environmentKey,
            now,
          }),
        inject: [
          AI_FINDINGS_SOURCE,
          AI_BUDGET_SUMMARY_SOURCE,
          AI_KILL_SWITCH_SOURCE,
          AI_DRIFT_SOURCE,
          AI_ENVIRONMENT_KEY,
          AI_NOW,
        ],
      },
    ];

    return {
      module: AiModule,
      providers,
      exports: [AiAdapterService, AiMaintenanceReadModel],
    };
  }
}
