import {
  WhatsAppSenderService,
  WhatsAppSendError,
  META_WINDOW_CLOSED_CODE,
} from './whatsapp-sender.service';

const CLIENT = { metaAccessToken: 'token', whatsappPhoneNumberId: 'pn-1' };

function serviceWithConfig(values: Record<string, string> = {}) {
  const config = {
    get: (k: string, def?: unknown) => values[k] ?? def,
  };
  return new WhatsAppSenderService(config as never);
}

function okResponse() {
  return { ok: true, status: 200, text: jest.fn() } as unknown as Response;
}

function metaErrorResponse(code: number, status = 400) {
  return {
    ok: false,
    status,
    text: jest
      .fn()
      .mockResolvedValue(
        JSON.stringify({ error: { message: 'err', code } }),
      ),
  } as unknown as Response;
}

function fetchBodies(mock: jest.Mock) {
  return mock.mock.calls.map((call) => JSON.parse(call[1].body as string));
}

describe('WhatsAppSenderService', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as never;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('sendMessage', () => {
    it('posts a free-form text message', async () => {
      fetchMock.mockResolvedValue(okResponse());
      const service = serviceWithConfig();

      await service.sendMessage({ client: CLIENT, to: '+123', message: 'hi' });

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://graph.facebook.com/v18.0/pn-1/messages');
      expect(init.headers.Authorization).toBe('Bearer token');
      const body = JSON.parse(init.body);
      expect(body.type).toBe('text');
      expect(body.text.body).toBe('hi');
    });

    it('throws WhatsAppSendError carrying the Meta error code', async () => {
      fetchMock.mockResolvedValue(metaErrorResponse(META_WINDOW_CLOSED_CODE));
      const service = serviceWithConfig();

      const error = await service
        .sendMessage({ client: CLIENT, to: '+123', message: 'hi' })
        .catch((e) => e);
      expect(error).toBeInstanceOf(WhatsAppSendError);
      expect(error.metaCode).toBe(META_WINDOW_CLOSED_CODE);
    });
  });

  describe('sendTemplate', () => {
    it('posts a template payload with body parameters', async () => {
      fetchMock.mockResolvedValue(okResponse());
      const service = serviceWithConfig();

      await service.sendTemplate({
        client: CLIENT,
        to: '+123',
        templateName: 'booking_reminder',
        parameters: ['Haircut', 'Nimal', 'tomorrow 10:00'],
      });

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.type).toBe('template');
      expect(body.template.name).toBe('booking_reminder');
      expect(body.template.language.code).toBe('en');
      expect(body.template.components).toEqual([
        {
          type: 'body',
          parameters: [
            { type: 'text', text: 'Haircut' },
            { type: 'text', text: 'Nimal' },
            { type: 'text', text: 'tomorrow 10:00' },
          ],
        },
      ]);
    });
  });

  describe('resolveTemplateName', () => {
    it('defaults to the Meta template name for the kind', () => {
      const service = serviceWithConfig();
      expect(service.resolveTemplateName('booking_reminder')).toBe(
        'booking_reminder',
      );
      expect(service.resolveTemplateName('order_update')).toBe('order_update');
      expect(service.resolveTemplateName('booking_confirmed')).toBe(
        'booking_confirmed',
      );
      expect(service.resolveTemplateName('general_followup')).toBe(
        'general_followup',
      );
    });

    it('honours the TEMPLATE_* env overrides', () => {
      const service = serviceWithConfig({
        TEMPLATE_BOOKING_REMINDER: 'acme_reminder_v2',
      });
      expect(service.resolveTemplateName('booking_reminder')).toBe(
        'acme_reminder_v2',
      );
      // Others stay at their defaults
      expect(service.resolveTemplateName('order_update')).toBe('order_update');
    });
  });

  describe('sendWithTemplateFallback', () => {
    const template = {
      kind: 'booking_reminder' as const,
      parameters: ['Haircut', 'Nimal', 'tomorrow 10:00'],
    };

    it('sends free-form only when the session message succeeds', async () => {
      fetchMock.mockResolvedValue(okResponse());
      const service = serviceWithConfig();

      await service.sendWithTemplateFallback({
        client: CLIENT,
        to: '+123',
        message: 'reminder text',
        template,
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchBodies(fetchMock)[0].type).toBe('text');
    });

    it('falls back to the template when Meta rejects with 131047 (window closed)', async () => {
      fetchMock
        .mockResolvedValueOnce(metaErrorResponse(META_WINDOW_CLOSED_CODE))
        .mockResolvedValueOnce(okResponse());
      const service = serviceWithConfig();

      await service.sendWithTemplateFallback({
        client: CLIENT,
        to: '+123',
        message: 'reminder text',
        template,
      });

      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [first, second] = fetchBodies(fetchMock);
      expect(first.type).toBe('text');
      expect(second.type).toBe('template');
      expect(second.template.name).toBe('booking_reminder');
      expect(second.template.components[0].parameters).toHaveLength(3);
    });

    it('uses the env-overridden template name on fallback', async () => {
      fetchMock
        .mockResolvedValueOnce(metaErrorResponse(META_WINDOW_CLOSED_CODE))
        .mockResolvedValueOnce(okResponse());
      const service = serviceWithConfig({
        TEMPLATE_BOOKING_REMINDER: 'acme_reminder_v2',
      });

      await service.sendWithTemplateFallback({
        client: CLIENT,
        to: '+123',
        message: 'reminder text',
        template,
      });

      expect(fetchBodies(fetchMock)[1].template.name).toBe(
        'acme_reminder_v2',
      );
    });

    it('rethrows without falling back on other Meta errors', async () => {
      fetchMock.mockResolvedValue(metaErrorResponse(131026, 400));
      const service = serviceWithConfig();

      await expect(
        service.sendWithTemplateFallback({
          client: CLIENT,
          to: '+123',
          message: 'reminder text',
          template,
        }),
      ).rejects.toBeInstanceOf(WhatsAppSendError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('rethrows when the template fallback also fails', async () => {
      fetchMock
        .mockResolvedValueOnce(metaErrorResponse(META_WINDOW_CLOSED_CODE))
        .mockResolvedValueOnce(metaErrorResponse(132000, 400));
      const service = serviceWithConfig();

      await expect(
        service.sendWithTemplateFallback({
          client: CLIENT,
          to: '+123',
          message: 'reminder text',
          template,
        }),
      ).rejects.toBeInstanceOf(WhatsAppSendError);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });
});
