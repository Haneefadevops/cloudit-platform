import { AgentConfigService } from '../src/config/agent-config.service';

describe('Telegram configuration (coordinator)', () => {
  const envKeys = [
    'TELEGRAM_COMMANDS_ENABLED',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_WEBHOOK_SECRET',
    'TELEGRAM_ALLOWED_USER_IDS',
    'TELEGRAM_ALLOWED_CHAT_IDS',
  ] as const;

  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = {};
    for (const key of envKeys) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of envKeys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('defaults to fully disabled with empty allowlists', () => {
    const config = new AgentConfigService().get();
    expect(config.telegramCommandsEnabled).toBe(false);
    expect(config.telegram.botToken).toBeUndefined();
    expect(config.telegram.webhookSecret).toBeUndefined();
    expect(config.telegram.allowedUserIds).toEqual([]);
    expect(config.telegram.allowedChatIds).toEqual([]);
  });

  it('fails closed when enabled without token, secret or allowlists', () => {
    process.env.TELEGRAM_COMMANDS_ENABLED = 'true';
    expect(() => new AgentConfigService()).toThrow(/TELEGRAM_BOT_TOKEN/);

    process.env.TELEGRAM_BOT_TOKEN = 'test-token-123456';
    expect(() => new AgentConfigService()).toThrow(/WEBHOOK_SECRET/);

    process.env.TELEGRAM_WEBHOOK_SECRET = 'whsec-test-123456';
    expect(() => new AgentConfigService()).toThrow(/ALLOWED_USER_IDS/);

    process.env.TELEGRAM_ALLOWED_USER_IDS = '123456789';
    expect(() => new AgentConfigService()).toThrow(/ALLOWED_CHAT_IDS/);

    process.env.TELEGRAM_ALLOWED_CHAT_IDS = '123456789';
    const config = new AgentConfigService().get();
    expect(config.telegramCommandsEnabled).toBe(true);
    expect(config.telegram.allowedUserIds).toEqual([123456789]);
  });

  it('parses comma-separated allowlists and rejects malformed ids', () => {
    process.env.TELEGRAM_ALLOWED_USER_IDS = '111, 222 ,333';
    process.env.TELEGRAM_ALLOWED_CHAT_IDS = '444';
    const config = new AgentConfigService().get();
    expect(config.telegram.allowedUserIds).toEqual([111, 222, 333]);
    expect(config.telegram.allowedChatIds).toEqual([444]);

    process.env.TELEGRAM_ALLOWED_USER_IDS = 'not-a-number';
    expect(() => new AgentConfigService()).toThrow(/ALLOWED_USER_IDS/);
  });
});
