/**
 * Shared synthetic fixtures for the Phase D Telegram security suite
 * (Worker C). Everything here is obviously fake: synthetic bot token,
 * synthetic webhook secret, synthetic Telegram ids in the 900xxx range and
 * secret-canary values that mirror the contract fixtures in
 * `@cloudit/operations-agent-contracts`.
 *
 * This file is intentionally free of imports from the Phase D worker modules
 * (`src/telegram/webhook`, `src/telegram/commands`) so it can be smoke-checked
 * standalone while those modules are being built in parallel.
 */

import type { CommandRequest, CommandResponse } from '../../src/telegram';

// --- synthetic credentials (fake only, never real secrets) ---

export const TEST_BOT_TOKEN = 'test-bot-token-123456:AAFAKEfakefakefakefakeFAKEfakefake000';
export const TEST_WEBHOOK_SECRET = 'test-webhook-secret-123456';
export const WRONG_SECRET_SAME_LENGTH = 'test-webhook-secret-123457';
export const WRONG_SECRET_OTHER_LENGTH = 'not-the-webhook-secret';
/** Same length as the real secret, but the first 'e' is Cyrillic (U+0435). */
export const HOMOGLYPH_SECRET = 'test-webhook-s\u0435cret-123456';

export const SECRET_HEADER_NAME = 'x-telegram-bot-api-secret-token';

// --- synthetic Telegram identities ---

export const ALLOWED_USER_ID = 900001;
export const ALLOWED_USER_2_ID = 900003;
export const ALLOWED_CHAT_ID = 900002;
export const FOREIGN_USER_ID = 900101;
export const FOREIGN_CHAT_ID = 900102;
export const GROUP_CHAT_ID = -100900099;

export const FIRST_UPDATE_ID = 910000001;

// --- secret canaries (mirror SECRET_CANARY_FIXTURES in the contracts pkg) ---

export const CANARY_AWS_KEY_ID = 'AKIAFAKECANARY000000';
export const CANARY_EMAIL = 'fake@example-canary.test';
export const CANARY_URL = 'https://canary.invalid/fake-canary';
export const CANARY_TEXT = `token=${CANARY_AWS_KEY_ID} email=${CANARY_EMAIL} url=${CANARY_URL}`;

let updateIdCounter = FIRST_UPDATE_ID;

/** Monotonic synthetic update ids so replay tests never collide by accident. */
export function nextUpdateId(): number {
  updateIdCounter += 1;
  return updateIdCounter;
}

export function resetUpdateIds(): void {
  updateIdCounter = FIRST_UPDATE_ID;
}

export interface UpdateOverrides {
  updateId?: number;
  chatId?: number;
  userId?: number;
  text?: string;
  /** Extra top-level fields merged into the update (unknown-field probes). */
  extraFields?: Record<string, unknown>;
  /** Full raw replacement; used to forge malformed updates. */
  raw?: Record<string, unknown>;
}

/** Builds a valid synthetic `message` update; ids default to the allowlisted pair. */
export function buildUpdate(overrides: UpdateOverrides = {}): Record<string, unknown> {
  if (overrides.raw !== undefined) return overrides.raw;
  const message: Record<string, unknown> = {
    chat: { id: overrides.chatId ?? ALLOWED_CHAT_ID },
    from: { id: overrides.userId ?? ALLOWED_USER_ID },
  };
  if (overrides.text !== undefined) message.text = overrides.text;
  return {
    update_id: overrides.updateId ?? nextUpdateId(),
    message,
    ...(overrides.extraFields ?? {}),
  };
}

export function buildBody(update: unknown): string {
  return JSON.stringify(update);
}

/**
 * Builds request headers with the correct secret; pass a different
 * `headerName` to probe case-insensitivity or a `secret` to probe forgery.
 */
export function authedHeaders(
  secret: string = TEST_WEBHOOK_SECRET,
  headerName: string = SECRET_HEADER_NAME,
): Record<string, string> {
  return { [headerName]: secret };
}

/** Builds request headers with the secret header entirely absent. */
export function noSecretHeaders(): Record<string, string> {
  return {};
}

/** Deterministic injected clock so replay TTL and rate windows are exact. */
export class ManualClock {
  constructor(public current: number = 1_756_161_600_000) {}

  now = (): number => this.current;

  advance(ms: number): void {
    this.current += ms;
  }
}

/** Command handler stub that records every request and returns a fixed reply. */
export class RecordingCommandHandler {
  readonly invocations: CommandRequest[] = [];

  constructor(private readonly response: CommandResponse = { text: 'synthetic command ok' }) {}

  execute(request: CommandRequest): CommandResponse {
    this.invocations.push({ ...request, args: [...request.args] });
    return this.response;
  }
}

/** Audit stub that records every event for later validation. */
export class RecordingAuditSink {
  readonly events: unknown[] = [];

  record(event: unknown): unknown {
    this.events.push(event);
    return undefined;
  }
}

export interface WebhookOptionOverrides {
  commandHandler?: RecordingCommandHandler;
  audit?: RecordingAuditSink;
  now?: () => number;
  receiptTtlMs?: number;
  commandsEnabled?: boolean;
  allowedUserIds?: readonly number[];
  allowedChatIds?: readonly number[];
  maxBodyBytes?: number;
  maxCommandArgs?: number;
  rateLimitPerMinute?: number;
  webhookSecret?: string;
  botToken?: string;
}

/**
 * Builds the TelegramWebhookService constructor options against the shared
 * contract. Defaults: tight allowlist (900001/900002), a 4 KiB body limit,
 * 100 updates/minute (so flood tests opt into a small limit explicitly).
 */
export function buildWebhookOptions(overrides: WebhookOptionOverrides = {}) {
  return {
    telegram: {
      botToken: overrides.botToken ?? TEST_BOT_TOKEN,
      webhookSecret: overrides.webhookSecret ?? TEST_WEBHOOK_SECRET,
      allowedUserIds: overrides.allowedUserIds ?? [ALLOWED_USER_ID],
      allowedChatIds: overrides.allowedChatIds ?? [ALLOWED_CHAT_ID],
      maxBodyBytes: overrides.maxBodyBytes ?? 4096,
      maxCommandArgs: overrides.maxCommandArgs ?? 8,
      rateLimitPerMinute: overrides.rateLimitPerMinute ?? 100,
    },
    commandsEnabled: overrides.commandsEnabled ?? true,
    commandHandler: overrides.commandHandler ?? new RecordingCommandHandler(),
    ...(overrides.audit !== undefined ? { audit: overrides.audit } : {}),
    ...(overrides.now !== undefined ? { now: overrides.now } : {}),
    ...(overrides.receiptTtlMs !== undefined ? { receiptTtlMs: overrides.receiptTtlMs } : {}),
  };
}

/**
 * Structural stub of the Worker B `ReadOnlyEvidencePort`. Return types are
 * deliberately `any`-compatible so the stub stays assignable to the real port
 * once Worker B's view types land; specs only ever feed synthetic values.
 */
export interface StubEvidencePort {
  getStatus(): any;
  listSources(): any[];
  listIncidents(): any[];
  getSyncSummary(): any;
  getBudgetSummary(): any;
  getFinding(key: string): any;
}

export const CLEAN_FINDING_KEY = 'finding-synthetic-clean';
export const CANARY_FINDING_KEY = 'finding-synthetic-canary';

export interface EvidencePortOverrides {
  /** When true, views are laced with the canary text (leak probes). */
  poisoned?: boolean;
}

/** Builds a synthetic read-only evidence port (optionally canary-poisoned). */
export function buildStubEvidencePort(overrides: EvidencePortOverrides = {}): StubEvidencePort {
  const poison = overrides.poisoned === true;
  const tag = poison ? CANARY_TEXT : 'synthetic';
  return {
    getStatus: () => ({
      overall: 'AMBER',
      sourcesTotal: 7,
      sourcesRed: poison ? 1 : 0,
      sourcesAmber: 2,
      openIncidents: 2,
      generatedAt: '2026-09-25T10:00:00.000Z',
    }),
    listSources: () => [{ sourceKey: 'synthetic-source', category: 'AMBER' }],
    listIncidents: () => [
      {
        incidentKey: `incident-synthetic-1-${tag}`,
        severity: 'RED',
        serviceKey: `service-${tag}`,
        state: 'open',
        startedAt: '2026-09-25T09:00:00.000Z',
      },
      {
        incidentKey: 'incident-synthetic-2',
        severity: 'AMBER',
        serviceKey: 'service-b',
        state: 'open',
        startedAt: '2026-09-25T09:30:00.000Z',
      },
    ],
    getSyncSummary: () => ({
      state: poison ? 'DRIFT' : 'MATCH',
      driftCount: poison ? 1 : 0,
      staleCount: 0,
      scannedAt: '2026-09-25T10:00:00.000Z',
    }),
    getBudgetSummary: () => ({
      dayCallsUsed: 3,
      dayCallsMax: 10,
      monthEurUsed: poison ? `9.99 ${tag}` : '1.23',
      monthEurCeiling: 7,
    }),
    getFinding: (key: string) =>
      key === CANARY_FINDING_KEY
        ? {
            findingKey: key,
            severity: 'warning',
            safeTitle: `Finding ${tag}`,
            safeSummary: poison ? `summary ${tag}` : 'synthetic summary',
            recommendedRunbook: 'none',
          }
        : key === CLEAN_FINDING_KEY
          ? {
              findingKey: key,
              severity: 'info',
              safeTitle: 'Synthetic finding',
              safeSummary: 'synthetic summary',
              recommendedRunbook: 'none',
            }
          : undefined,
  };
}
