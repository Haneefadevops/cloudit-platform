/**
 * Shared fixtures for the chat-phase blind adversarial evaluation suites
 * (Worker C, blind). Everything here is synthetic: fake bot ids/chats, a
 * fake clock, a scriptable fake TelegramBotApiClient, canary-laced update
 * payloads and the secret-canary values.
 *
 * This file intentionally avoids static imports from
 * `src/telegram/polling` and `src/telegram/bot-api`: Worker A (polling) and
 * Worker B (bot-api) build those modules in parallel against the
 * coordinator-owned contracts in `src/telegram/telegram.types.ts`, and this
 * suite must compile and smoke-check while they are absent. The shapes below
 * mirror those contracts structurally; `loadPollingModules()` resolves the
 * real modules at runtime and every suite degrades to `describe.skip` (with
 * a loud warning) when a module has not landed yet. A
 * present-but-differently-shaped module is a FINDING: the suites assert the
 * contract shape at runtime and fail on mismatch.
 *
 * DOCUMENTED ASSUMPTIONS (isolated here so a reasonable implementation
 * passes; a violated assumption is a coordinator finding, not a reason to
 * weaken a suite):
 *  - The polling module exposes `TelegramPollingService` (constructible with
 *    one options object) or a `createTelegramPollingService(options)`
 *    factory, and the instance exposes one cycle entry point named one of
 *    poll / runCycle / tick / runOnce / cycle (probed in that order by
 *    `cycleMethod()`).
 *  - The poller accepts its dependencies via the options object: `botApi`
 *    (TelegramBotApiClient), `webhook` (the existing
 *    TelegramWebhookService pipeline, reused unchanged), plus settings
 *    (`telegram` block, `commandsEnabled`, `pollIntervalMs`) and optional
 *    `maxUpdatesPerCycle`, `audit`, `now`, `timers`.
 *  - The bot-api module exposes `createTelegramBotApiClient(options)` with
 *    at least a `botToken` option, validating it fail-closed.
 *  - Secret-header handling on the polling path: the webhook pipeline
 *    verifies `x-telegram-bot-api-secret-token` before anything else, so the
 *    poller must present the configured secret when it invokes
 *    `webhook.handle()` on the polling path (the fixtures hand the poller a
 *    `telegram` block whose `webhookSecret` matches the real webhook service
 *    it is also handed). If Worker A's poller instead calls `handle(body,
 *    {})`, every real-chain update is rejected 401 before validation — that
 *    is a coordinator finding, visible as failures concentrated in the
 *    real-chain suites (authorization/dedup/malformed), not a fixtures bug.
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  CommandRequest,
  CommandResponse,
  WebhookOutcome,
} from '../../src/telegram/telegram.types';
import {
  TelegramWebhookService,
  type TelegramWebhookOptions,
} from '../../src/telegram/webhook';

// --- synthetic identities, secrets and instants (all fake) ---

export const TEST_SECRET = 'test-webhook-secret-chat-phase';
export const USER_A = 424242424;
export const CHAT_A = 424242425;
export const USER_B = 434343434;
export const CHAT_B = 434343436;
export const UNKNOWN_USER_ID = 999999999;
export const UNKNOWN_CHAT_ID = 999999998;
export const BASE_NOW_MS = 1_727_000_000_000;

/**
 * Telegram-bot-token-shaped canary (id:35-char-secret form, obviously fake).
 * Used as the synthetic TELEGRAM_BOT_TOKEN value so any reflection of the
 * configured token into errors, replies or sendMessage text is caught.
 */
export const CANARY_BOT_TOKEN =
  '1234567890:AAH9wFakeCanaryChatPhaseValue0123456789abcd';
export const CANARIES = [CANARY_BOT_TOKEN];

// --- contract shape mirrors (structurally pinned to telegram.types.ts) ---

/** TelegramBotApiClient port shape (pinned by the coordinator contract). */
export interface BotApiPortShape {
  getUpdates(offset: number): Promise<unknown[]>;
  sendMessage(chatId: number, text: string): Promise<void>;
}

/** Webhook pipeline port shape (TelegramWebhookService.handle). */
export interface WebhookPortShape {
  handle(rawBody: string, headers: Record<string, string>): Promise<WebhookOutcome>;
}

export interface TelegramSettingsShape {
  botToken?: string;
  webhookSecret?: string;
  allowedUserIds?: readonly number[];
  allowedChatIds?: readonly number[];
  maxBodyBytes?: number;
  maxCommandArgs?: number;
  rateLimitPerMinute?: number;
  pollIntervalMs?: number;
}

/**
 * Options the poller is expected to accept. Every field optional so the
 * fixtures can probe tolerance; suites pass a complete, consistent set.
 */
export interface TelegramPollingOptionsShape {
  botApi?: BotApiPortShape;
  webhook?: WebhookPortShape;
  telegram?: TelegramSettingsShape;
  commandsEnabled?: boolean;
  pollIntervalMs?: number;
  maxUpdatesPerCycle?: number;
  maxReplyChars?: number;
  audit?: { record(event: unknown): unknown };
  now?: () => number;
  timers?: {
    setInterval(fn: () => void, ms: number): unknown;
    clearInterval(handle: unknown): void;
  };
  [key: string]: unknown;
}

export interface TelegramPollingInstanceShape {
  onModuleInit?: () => void;
  onModuleDestroy?: (() => Promise<void>) | (() => void);
  poll?: () => Promise<unknown>;
  runCycle?: () => Promise<unknown>;
  tick?: () => Promise<unknown>;
  runOnce?: () => Promise<unknown>;
  cycle?: () => Promise<unknown>;
  [member: string]: unknown;
}

export interface TelegramPollingModuleShape {
  TelegramPollingService?: new (
    options: TelegramPollingOptionsShape,
  ) => TelegramPollingInstanceShape;
  createTelegramPollingService?: (
    options: TelegramPollingOptionsShape,
  ) => TelegramPollingInstanceShape;
  [exportName: string]: unknown;
}

export interface BotApiOptionsShape {
  botToken?: unknown;
  [key: string]: unknown;
}

export interface BotApiModuleShape {
  createTelegramBotApiClient?: (options: BotApiOptionsShape) => BotApiPortShape;
  [exportName: string]: unknown;
}

export interface LoadedPollingModules {
  polling: TelegramPollingModuleShape | undefined;
  botApi: BotApiModuleShape | undefined;
}

function tryRequire(modulePath: string): unknown {
  try {
    // Runtime-only resolution: the module is built by a sibling worker and may
    // not exist in this worktree yet.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(modulePath) as unknown;
  } catch {
    return undefined;
  }
}

export function loadPollingModules(): LoadedPollingModules {
  const polling = tryRequire('../../src/telegram/polling') as
    | TelegramPollingModuleShape
    | undefined;
  const botApi = tryRequire('../../src/telegram/bot-api') as
    | BotApiModuleShape
    | undefined;
  if (!polling || !botApi) {
    const missing = [
      !polling ? 'src/telegram/polling' : undefined,
      !botApi ? 'src/telegram/bot-api' : undefined,
    ].filter(Boolean);
    // eslint-disable-next-line no-console
    console.warn(
      `telegram-polling-evals: ${missing.join(' and ')} not present in this ` +
        'worktree; polling-dependent suites will be SKIPPED. This is a FINDING ' +
        'until the sibling workers land their modules.',
    );
  }
  return { polling, botApi };
}

export const pollingModules = loadPollingModules();

/** True when the Worker A polling module is present with a constructible service. */
export const describePolling =
  pollingModules.polling &&
  (typeof pollingModules.polling.TelegramPollingService === 'function' ||
    typeof pollingModules.polling.createTelegramPollingService === 'function')
    ? describe
    : describe.skip;

/** True when the Worker B bot-api module is present with its factory. */
export const describeBotApi =
  pollingModules.botApi &&
  typeof pollingModules.botApi.createTelegramBotApiClient === 'function'
    ? describe
    : describe.skip;

/** True when both sibling modules are present (full chain drivable). */
export const CHAIN_AVAILABLE = describePolling === describe && describeBotApi === describe;

/**
 * Constructs the polling service, tolerating either an exported class or a
 * factory function. Isolates the construction-shape assumption in the loader.
 */
export function constructPolling(
  options: TelegramPollingOptionsShape,
): TelegramPollingInstanceShape {
  const mod = pollingModules.polling;
  if (!mod) throw new Error('src/telegram/polling is not present in this worktree');
  if (typeof mod.TelegramPollingService === 'function') {
    return new mod.TelegramPollingService(options);
  }
  if (typeof mod.createTelegramPollingService === 'function') {
    return mod.createTelegramPollingService(options);
  }
  throw new Error(
    'polling module exposes neither TelegramPollingService nor createTelegramPollingService',
  );
}

const CYCLE_METHOD_NAMES = ['poll', 'runCycle', 'tick', 'runOnce', 'cycle'] as const;

/**
 * Resolves the poller's cycle entry point, tolerating the reasonable naming
 * variants. A present module exposing none of them is a FINDING and throws
 * loudly rather than skipping.
 */
export function cycleMethod(instance: TelegramPollingInstanceShape): () => Promise<unknown> {
  for (const name of CYCLE_METHOD_NAMES) {
    const candidate = instance[name];
    if (typeof candidate === 'function') {
      const fn = candidate as () => Promise<unknown>;
      return () => fn.call(instance);
    }
  }
  throw new Error(
    `polling service exposes no cycle method (probed: ${CYCLE_METHOD_NAMES.join('/')})`,
  );
}

/** Runs one poll cycle against a constructed service. */
export async function runCycle(instance: TelegramPollingInstanceShape): Promise<unknown> {
  return cycleMethod(instance)();
}

/** Runs n sequential cycles (each awaited). */
export async function runCycles(instance: TelegramPollingInstanceShape, times: number): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await runCycle(instance);
  }
}

/** Calls onModuleDestroy when present, swallowing nothing. */
export async function destroyPolling(instance: TelegramPollingInstanceShape): Promise<void> {
  if (typeof instance.onModuleDestroy === 'function') {
    await instance.onModuleDestroy();
  }
}

// --- deterministic clock and fake timers ---

export class ManualClock {
  constructor(public current: number) {}

  now = (): number => this.current;

  set(current: number): void {
    this.current = current;
  }

  advance(ms: number): void {
    this.current += ms;
  }

  iso(): string {
    return new Date(this.current).toISOString();
  }
}

interface ScheduledInterval {
  fn: () => void;
  ms: number;
  handle: number;
  cleared: boolean;
}

export class FakeTimerHub {
  readonly intervals: ScheduledInterval[] = [];
  private nextHandle = 1;

  setInterval = (fn: () => void, ms: number): number => {
    const handle = this.nextHandle;
    this.nextHandle += 1;
    this.intervals.push({ fn, ms, handle, cleared: false });
    return handle;
  };

  clearInterval = (handle: unknown): void => {
    const scheduled = this.intervals.find((entry) => entry.handle === handle);
    if (scheduled) scheduled.cleared = true;
  };

  get activeIntervals(): ScheduledInterval[] {
    return this.intervals.filter((entry) => !entry.cleared);
  }

  fire(handle: number, times = 1): void {
    const scheduled = this.intervals.find((entry) => entry.handle === handle);
    if (!scheduled || scheduled.cleared) {
      throw new Error(`fake timer: no active interval for handle ${handle}`);
    }
    for (let i = 0; i < times; i += 1) scheduled.fn();
  }
}

// --- scriptable fake TelegramBotApiClient (records calls, injects failures) ---

export class FakeBotApiClient implements BotApiPortShape {
  /** Every offset passed to getUpdates, in call order. */
  readonly offsetsRequested: number[] = [];
  /** Every sendMessage call (including attempts that were made to fail). */
  readonly sentMessages: Array<{ chatId: number; text: string }> = [];
  /** Only the sendMessage calls that succeeded. */
  readonly deliveredMessages: Array<{ chatId: number; text: string }> = [];
  /** Sequential script consumed one entry per getUpdates call. */
  private readonly script: Array<unknown[] | Error> = [];
  /** Offset-keyed responses; take precedence over the sequential script. */
  readonly byOffset = new Map<number, unknown[] | Error>();
  /**
   * Fully general responder, consulted before byOffset/script. Returning
   * undefined falls through to the other sources. Returning an Error rejects.
   */
  responder: ((offset: number) => unknown[] | Error | undefined) | undefined;
  /** Batch returned when neither responder, byOffset nor script apply. */
  defaultUpdates: unknown[] = [];
  /** When set, every getUpdates rejects. */
  persistentGetUpdatesError: Error | undefined;
  /** When set, every sendMessage rejects (after recording the attempt). */
  persistentSendMessageError: Error | undefined;
  /** Optional per-send rule: return an Error to reject that particular send. */
  sendMessageRule: ((chatId: number, text: string) => Error | undefined) | undefined;
  getUpdatesCalls = 0;
  sendMessageCalls = 0;

  queue(updates: unknown[] | Error): void {
    this.script.push(updates);
  }

  async getUpdates(offset: number): Promise<unknown[]> {
    this.getUpdatesCalls += 1;
    this.offsetsRequested.push(offset);
    if (this.persistentGetUpdatesError) throw this.persistentGetUpdatesError;
    let batch: unknown[] | Error | undefined = this.responder?.(offset);
    if (batch === undefined && this.byOffset.has(offset)) batch = this.byOffset.get(offset);
    if (batch === undefined && this.script.length > 0) batch = this.script.shift();
    if (batch === undefined) batch = this.defaultUpdates;
    if (batch instanceof Error) throw batch;
    return batch;
  }

  async sendMessage(chatId: number, text: string): Promise<void> {
    this.sendMessageCalls += 1;
    this.sentMessages.push({ chatId, text });
    const ruleError = this.sendMessageRule?.(chatId, text);
    if (ruleError) throw ruleError;
    if (this.persistentSendMessageError) throw this.persistentSendMessageError;
    this.deliveredMessages.push({ chatId, text });
  }

  messagesFor(chatId: number): Array<{ chatId: number; text: string }> {
    return this.deliveredMessages.filter((message) => message.chatId === chatId);
  }

  get lastOffsetRequested(): number | undefined {
    return this.offsetsRequested[this.offsetsRequested.length - 1];
  }
}

// --- canned raw Telegram update builders (all synthetic) ---

/** Raw getUpdates-style text message update (untrusted inbound data). */
export function makeTextUpdate(
  updateId: number,
  userId: number,
  chatId: number,
  text: string,
): Record<string, unknown> {
  return {
    update_id: updateId,
    message: {
      message_id: updateId + 1,
      from: { id: userId, is_bot: false, first_name: 'Synthetic' },
      chat: { id: chatId, type: 'private' },
      date: 1_727_000_000,
      text,
    },
  };
}

/** Convenience: an allow-listed /status command update. */
export function makeCommandUpdate(
  updateId: number,
  userId: number,
  chatId: number,
  command = '/status',
): Record<string, unknown> {
  return makeTextUpdate(updateId, userId, chatId, command);
}

/** Raw callback_query update (the webhook pipeline ignores callbacks). */
export function makeCallbackUpdate(updateId: number, userId: number): Record<string, unknown> {
  return {
    update_id: updateId,
    callback_query: {
      id: `callback-${updateId}`,
      from: { id: userId, is_bot: false, first_name: 'Synthetic' },
      message: {
        message_id: 7,
        from: { id: 111111, is_bot: true },
        chat: { id: CHAT_A, type: 'private' },
        date: 1_727_000_000,
        text: '/status',
      },
      data: 'synthetic-callback-data',
    },
  };
}

// --- fake webhook pipeline port (records handles, programmable outcomes) ---

export class FakeWebhook implements WebhookPortShape {
  readonly handled: Array<{ rawBody: string; headers: Record<string, string> }> = [];
  /** Queued outcomes, consumed one per handle() call. */
  readonly outcomes: WebhookOutcome[] = [];
  defaultOutcome: WebhookOutcome = {
    status: 'handled',
    statusCode: 200,
    reply: { text: 'synthetic reply: ok' },
  };
  /** When set, every handle() rejects (after recording). */
  handleError: Error | undefined;
  /** Optional per-call hook; its return value becomes the outcome. */
  handler: ((rawBody: string) => WebhookOutcome | Promise<WebhookOutcome>) | undefined;

  async handle(rawBody: string, headers: Record<string, string>): Promise<WebhookOutcome> {
    this.handled.push({ rawBody, headers });
    if (this.handleError) throw this.handleError;
    if (this.handler) return this.handler(rawBody);
    if (this.outcomes.length > 0) return this.outcomes.shift()!;
    return this.defaultOutcome;
  }

  /** update_ids parsed from handled bodies, in invocation order. */
  get handledUpdateIds(): number[] {
    const ids: number[] = [];
    for (const entry of this.handled) {
      try {
        const parsed = JSON.parse(entry.rawBody) as Record<string, unknown>;
        if (typeof parsed.update_id === 'number') ids.push(parsed.update_id);
      } catch {
        // unparseable bodies simply carry no id
      }
    }
    return ids;
  }

  get handledCount(): number {
    return this.handled.length;
  }
}

// --- recording audit sink / command handler ---

export class RecordingAuditSink {
  readonly events: unknown[] = [];
  throwOnRecord = false;

  record(event: unknown): unknown {
    if (this.throwOnRecord) throw new Error('synthetic audit sink outage');
    this.events.push(event);
    return event;
  }
}

/**
 * Deterministic command handler standing in for the real command layer:
 * fixed-template default reply, programmable per-call responses or errors.
 */
export class RecordingCommandHandler {
  readonly requests: CommandRequest[] = [];
  readonly responses: CommandResponse[] = [];
  defaultResponse: CommandResponse = { text: 'synthetic reply: ok' };
  throwOnExecute: Error | undefined;
  handler:
    | ((request: CommandRequest) => CommandResponse | Promise<CommandResponse>)
    | undefined;

  async execute(request: CommandRequest): Promise<CommandResponse> {
    this.requests.push(request);
    if (this.throwOnExecute) throw this.throwOnExecute;
    if (this.handler) return this.handler(request);
    if (this.responses.length > 0) return this.responses.shift()!;
    return this.defaultResponse;
  }
}

// --- synthetic telegram settings and option builders ---

/** Synthetic telegram settings block shared by the real webhook compositor. */
export function baseTelegramSettings(rateLimitPerMinute = 1000): TelegramWebhookOptions['telegram'] {
  return {
    botToken: CANARY_BOT_TOKEN,
    webhookSecret: TEST_SECRET,
    allowedUserIds: [USER_A, USER_B],
    allowedChatIds: [CHAT_A, CHAT_B],
    maxBodyBytes: 4096,
    maxCommandArgs: 8,
    rateLimitPerMinute,
  };
}

export interface PollingDeps {
  botApi: BotApiPortShape;
  webhook: WebhookPortShape;
  audit?: { record(event: unknown): unknown };
}

/** Complete, consistent polling options; suites override what they probe. */
export function makePollingOptions(
  deps: PollingDeps,
  overrides: Partial<TelegramPollingOptionsShape> = {},
): TelegramPollingOptionsShape {
  return {
    botApi: deps.botApi,
    webhook: deps.webhook,
    telegram: baseTelegramSettings(),
    commandsEnabled: true,
    pollIntervalMs: 10_000,
    maxUpdatesPerCycle: 25,
    ...(deps.audit ? { audit: deps.audit } : {}),
    now: () => BASE_NOW_MS,
    ...overrides,
  };
}

// --- real-chain composition helpers (REAL webhook pipeline + fake botApi) ---

export interface RealChainHarness {
  service: TelegramPollingInstanceShape;
  cycle: () => Promise<unknown>;
  botApi: FakeBotApiClient;
  webhook: TelegramWebhookService;
  commandHandler: RecordingCommandHandler;
  audit: RecordingAuditSink;
  clock: ManualClock;
}

/**
 * Compositor mirroring the observer fixtures' real-chain pattern: REAL
 * TelegramWebhookService (with synthetic settings and a recording command
 * handler) + scriptable fake botApi + the Worker A polling service under
 * test. Nothing between the update payload and the recorded sendMessage is
 * stubbed except the network port.
 */
export function makeRealChain(options: {
  clock?: ManualClock;
  telegram?: Partial<TelegramWebhookOptions['telegram']>;
  commandsEnabled?: boolean;
  polling?: Partial<TelegramPollingOptionsShape>;
} = {}): RealChainHarness {
  const clock = options.clock ?? new ManualClock(BASE_NOW_MS);
  const botApi = new FakeBotApiClient();
  const audit = new RecordingAuditSink();
  const commandHandler = new RecordingCommandHandler();
  const webhook = new TelegramWebhookService({
    telegram: { ...baseTelegramSettings(), ...options.telegram },
    commandsEnabled: options.commandsEnabled ?? true,
    commandHandler,
    audit,
    now: clock.now,
  });
  const service = constructPolling(
    makePollingOptions(
      { botApi, webhook, audit },
      { now: clock.now, commandsEnabled: options.commandsEnabled ?? true, ...options.polling },
    ),
  );
  return { service, cycle: cycleMethod(service), botApi, webhook, commandHandler, audit, clock };
}

export interface FakeChainHarness {
  service: TelegramPollingInstanceShape;
  cycle: () => Promise<unknown>;
  botApi: FakeBotApiClient;
  webhook: FakeWebhook;
  audit: RecordingAuditSink;
}

/** Fake-chain compositor: full control over webhook outcomes and botApi scripting. */
export function makeFakeChain(
  pollingOverrides: Partial<TelegramPollingOptionsShape> = {},
): FakeChainHarness {
  const botApi = new FakeBotApiClient();
  const webhook = new FakeWebhook();
  const audit = new RecordingAuditSink();
  const service = constructPolling(
    makePollingOptions({ botApi, webhook, audit }, pollingOverrides),
  );
  return { service, cycle: cycleMethod(service), botApi, webhook, audit };
}

// --- string harvesting and canary assertions ---

/** Recursively collect every string value carried by an unknown value. */
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

/** Assert no string anywhere inside the given values contains the canary. */
export function expectCanaryFree(values: unknown[], canary = CANARY_BOT_TOKEN): void {
  for (const value of values) {
    for (const text of collectStrings(value)) {
      expect(text).not.toContain(canary);
    }
  }
}

/** First `reasonCode` (or legacy `reason`) property found in an unknown event. */
export function reasonOf(value: unknown): unknown {
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    if ('reasonCode' in record) return record.reasonCode;
    if ('reason' in record) return record.reason;
    for (const item of Object.values(record)) {
      const found = reasonOf(item);
      if (found !== undefined) return found;
    }
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = reasonOf(item);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

// --- source scanning (read-only; optional extra signal while modules land) ---

/** Read a sibling worker's module entry source, or undefined while unbuilt. */
export function pollingSourceText(kind: 'polling' | 'bot-api'): string | undefined {
  const asFile = path.join(__dirname, '..', '..', 'src', 'telegram', `${kind}.ts`);
  if (fs.existsSync(asFile)) return fs.readFileSync(asFile, 'utf8');
  const baseDir = path.join(__dirname, '..', '..', 'src', 'telegram', kind);
  for (const fileName of [`${kind}.ts`, 'telegram-polling.service.ts', 'index.ts']) {
    const filePath = path.join(baseDir, fileName);
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf8');
  }
  return undefined;
}
