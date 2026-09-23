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
  OpenAiResponsesLlmClient,
  SummariesService,
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
import { AlertEngine, AlertMessage, createTelegramSender } from './alerts';
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
import { RemediationEngine } from './remediation';
import { createEvidenceSource, SoakDriver } from './observer';
import { PlatformModule } from './platform/platform.module';
import { AuditService } from './platform/audit/audit.service';
import { BudgetService } from './platform/budget/budget.service';
import { KillSwitchService } from './platform/kill-switch/kill-switch.service';
import { DURABLE_OUTBOX, DurableOutbox } from './platform/outbox/durable-outbox';
import { SupervisorModule } from './supervisor/supervisor.module';
import { SupervisorService } from './supervisor';
import { SyncModule } from './sync/sync.module';
import { TelegramBotApiModule } from './telegram/bot-api/telegram-bot-api.module';
import {
  TELEGRAM_EVIDENCE_PORT,
  TelegramCommandsModule,
} from './telegram/commands';
import { ObserverTelegramEvidence, observerStatusRegistry } from './telegram/evidence';
import {
  TELEGRAM_BOT_API_CLIENT,
  TelegramPollingModule,
} from './telegram/polling/telegram-polling.module';
import { TelegramWebhookModule } from './telegram/webhook/telegram-webhook.module';

const AI_ENVIRONMENT_KEY_VALUE = 'default';

/**
 * Fail-closed LLM client fallback (operator-plan section 8.2). Bound only
 * while AI is disabled or no provider key is configured (the default: no
 * network, no keys, no provider contact). When AI is enabled with a key,
 * aiProviders below replaces this with the real Responses API client; the
 * 'ai' kill switch remains the runtime gate on every call.
 */
const failClosedLlmClient: LlmClient = {
  complete: () => Promise.reject(new LlmError('refused')),
};

/**
 * Fail-closed Telegram sender stand-in, used only while no bot token /
 * allow-listed chat is configured (the default everywhere except the
 * explicitly configured server). Every dispatch attempt rejects, which
 * drives the engine's honest outage path: the alert is queued to the
 * durable outbox and audited. Nothing contacts Telegram.
 */
const failClosedAlertSender = {
  send(_message: AlertMessage): Promise<never> {
    return Promise.reject(new Error('Telegram sender is not bound (fail closed)'));
  },
};

/** Adapted audit port shared by the AI adapter, the alert engine and the remediation engine. */
const APP_AUDIT_PORT = 'APP_AUDIT_PORT';

/**
 * Chat-phase evidence binding (coordinator integration): overrides the
 * commands module's synthetic in-memory fixture with the real observer-backed
 * adapter. The soak driver itself is published through the observer status
 * registry by the SoakDriver provider factory below (root scope), because
 * the driver depends on the whole supervisor/alert graph and cannot be
 * imported into the commands module's DI scope.
 */
const telegramEvidenceProvider: Provider = {
  provide: TELEGRAM_EVIDENCE_PORT,
  useFactory: (budget: BudgetService | undefined, config: AgentConfigService) =>
    new ObserverTelegramEvidence({ soak: () => observerStatusRegistry.get(), budget, config }),
  inject: [{ token: BudgetService, optional: true }, AgentConfigService],
};

/**
 * One shared commands-module registration so the webhook pipeline (nested in
 * the polling module's imports) and nothing else consume the SAME handler
 * instance, built on the real evidence binding.
 */
const telegramCommandsIntegration = TelegramCommandsModule.register({
  evidence: telegramEvidenceProvider,
  imports: [AgentConfigModule],
});

/**
 * AI runtime bindings (Phase E). Optional-injection pattern matches the
 * supervisor module: with PlatformModule present (application context) the
 * ports bind to the global append-only AuditService, BudgetService and
 * KillSwitchService; standalone compilations fail closed instead.
 */
const aiProviders: Provider[] = [
  {
    provide: AI_CLIENT,
    useFactory: (config: AgentConfigService): LlmClient => {
      const ai = config.get().ai;
      // Real provider client only when AI is enabled AND a key is injected;
      // config already fails closed when AI_ENABLED=true without a key, so
      // this branch is unreachable without explicit owner enablement.
      if (config.get().aiEnabled && ai.providerApiKey) {
        return new OpenAiResponsesLlmClient({
          apiKey: ai.providerApiKey,
          baseUrl: ai.providerBaseUrl,
          requestTimeoutMs: ai.requestTimeoutMs,
        });
      }
      return failClosedLlmClient;
    },
    inject: [AgentConfigService],
  },
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
      let remSequence = 0;
      let obsSequence = 0;
      return {
        record: (event: unknown) => {
          // Adapt the workers' closed events into the contracts AuditEvent:
          // the audit schema is closed, so module-specific telemetry stays
          // in the producer; only safe codes and bounded summaries cross.
          const produced = event as
            | ({ eventType?: unknown } & Record<string, unknown>)
            | null;
          const known =
            produced &&
            (produced.eventType === 'ai_assessment' ||
              produced.eventType === 'alert_dispatch' ||
              produced.eventType === 'remediation_proposal' ||
              produced.eventType === 'observer_read' ||
              produced.eventType === 'observer_internal');
          if (!known) {
            return audit.record(event);
          }
          const sequence =
            produced.eventType === 'ai_assessment'
              ? (aiSequence += 1)
              : produced.eventType === 'alert_dispatch'
                ? (alertSequence += 1)
                : produced.eventType === 'remediation_proposal'
                  ? (remSequence += 1)
                  : (obsSequence += 1);
          const prefix =
            produced.eventType === 'ai_assessment'
              ? 'evt-ai'
              : produced.eventType === 'alert_dispatch'
                ? 'evt-alerts'
                : produced.eventType === 'remediation_proposal'
                  ? 'evt-rem'
                  : 'evt-obs';
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
    // AI-brain phase: summaries/answers service behind the same kill switch,
    // budget gate and audit sink as the shadow-mode adapter. The injected
    // client is the fail-closed stand-in until AI is explicitly enabled with
    // a provider key; getExplanation collapses to the deterministic fallback
    // in every disabled/denied/failure case.
    provide: SummariesService,
    useFactory: (
      client: LlmClient,
      budget: BudgetGate,
      gate: AiGate,
      audit: { record(event: unknown): unknown } | null,
      now: () => number,
      config: AgentConfigService,
    ) =>
      new SummariesService({
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
        sender: (() => {
          // Real sender only when the server is explicitly configured with a
          // token and at least one allow-listed chat; otherwise the
          // fail-closed stand-in keeps every dispatch on the audited outage
          // path. Alerts go to the FIRST allow-listed chat ID (the owner
          // decides whether that is a DM or a group when placing secrets).
          const telegram = config.get().telegram;
          return telegram.botToken && telegram.allowedChatIds.length > 0
            ? createTelegramSender({ token: telegram.botToken, chatId: telegram.allowedChatIds[0] })
            : failClosedAlertSender;
        })(),
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
  {
    provide: SoakDriver,
    useFactory: (
      config: AgentConfigService,
      supervisor: SupervisorService,
      alerts: AlertEngine,
      auditPort: { record(event: unknown): unknown } | null,
      budget: BudgetService | undefined,
    ) => {
      // Read-only observation (soak driver): real instance only when the
      // server is explicitly configured with the operations_reader password;
      // without it the observer stays inert (fail closed) and nothing ever
      // touches the operations DB. The SELECT-only role grants are applied by
      // the operations migrations (0012/0013). Either way the constructed
      // driver (or null) is published to the observer status registry so the
      // Telegram evidence adapter binds to it without DI scope gymnastics.
      const observer = config.get().observer;
      if (!observer?.dbPassword) {
        observerStatusRegistry.bind(null);
        return null;
      }
      const driver = new SoakDriver({
        evidence: createEvidenceSource({
          host: observer.dbHost,
          port: observer.dbPort,
          database: observer.dbName,
          user: observer.dbUser,
          password: observer.dbPassword,
        }),
        supervisor,
        alerts,
        audit: auditPort ?? undefined,
        // UNKNOWN-gap fix: the in-process AI budget meter has no DB evidence
        // feed, so the driver reads it directly (read-only) to synthesize the
        // 'ai-budget' digest entry. Without BudgetService the entry stays
        // UNKNOWN (standalone/test contexts).
        budgetStatus: budget
          ? {
              read: (): { category: 'GREEN' | 'AMBER' | 'RED'; summary: string } | undefined => {
                try {
                  const check = budget.checkBudget();
                  if (check.allowed) {
                    return {
                      category: check.warning ? 'AMBER' : 'GREEN',
                      summary:
                        `ai budget: month EUR ${check.month.estimatedEur.toFixed(2)} of ` +
                        `${config.get().aiMonthlyEurCeiling}, ${check.day.calls} call(s) today`,
                    };
                  }
                  if (check.reason === 'MONTHLY_EUR_CEILING_REACHED') {
                    return {
                      category: 'RED',
                      summary: 'ai budget: monthly EUR ceiling reached, AI calls disabled',
                    };
                  }
                  return {
                    category: 'AMBER',
                    summary: 'ai budget: daily call cap reached, AI calls paused until tomorrow',
                  };
                } catch {
                  return undefined;
                }
              },
            }
          : undefined,
        intervalMs: observer.intervalMs,
        digestHourUtc: observer.digestHourUtc,
      });
      observerStatusRegistry.bind(driver);
      return driver;
    },
    inject: [
      AgentConfigService,
      SupervisorService,
      AlertEngine,
      { token: APP_AUDIT_PORT, optional: true },
      { token: BudgetService, optional: true },
    ],
  },
  {
    provide: RemediationEngine,
    useFactory: (auditPort: { record(event: unknown): unknown } | null) =>
      // Simulated remediation (Phase G): propose/approve/reject with replay
      // dedup, lazy expiry and a circuit breaker; the engine executes nothing
      // and is gated by nothing (a proposal is by definition execute-nothing).
      // Defaults: maxFailures 3, cooldownMs 3_600_000.
      new RemediationEngine({ audit: auditPort ?? undefined }),
    inject: [{ token: APP_AUDIT_PORT, optional: true }],
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
 * The Telegram composition (Phase D) is inert by default: the webhook
 * pipeline rejects every request while the kill switch is off, and nothing
 * opens a network listener or contacts Telegram. The command handler is
 * built on the REAL observer-backed evidence adapter: status, incidents and
 * findings render the soak driver's live tick state (NO_DATA / UNEVIDENCED
 * when the observer is unconfigured — never synthetic GREEN), budget renders
 * the platform meter with the enforced limits, and sync renders honestly
 * UNBOUND until the sync sources are bound under a later gate.
 *
 * The chat composition (chat phase) polls Telegram's Bot API over outbound
 * HTTPS only: TELEGRAM_BOT_API_CLIENT is a real client when the server env
 * carries a bot token, otherwise a fail-closed stand-in whose every call
 * rejects; the poller itself is inert while the commands kill switch is off
 * or no token is configured (cycles make no network calls), reuses the
 * webhook pipeline unchanged for validation/dedup/authorization, and never
 * opens an inbound port. Processing is at-least-once; the outbound reply is
 * best-effort so a transport blip can never wedge the loop.
 *
 * The AI composition (Phase E) is likewise inert by default: the adapter is
 * constructed with the platform budget meter and the 'ai' kill switch, but
 * the LLM port is a fail-closed stand-in (no provider client exists yet) and
 * the 'ai' switch is off, so any attempt collapses to the deterministic
 * fallback. The portal read model binds the real budget meter and kill-switch
 * states; findings and drift stay fail-closed until real projections exist.
 *
 * The alert composition (Phase F) is inert by default: the engine is gated
 * by the 'telegram' kill switch (off), so nothing dispatches until the owner
 * enables it on the server. The sender is the real Telegram Bot API sender
 * when the server env provides a token and an allow-listed chat; without
 * that config the fail-closed stand-in keeps every attempt on the audited
 * outage path (queued to the durable outbox, never lost).
 *
 * The remediation composition (Phase G) is execute-nothing by design: the
 * engine proposes Tier-A runbooks, replays dedup while a proposal is live,
 * and records one closed audit event per mutation into the shared store. It
 * touches no external system and no data beyond its in-memory proposal set.
 *
 * The observer composition (soak driver) is read-only and inert by default:
 * without OPERATIONS_DB_PASSWORD the provider resolves to null and nothing
 * touches the operations DB. When the password is placed on the server, the
 * driver ticks on the configured interval, reading evidence through the
 * SELECT-only operations_reader role (grants applied by migrations
 * 0012/0013), feeding the deterministic supervisor and the alert engine
 * (itself gated by the 'telegram' kill switch). A read failure degrades to
 * the cached all-UNKNOWN blind projection so a sustained DB outage pages
 * exactly once and recovers once — the honest watchdog path. The daily
 * digest goes out at most once per UTC day. Observer audit events
 * (observer_read / observer_internal) are adapted into the shared store
 * with independent evt-obs sequencing.
 */
@Module({
  imports: [
    AgentConfigModule,
    PlatformModule,
    SupervisorModule.register(),
    SyncModule,
    TelegramPollingModule.register({
      imports: [
        TelegramWebhookModule.register({ imports: [telegramCommandsIntegration] }),
        TelegramBotApiModule.register(),
      ],
    }),
  ],
  providers: aiProviders,
  exports: [
    AiAdapterService,
    AiMaintenanceReadModel,
    AlertEngine,
    RemediationEngine,
    SoakDriver,
    SummariesService,
  ],
})
export class AppModule {}
