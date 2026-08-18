import { ChatwootService } from './chatwoot.service';

describe('ChatwootService', () => {
  function setup() {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'CHATWOOT_PLATFORM_API_URL') return 'http://chatwoot-rails:3000';
        if (key === 'CHATWOOT_PLATFORM_API_KEY') return 'platform-key';
        if (key === 'CHATWOOT_ADMIN_API_KEY') return 'admin-key';
        return undefined;
      }),
    };
    const service = new ChatwootService(config as never);
    return { service, config };
  }

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a WhatsApp contact with a normalized phone number', async () => {
    const { service } = setup();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        payload: { contact: { id: 1, name: 'Test', phone_number: '+9477' } },
      }),
    });

    await service.createContact(1, '9477', 'Test');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://chatwoot-rails:3000/api/v1/accounts/1/contacts',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Test', phone_number: '+9477' }),
      }),
    );
  });

  it('creates a Messenger/Instagram contact with an identifier', async () => {
    const { service } = setup();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        payload: { contact: { id: 2, name: 'Messenger User', phone_number: null } },
      }),
    });

    await service.createContact(1, undefined, 'Messenger User', 'PSID-123');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://chatwoot-rails:3000/api/v1/accounts/1/contacts',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Messenger User', identifier: 'PSID-123' }),
      }),
    );
  });
});
