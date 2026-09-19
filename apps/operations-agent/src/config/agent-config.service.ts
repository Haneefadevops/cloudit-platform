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
    };
    if (this.config.aiMonthlyEurCeiling > 15) {
      throw new Error('AI_MONTHLY_EUR_CEILING must not exceed the EUR 15 owner budget');
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
