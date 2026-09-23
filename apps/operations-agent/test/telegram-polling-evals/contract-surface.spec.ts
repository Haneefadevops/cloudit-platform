/**
 * Eval suite 1: contract surface (chat phase). The sibling-owned modules must
 * export exactly the integration contract the coordinator pinned in
 * `src/telegram/telegram.types.ts`:
 *
 *  - `src/telegram/polling` (Worker A): a constructible polling service that
 *    accepts its dependencies by injection (botApi port, the existing webhook
 *    pipeline, telegram settings, kill switch) and exposes one cycle entry
 *    point. A poller that reaches for the network or a real Telegram client
 *    instead of the injected ports is a FINDING.
 *  - `src/telegram/bot-api` (Worker B): a `createTelegramBotApiClient`
 *    factory returning the two-method TelegramBotApiClient port and
 *    validating its options fail-closed (no token, empty token, non-string
 *    token are all rejected before any network concept exists).
 *
 * A present-but-differently-shaped module is a FINDING and fails here; an
 * absent module skips (see fixtures).
 */

import {
  constructPolling,
  cycleMethod,
  describeBotApi,
  describePolling,
  FakeBotApiClient,
  FakeWebhook,
  makeCommandUpdate,
  makePollingOptions,
  pollingModules,
  CHAT_A,
  USER_A,
} from './fixtures';

describe('polling modules — contract surface', () => {
  describePolling('polling service construction and injection', () => {
    it('is constructible with injected botApi + webhook + options', () => {
      const botApi = new FakeBotApiClient();
      const webhook = new FakeWebhook();
      const service = constructPolling(makePollingOptions({ botApi, webhook }));
      expect(typeof cycleMethod(service)).toBe('function');
    });

    it('drives the INJECTED botApi port on a cycle (no network, no real client)', async () => {
      const botApi = new FakeBotApiClient();
      const webhook = new FakeWebhook();
      botApi.defaultUpdates = [makeCommandUpdate(1, USER_A, CHAT_A)];
      const service = constructPolling(makePollingOptions({ botApi, webhook }));

      await cycleMethod(service)();

      // The fake port saw the poll; nothing reached for a real Telegram API.
      expect(botApi.getUpdatesCalls).toBe(1);
      // The fake pipeline saw the raw update and the fake port got the reply.
      expect(webhook.handledCount).toBe(1);
      expect(botApi.deliveredMessages).toEqual([{ chatId: CHAT_A, text: 'synthetic reply: ok' }]);
    });

    it('tolerates a factory export (createTelegramPollingService) as well as a class', () => {
      const mod = pollingModules.polling!;
      expect(
        typeof mod.TelegramPollingService === 'function' ||
          typeof mod.createTelegramPollingService === 'function',
      ).toBe(true);
    });
  });

  describeBotApi('bot-api factory contract', () => {
    const factory = () => {
      const create = pollingModules.botApi!.createTelegramBotApiClient!;
      return create;
    };

    it('returns an object exposing getUpdates and sendMessage functions', () => {
      const client = factory()({ botToken: 'synthetic-token-value' });
      expect(typeof client.getUpdates).toBe('function');
      expect(typeof client.sendMessage).toBe('function');
      expect(client.getUpdates.length).toBe(1);
      expect(client.sendMessage.length).toBe(2);
    });

    it('rejects options without a botToken (fail-closed)', () => {
      expect(() => factory()({})).toThrow();
    });

    it('rejects an empty botToken', () => {
      expect(() => factory()({ botToken: '' })).toThrow();
    });

    it('rejects a non-string botToken', () => {
      expect(() => factory()({ botToken: 12345 })).toThrow();
      expect(() => factory()({ botToken: null })).toThrow();
    });

    it('keeps the token out of the returned client surface (no enumerable token material)', () => {
      const token = 'synthetic-token-value-that-must-not-surface';
      const client = factory()({ botToken: token });
      expect(JSON.stringify(client)).not.toContain(token);
      expect(String(client)).not.toContain(token);
    });
  });
});
