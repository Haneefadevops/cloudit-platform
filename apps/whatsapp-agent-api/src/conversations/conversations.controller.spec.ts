import { ConversationsController } from './conversations.controller';

describe('ConversationsController agent reply', () => {
  function setup(options: {
    channel?: string;
    phoneNumber?: string | null;
    chatwootConversationId?: number | null;
    chatwootAccountId?: number | null;
  } = {}) {
    const conversation = {
      id: 'conv-1',
      channel: options.channel || 'whatsapp',
      customer: {
        id: 'cust-1',
        phoneNumber:
          options.phoneNumber !== undefined
            ? options.phoneNumber
            : '+94771234567',
      },
      client: {
        id: 'client-1',
        metaAccessToken: 'token',
        whatsappPhoneNumberId: 'pn-1',
        chatwootAccountId: options.chatwootAccountId ?? 1,
      },
      chatwootConversationId: options.chatwootConversationId ?? null,
    };

    const conversationsService = {
      findOne: jest.fn().mockResolvedValue(conversation),
    };
    const senderService = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
    };
    const chatwootService = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
    };
    const prisma = {
      message: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const controller = new ConversationsController(
      conversationsService as never,
      senderService as never,
      chatwootService as never,
      prisma as never,
    );

    return {
      controller,
      conversationsService,
      senderService,
      chatwootService,
      prisma,
    };
  }

  it('sends WhatsApp replies through the WhatsApp sender', async () => {
    const { controller, senderService, chatwootService } = setup({
      channel: 'whatsapp',
    });

    const result = await controller.agentReply('conv-1', 'Hello', {} as any);

    expect(result).toEqual({ status: 'sent' });
    expect(senderService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '+94771234567',
        message: 'Hello',
      }),
    );
    expect(chatwootService.sendMessage).not.toHaveBeenCalled();
  });

  it('posts Messenger replies back into the existing Chatwoot conversation', async () => {
    const { controller, senderService, chatwootService } = setup({
      channel: 'messenger',
      phoneNumber: null,
      chatwootConversationId: 42,
    });

    const result = await controller.agentReply('conv-1', 'Hi there', {} as any);

    expect(result).toEqual({ status: 'sent' });
    expect(senderService.sendMessage).not.toHaveBeenCalled();
    expect(chatwootService.sendMessage).toHaveBeenCalledWith(
      1,
      42,
      'Hi there',
      'outgoing',
    );
  });

  it('posts Instagram replies back into the existing Chatwoot conversation', async () => {
    const { controller, senderService, chatwootService } = setup({
      channel: 'instagram',
      phoneNumber: null,
      chatwootConversationId: 55,
    });

    const result = await controller.agentReply('conv-1', 'Hello IG', {} as any);

    expect(result).toEqual({ status: 'sent' });
    expect(senderService.sendMessage).not.toHaveBeenCalled();
    expect(chatwootService.sendMessage).toHaveBeenCalledWith(
      1,
      55,
      'Hello IG',
      'outgoing',
    );
  });

  it('warns and returns sent when WhatsApp customer has no phone number', async () => {
    const { controller, senderService, chatwootService } = setup({
      channel: 'whatsapp',
      phoneNumber: null,
    });

    const result = await controller.agentReply('conv-1', 'Hello', {} as any);

    expect(result).toEqual({ status: 'sent' });
    expect(senderService.sendMessage).not.toHaveBeenCalled();
    expect(chatwootService.sendMessage).not.toHaveBeenCalled();
  });
});
