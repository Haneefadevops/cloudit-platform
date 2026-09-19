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
    this.logger.log(
      `agent config loaded: ai=${this.config.aiEnabled} telegram=${this.config.telegramCommandsEnabled} ` +
        `remediation=${this.config.autoRemediationEnabled} repairMaster=${this.config.repairMasterEnabled}`,
    );
  }

  get(): AgentConfig {
    return { ...this.config };
  }
}
