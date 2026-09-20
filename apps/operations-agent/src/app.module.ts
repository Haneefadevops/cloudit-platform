import { Module, Provider } from '@nestjs/common';
import { AgentConfigModule } from './config/agent-config.module';
import { AgentConfigService } from './config/agent-config.service';
import {
  AiAdapterService,
  AiGate,
  AiMaintenanceReadModel,
  BudgetGate,
  LlmClient,
  LlmError,
} from './ai';
import {
  AiMaintenanceReadModelOptions,
  FindingsSource,
  defaultBudgetSummarySource,
  defaultKillSwitchSource,
} from './ai/read-model';
import {
  budgetSummaryBinding,
  driftBinding,
  findingsBinding,
  killSwitchStatesBinding,
} from './ai-bindings';
import { AlertEngine, AlertMessage } from './alerts';
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
import { DURABLE_OUTBOX, DurableOutbox } from './platform/outbox/durable-outbox';
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
 * Fail-closed Telegram sender (Phase F). The real sendMessage client is a
 * later, separately gated piece; until it is bound every dispatch attempt
 * rejects, which drives the engine's honest outage path: the alert is queued
 * to the durable outbox and audited. Nothing contacts Telegram.
 */
const failClosedAlertSender = {
  send(_message: AlertMessage): Promise<never> {
    return Promise.reject(new Error('Telegram sender is not bound (fail closed)'));
  },
};

/** Adapted audit port shared by the AI adapter and the alert engine. */
const APP_AUDIT_PORT = 'APP_AUDIT_PORT';

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
    provide: APP_AUDIT_PORT,
    useFactory: (audit: AuditService | undefined) => {
      if (!audit) return null;
      let aiSequence = 0;
      let alertSequence = 0;
      return {
        record: (event: unknown) => {
          // Adapt the workers' closed events into the contracts AuditEvent:
          // the audit schema is closed, so module-specific telemetry stays
          // in the producer; only safe codes and bounded summaries cross.
          const produced = event as
            | ({ eventType?: unknown } & Record<string, unknown>)
            | null;
          if (
            !produced ||
            (produced.eventType !== 'ai_assessment' && produced.eventType !== 'alert_dispatch')
          ) {
            return audit.record(event);
          }
          const sequence =
            produced.eventType === 'ai_assessment' ? (aiSequence += 1) : (alertSequence += 1);
          const prefix = produced.eventType === 'ai_assessment' ? 'evt-ai' : 'evt-alerts';
          return audit.record({
            eventId: `${prefix}-${AI_ENVIRONMENT_KEY_VALUE}-${sequence}`,
            environmentKey: AI_ENVIRONMENT_KEY_VALUE,
            eventType: produced.eventType,
            actor: produced.actor,
            occurredAt: produced.occurredAt,
            reasonCode: produced.reasonCode,
            resultCode: produced.resultCode,
            summary: produced.summary,
            evidenceKeys: produced.evidenceKeys,
          });
        },
      };
    },
    inject: [{ token: AuditService, optional: true }],
  },
  { provide: AI_AUDIT, useExisting: APP_AUDIT_PORT },
  // Read-model sources: budget and kill-switch states bind to the real
  // platform services (Phase F bindings); findings and drift stay fail-closed
  // until real read-only projections exist for the AI view (Worker B
  // documented that supervisor findings are structurally incompatible and
  // sync scans are unbound in this phase).
  { provide: AI_FINDINGS_SOURCE, useValue: findingsBinding(undefined) },
  {
    provide: AI_BUDGET_SUMMARY_SOURCE,
    useFactory: (budget: BudgetService | undefined, config: AgentConfigService | undefined) =>
      budget && config
        ? budgetSummaryBinding(budget, config)
        : defaultBudgetSummarySource(),
    inject: [{ token: BudgetService, optional: true }, { token: AgentConfigService, optional: true }],
  },
  {
    provide: AI_KILL_SWITCH_SOURCE,
    useFactory: (killSwitches: KillSwitchService | undefined) =>
      killSwitches ? killSwitchStatesBinding(killSwitches) : defaultKillSwitchSource(),
    inject: [{ token: KillSwitchService, optional: true }],
  },
  { provide: AI_DRIFT_SOURCE, useValue: driftBinding(undefined) },
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
  {
    provide: AlertEngine,
    useFactory: (
      killSwitches: KillSwitchService | undefined,
      outbox: DurableOutbox | undefined,
      auditPort: { record(event: unknown): unknown } | null,
      config: AgentConfigService,
    ) =>
      new AlertEngine({
        gate: killSwitches
          ? { assertEnabled: () => killSwitches.assertCanRun('telegram') }
          : {
              assertEnabled: () => {
                throw new Error('Telegram kill switch service unavailable (fail closed)');
              },
            },
        sender: failClosedAlertSender,
        outbox: outbox
          ? {
              append: (entry: { entryId: string; type: string; payload: unknown }) =>
                outbox.append({
                  entryId: entry.entryId,
                  aggregateType: entry.type,
                  aggregateKey: entry.entryId,
                  payload: entry.payload,
                  occurredAt: new Date().toISOString(),
                }),
            }
          : undefined,
        audit: auditPort ?? undefined,
        maxAlertsPerHour: config.get().alerts?.maxAlertsPerHour ?? 6,
        outageRetryMaxAttempts: config.get().alerts?.outageRetryMaxAttempts ?? 3,
      }),
    inject: [
      { token: KillSwitchService, optional: true },
      { token: DURABLE_OUTBOX, optional: true },
      { token: APP_AUDIT_PORT, optional: true },
      AgentConfigService,
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
 * fallback. The portal read model binds the real budget meter and kill-switch
 * states; findings and drift stay fail-closed until real projections exist.
 *
 * The alert composition (Phase F) is inert by default: the engine is gated
 * by the 'telegram' kill switch (off), and the sender is a fail-closed
 * stand-in — nothing contacts Telegram. An enabled-but-unbound sender would
 * queue alerts to the durable outbox and audit them (the honest outage
 * path), never losing an alert.
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
  exports: [AiAdapterService, AiMaintenanceReadModel, AlertEngine],
})
export class AppModule {}
