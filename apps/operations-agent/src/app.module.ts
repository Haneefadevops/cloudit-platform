import { Module, Provider } from '@nestjs/common';
import { AgentConfigModule } from './config/agent-config.module';
import { AgentConfigService } from './config/agent-config.service';
import {
  AiAdapterService,
  AiAssessmentAuditEvent,
  AiGate,
  AiMaintenanceReadModel,
  BudgetGate,
  LlmClient,
  LlmError,
} from './ai';
import {
  defaultBudgetSummarySource,
  defaultDriftSource,
  defaultFindingsSource,
  defaultKillSwitchSource,
} from './ai/read-model';
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
} from './ai/tokens';
import { PlatformModule } from './platform/platform.module';
import { AuditService } from './platform/audit/audit.service';
import { BudgetService } from './platform/budget/budget.service';
import { KillSwitchService } from './platform/kill-switch/kill-switch.service';
import { SupervisorModule } from './supervisor/supervisor.module';
import { SyncModule } from './sync/sync.module';
import { TelegramCommandsModule } from './telegram/commands/telegram-commands.module';
import { TelegramWebhookModule } from './telegram/webhook/telegram-webhook.module';

const AI_ENVIRONMENT_KEY_VALUE = 'default';

/**
 * Fail-closed LLM client (operator-plan section 8.2). The real HTTP provider
 * client is a later, separately gated piece: model aliases and pricing must
 * be reverified before any live call. Until it is bound, every attempt fails
 * closed to the deterministic fallback (outcome LLM_REFUSED). No network, no
 * keys, no provider contact.
 */
const failClosedLlmClient: LlmClient = {
  complete: () => Promise.reject(new LlmError('refused')),
};

/**
 * AI runtime bindings (Phase E). Optional-injection pattern matches the
 * supervisor module: with PlatformModule present (application context) the
 * ports bind to the global append-only AuditService, BudgetService and
 * KillSwitchService; standalone compilations fail closed instead.
 */
const aiProviders: Provider[] = [
  { provide: AI_CLIENT, useValue: failClosedLlmClient },
  {
    provide: AI_BUDGET_GATE,
    useFactory: (budget: BudgetService | undefined): BudgetGate =>
      budget
        ? {
            canCall: () => budget.checkBudget().allowed,
            record: (model, tokensIn, tokensOut, estimatedEur) => {
              budget.recordUsage({ model, tokensIn, tokensOut, estimatedEur });
            },
          }
        : { canCall: () => false, record: () => undefined },
    inject: [{ token: BudgetService, optional: true }],
  },
  {
    provide: AI_GATE,
    useFactory: (killSwitches: KillSwitchService | undefined): AiGate =>
      killSwitches
        ? { assertEnabled: () => killSwitches.assertCanRun('ai') }
        : {
            assertEnabled: () => {
              throw new Error('AI kill switch service unavailable (fail closed)');
            },
          },
    inject: [{ token: KillSwitchService, optional: true }],
  },
  {
    provide: AI_AUDIT,
    useFactory: (audit: AuditService | undefined) => {
      if (!audit) return null;
      let sequence = 0;
      return {
        record: (event: unknown) => {
          // Adapt the adapter's closed event into the contracts AuditEvent:
          // the audit schema is closed, so AI-specific telemetry stays in the
          // adapter; only safe codes and the bounded summary cross the port.
          const aiEvent = event as Partial<AiAssessmentAuditEvent> | null;
          if (!aiEvent || aiEvent.eventType !== 'ai_assessment') {
            return audit.record(event);
          }
          sequence += 1;
          return audit.record({
            eventId: `evt-ai-${AI_ENVIRONMENT_KEY_VALUE}-${sequence}`,
            environmentKey: AI_ENVIRONMENT_KEY_VALUE,
            eventType: aiEvent.eventType,
            actor: aiEvent.actor,
            occurredAt: aiEvent.occurredAt,
            reasonCode: aiEvent.reasonCode,
            resultCode: aiEvent.resultCode,
            summary: aiEvent.summary,
            evidenceKeys: aiEvent.evidenceKeys,
          });
        },
      };
    },
    inject: [{ token: AuditService, optional: true }],
  },
  // Read-model sources stay on their fail-closed defaults in Phase E; binding
  // real findings/drift/budget summaries to the portal is a later gated piece.
  { provide: AI_FINDINGS_SOURCE, useValue: defaultFindingsSource() },
  { provide: AI_BUDGET_SUMMARY_SOURCE, useValue: defaultBudgetSummarySource() },
  { provide: AI_KILL_SWITCH_SOURCE, useValue: defaultKillSwitchSource() },
  { provide: AI_DRIFT_SOURCE, useValue: defaultDriftSource() },
  { provide: AI_ENVIRONMENT_KEY, useValue: AI_ENVIRONMENT_KEY_VALUE },
  { provide: AI_NOW, useValue: () => Date.now() },
  {
    provide: AiAdapterService,
    useFactory: (
      client: LlmClient,
      budget: BudgetGate,
      gate: AiGate,
      audit: { record(event: unknown): unknown } | null,
      now: () => number,
      config: AgentConfigService,
    ) =>
      new AiAdapterService({
        ai: config.get().ai,
        client,
        budget,
        gate,
        audit: audit ?? undefined,
        now,
      }),
    inject: [AI_CLIENT, AI_BUDGET_GATE, AI_GATE, AI_AUDIT, AI_NOW, AgentConfigService],
  },
  {
    provide: AiMaintenanceReadModel,
    useFactory: (
      findings: ReturnType<typeof defaultFindingsSource>,
      budget: ReturnType<typeof defaultBudgetSummarySource>,
      killSwitches: ReturnType<typeof defaultKillSwitchSource>,
      drift: ReturnType<typeof defaultDriftSource>,
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

/**
 * Application composition (coordinator-owned).
 *
 * PlatformModule is global and provides the append-only audit store, kill
 * switches, budget meter and job/outbox ports. SupervisorModule and SyncModule
 * bind their audit ports to that shared store via optional injection.
 *
 * The sync module's observation sources (manifest, live n8n, portal
 * catalogue) are intentionally unbound in Phase C: scans fail closed until
 * read-only adapters are added in a later gated phase.
 *
 * The Telegram composition (Phase D) is inert by default: the webhook service
 * is constructed but rejects every request while the kill switch is off, and
 * nothing opens a network listener or contacts Telegram. The evidence port
 * defaults to the synthetic in-memory implementation until a real read-only
 * adapter is bound under a later gate.
 *
 * The AI composition (Phase E) is likewise inert by default: the adapter is
 * constructed with the platform budget meter and the 'ai' kill switch, but
 * the LLM port is a fail-closed stand-in (no provider client exists yet) and
 * the 'ai' switch is off, so any attempt collapses to the deterministic
 * fallback. Read-model sources fail closed until real projections are bound
 * under a later gate.
 */
@Module({
  imports: [
    AgentConfigModule,
    PlatformModule,
    SupervisorModule.register(),
    SyncModule,
    TelegramCommandsModule,
    TelegramWebhookModule.register({ imports: [TelegramCommandsModule] }),
  ],
  providers: aiProviders,
  exports: [AiAdapterService, AiMaintenanceReadModel],
})
export class AppModule {}
