import { Injectable, Logger } from '@nestjs/common';

/**
 * Typed, validated runtime configuration with safe (disabled) defaults.
 * See the operator plan sections 11.4 (kill switches) and 8.3 (budget).
 */
export interface AgentConfig {
  /** Master AI switch. When false no model call may be attempted. */
  aiEnabled: boolean;
  /** Telegram command switch (Phase D). */
  telegramCommandsEnabled: boolean;
  /** Automatic remediation switch (later phases; never true in Phase C). */
  autoRemediationEnabled: boolean;
  /** Emergency global repair-disable switch; independent of AI/Telegram. */
  repairMasterEnabled: boolean;
  /** Application AI circuit-breaker ceiling in EUR (owner ceiling is 15). */
  aiMonthlyEurCeiling: number;
  /** Maximum AI requests per UTC day. */
  aiDailyCallMax: number;
  /** Fixed private endpoints; never user/model-supplied. */
  operationsApiBaseUrl: string;
  n8nApiBaseUrl: string;
  /** Scan interval for the sync observer. */
  syncScanIntervalMs: number;
  /**
   * Telegram bot settings. Token and webhook secret are runtime secrets:
   * they are read from the environment, never logged, and never required
   * unless the Telegram capability is enabled (fail-closed).
   */
  telegram: {
    botToken: string | undefined;
    webhookSecret: string | undefined;
    allowedUserIds: readonly number[];
    allowedChatIds: readonly number[];
    maxBodyBytes: number;
    maxCommandArgs: number;
    rateLimitPerMinute: number;
    /**
     * Chat phase: outbound getUpdates poll interval (ms). The agent polls
     * Telegram - no inbound port is ever opened. Default 10s, floor 1s.
     * Polling only runs while TELEGRAM_COMMANDS_ENABLED is true.
     */
    pollIntervalMs: number;
  };
  /**
   * AI adapter settings (Phase E). Model aliases are configuration, not
   * verified provider facts; they must be reverified against official
   * documentation before any live enablement (operator-plan 8.2). Nothing in
   * this block can enable AI by itself — aiEnabled remains the master switch.
   */
  ai: {
    routineModel: string;
    escalationModel: string;
    requestTimeoutMs: number;
    maxInputTokens: number;
    maxOutputTokens: number;
    maxEscalationsPerDay: number;
  };
  /**
   * Alert/digest settings (Phase F). Optional so existing full-config test
   * fixtures keep compiling; the service always fills DEFAULTS.alerts when
   * built from the environment. Nothing here enables alerts by itself — the
   * 'telegram' kill switch remains the master gate.
   */
  alerts?: {
    /** Maximum outbound alert messages per rolling UTC hour. */
    maxAlertsPerHour: number;
    /** Bounded retry attempts when the sender is unavailable (outage fallback). */
    outageRetryMaxAttempts: number;
  };
  /**
   * Soak-driver observation settings. Read-only: the agent connects to the
   * operations DB with the SELECT-only operations_reader role. Without a
   * password the observer stays inert (fail closed); nothing writes, ever.
   */
  observer?: {
    dbHost: string;
    dbPort: number;
    dbName: string;
    dbUser: string;
    dbPassword: string | undefined;
    /** Tick interval for evidence reads + assessment. Default 900_000 (15 min). */
    intervalMs: number;
    /** UTC hour (0-23) for the daily digest. Default 7. */
    digestHourUtc: number;
  };
}

const DEFAULTS: AgentConfig = {
  aiEnabled: false,
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
    allowedUserIds: [],
    allowedChatIds: [],
    maxBodyBytes: 65_536,
    maxCommandArgs: 8,
    rateLimitPerMinute: 20,
    pollIntervalMs: 10_000,
  },
  ai: {
    routineModel: 'gpt-5.6-luna',
    escalationModel: 'gpt-5.6-terra',
    requestTimeoutMs: 30_000,
    maxInputTokens: 8_000,
    maxOutputTokens: 1_000,
    maxEscalationsPerDay: 3,
  },
  alerts: {
    maxAlertsPerHour: 6,
    outageRetryMaxAttempts: 3,
  },
  observer: {
    dbHost: 'postgres',
    dbPort: 5432,
    dbName: 'operations',
    dbUser: 'operations_reader',
    dbPassword: undefined,
    intervalMs: 900_000,
    digestHourUtc: 7,
  },
};

function readBoolean(env: NodeJS.ProcessEnv, key: string, fallback: boolean): boolean {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`Invalid boolean for ${key}: expected "true" or "false"`);
}

function readPositiveNumber(env: NodeJS.ProcessEnv, key: string, fallback: number): number {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid positive number for ${key}`);
  }
  return value;
}

function readUrl(env: NodeJS.ProcessEnv, key: string, fallback: string): string {
  const raw = env[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = new URL(raw);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid URL protocol for ${key}`);
  }
  return parsed.toString().replace(/\/$/, '');
}

function readOptionalSecret(env: NodeJS.ProcessEnv, key: string): string | undefined {
  const raw = env[key];
  if (raw === undefined || raw === '') return undefined;
  if (raw.length < 8) throw new Error(`Invalid value for ${key}: too short`);
  return raw;
}

function readIdList(env: NodeJS.ProcessEnv, key: string): readonly number[] {
  const raw = env[key];
  if (raw === undefined || raw.trim() === '') return [];
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part) => {
      const value = Number(part);
      if (!Number.isInteger(value) || value <= 0) {
        throw new Error(`Invalid numeric id in ${key}`);
      }
      return value;
    });
}

@Injectable()
export class AgentConfigService {
  private readonly logger = new Logger(AgentConfigService.name);
  private readonly config: AgentConfig;

  constructor() {
    const env = process.env;
    this.config = {
      aiEnabled: readBoolean(env, 'AI_ENABLED', DEFAULTS.aiEnabled),
      telegramCommandsEnabled: readBoolean(
        env,
        'TELEGRAM_COMMANDS_ENABLED',
        DEFAULTS.telegramCommandsEnabled,
      ),
      autoRemediationEnabled: readBoolean(
        env,
        'AUTO_REMEDIATION_ENABLED',
        DEFAULTS.autoRemediationEnabled,
      ),
      repairMasterEnabled: readBoolean(env, 'REPAIR_MASTER_ENABLED', DEFAULTS.repairMasterEnabled),
      aiMonthlyEurCeiling: readPositiveNumber(
        env,
        'AI_MONTHLY_EUR_CEILING',
        DEFAULTS.aiMonthlyEurCeiling,
      ),
      aiDailyCallMax: readPositiveNumber(env, 'AI_DAILY_CALL_MAX', DEFAULTS.aiDailyCallMax),
      operationsApiBaseUrl: readUrl(env, 'OPERATIONS_API_BASE_URL', DEFAULTS.operationsApiBaseUrl),
      n8nApiBaseUrl: readUrl(env, 'N8N_API_BASE_URL', DEFAULTS.n8nApiBaseUrl),
      syncScanIntervalMs: readPositiveNumber(
        env,
        'SYNC_SCAN_INTERVAL_MS',
        DEFAULTS.syncScanIntervalMs,
      ),
      telegram: {
        botToken: readOptionalSecret(env, 'TELEGRAM_BOT_TOKEN'),
        webhookSecret: readOptionalSecret(env, 'TELEGRAM_WEBHOOK_SECRET'),
        allowedUserIds: readIdList(env, 'TELEGRAM_ALLOWED_USER_IDS'),
        allowedChatIds: readIdList(env, 'TELEGRAM_ALLOWED_CHAT_IDS'),
        maxBodyBytes: readPositiveNumber(env, 'TELEGRAM_MAX_BODY_BYTES', DEFAULTS.telegram.maxBodyBytes),
        maxCommandArgs: readPositiveNumber(
          env,
          'TELEGRAM_MAX_COMMAND_ARGS',
          DEFAULTS.telegram.maxCommandArgs,
        ),
        rateLimitPerMinute: readPositiveNumber(
          env,
          'TELEGRAM_RATE_LIMIT_PER_MINUTE',
          DEFAULTS.telegram.rateLimitPerMinute,
        ),
        pollIntervalMs: readPositiveNumber(
          env,
          'TELEGRAM_POLL_INTERVAL_MS',
          DEFAULTS.telegram.pollIntervalMs,
        ),
      },
      ai: {
        routineModel: env.AI_ROUTINE_MODEL?.trim() || DEFAULTS.ai.routineModel,
        escalationModel: env.AI_ESCALATION_MODEL?.trim() || DEFAULTS.ai.escalationModel,
        requestTimeoutMs: readPositiveNumber(env, 'AI_REQUEST_TIMEOUT_MS', DEFAULTS.ai.requestTimeoutMs),
        maxInputTokens: readPositiveNumber(env, 'AI_MAX_INPUT_TOKENS', DEFAULTS.ai.maxInputTokens),
        maxOutputTokens: readPositiveNumber(env, 'AI_MAX_OUTPUT_TOKENS', DEFAULTS.ai.maxOutputTokens),
        maxEscalationsPerDay: readPositiveNumber(
          env,
          'AI_MAX_ESCALATIONS_PER_DAY',
          DEFAULTS.ai.maxEscalationsPerDay,
        ),
      },
      alerts: {
        maxAlertsPerHour: readPositiveNumber(
          env,
          'ALERTS_MAX_ALERTS_PER_HOUR',
          DEFAULTS.alerts!.maxAlertsPerHour,
        ),
        outageRetryMaxAttempts: readPositiveNumber(
          env,
          'ALERTS_OUTAGE_RETRY_MAX_ATTEMPTS',
          DEFAULTS.alerts!.outageRetryMaxAttempts,
        ),
      },
      observer: {
        dbHost: env.OPERATIONS_DB_HOST?.trim() || DEFAULTS.observer!.dbHost,
        dbPort: readPositiveNumber(env, 'OPERATIONS_DB_PORT', DEFAULTS.observer!.dbPort),
        dbName: env.OPERATIONS_DB_NAME?.trim() || DEFAULTS.observer!.dbName,
        dbUser: env.OPERATIONS_DB_USER?.trim() || DEFAULTS.observer!.dbUser,
        dbPassword: readOptionalSecret(env, 'OPERATIONS_DB_PASSWORD'),
        intervalMs: readPositiveNumber(env, 'OBSERVER_INTERVAL_MS', DEFAULTS.observer!.intervalMs),
        digestHourUtc: (() => {
          const hour = Number(env.OBSERVER_DIGEST_HOUR_UTC ?? DEFAULTS.observer!.digestHourUtc);
          if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
            throw new Error('OBSERVER_DIGEST_HOUR_UTC must be an integer between 0 and 23');
          }
          return hour;
        })(),
      },
    };
    if (this.config.aiMonthlyEurCeiling > 15) {
      throw new Error('AI_MONTHLY_EUR_CEILING must not exceed the EUR 15 owner budget');
    }
    if (this.config.telegramCommandsEnabled) {
      const t = this.config.telegram;
      if (!t.botToken || !t.webhookSecret) {
        throw new Error(
          'TELEGRAM_COMMANDS_ENABLED requires TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET',
        );
      }
      if (t.allowedUserIds.length === 0 || t.allowedChatIds.length === 0) {
        throw new Error(
          'TELEGRAM_COMMANDS_ENABLED requires non-empty TELEGRAM_ALLOWED_USER_IDS and TELEGRAM_ALLOWED_CHAT_IDS',
        );
      }
    }
    if (this.config.telegram!.pollIntervalMs < 1_000) {
      throw new Error('TELEGRAM_POLL_INTERVAL_MS must be at least 1_000 (one second)');
    }
    if (this.config.ai.maxEscalationsPerDay > 10) {
      throw new Error('AI_MAX_ESCALATIONS_PER_DAY must not exceed 10');
    }
    if (this.config.ai.maxOutputTokens > 2_000) {
      throw new Error('AI_MAX_OUTPUT_TOKENS must not exceed 2000 (plan 8.3 target is <= 1000)');
    }
    if (this.config.alerts!.maxAlertsPerHour > 60) {
      throw new Error('ALERTS_MAX_ALERTS_PER_HOUR must not exceed 60');
    }
    if (this.config.alerts!.outageRetryMaxAttempts > 10) {
      throw new Error('ALERTS_OUTAGE_RETRY_MAX_ATTEMPTS must not exceed 10');
    }
    if (this.config.observer!.intervalMs < 60_000) {
      throw new Error('OBSERVER_INTERVAL_MS must be at least 60_000 (one minute)');
    }
    this.logger.log(
      `agent config loaded: ai=${this.config.aiEnabled} telegram=${this.config.telegramCommandsEnabled} ` +
        `remediation=${this.config.autoRemediationEnabled} repairMaster=${this.config.repairMasterEnabled}`,
    );
  }

  get(): AgentConfig {
    return { ...this.config };
  }
}
