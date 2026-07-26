import {
  WhatsAppService,
  AI_REPLY_LIMIT,
  AI_REPLY_LIMIT_MESSAGE,
} from './whatsapp.service';

const CLIENT = {
  id: 'client-1',
  name: 'Test Clinic',
  status: 'active',
  metaAccessToken: 'token',
  whatsappPhoneNumberId: 'pn-1',
  bookingsEnabled: false,
  ordersEnabled: false,
  aiPausedMessage: null,
  handoffKeywords: 'human,agent',
};

function setup(botReplyCount: number) {
  const prisma = {
    conversation: {
      findFirst: jest.fn().mockResolvedValue(null), // no pending CSAT
      count: jest.fn().mockResolvedValue(3),
    },
    message: {
      create: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(botReplyCount),
      findMany: jest.fn().mockResolvedValue([]),
    },
    customer: { update: jest.fn() },
  };
  const aiService = {
    generateReply: jest.fn().mockResolvedValue({
      reply: 'AI reply',
      handoff: false,
      metadata: {},
    }),
  };
  const conversationsService = {
    findActiveByCustomer: jest
      .fn()
      .mockResolvedValue({ id: 'conv-1', status: 'bot' }),
    handoffToHuman: jest.fn().mockResolvedValue({}),
  };
  const customersService = {
    findOrCreate: jest
      .fn()
      .mockResolvedValue({ id: 'cust-1', phoneNumber: '+94771234567', name: 'Nimal' }),
  };
  const clientsService = {
    findByPhoneNumberId: jest.fn().mockResolvedValue(CLIENT),
  };
  const senderService = { sendMessage: jest.fn().mockResolvedValue(undefined) };
  const knowledgeBaseService = { search: jest.fn().mockResolvedValue([]) };
  const usageService = {
    getUsage: jest.fn().mockResolvedValue({ balance: 100 }),
  };

  const service = new WhatsAppService(
    { get: (_k: string, def?: unknown) => def } as never,
    prisma as never,
    aiService as never,
    conversationsService as never,
    customersService as never,
    clientsService as never,
    senderService as never,
    {} as never, // chatwoot
    knowledgeBaseService as never,
    {} as never, // bookingActions
    {} as never, // orderActions
    usageService as never,
    {} as never, // media
  );

  return {
    prisma,
    aiService,
    conversationsService,
    senderService,
    service,
  };
}

function webhookPayload() {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: 'pn-1' },
              contacts: [{ wa_id: '+94771234567', profile: { name: 'Nimal' } }],
              messages: [
                {
                  from: '+94771234567',
                  id: 'msg-1',
                  type: 'text',
                  text: { body: 'hello there' },
                  timestamp: '1785000000',
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe('WhatsAppService 50-reply abuse cap', () => {
  it(`hands off with a polite note at ${AI_REPLY_LIMIT} bot replies, without calling the AI`, async () => {
    const { aiService, conversationsService, senderService, service } =
      setup(AI_REPLY_LIMIT);

    await service.handleIncomingWebhook(webhookPayload());

    expect(aiService.generateReply).not.toHaveBeenCalled();
    expect(senderService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '+94771234567',
        message: AI_REPLY_LIMIT_MESSAGE,
      }),
    );
    expect(conversationsService.handoffToHuman).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      triggeredBy: 'system',
      reason: `Conversation reached the ${AI_REPLY_LIMIT}-reply AI limit`,
    });
  });

  it(`flows through the AI below the ${AI_REPLY_LIMIT}-reply cap`, async () => {
    const { aiService, conversationsService, senderService, service } = setup(
      AI_REPLY_LIMIT - 1,
    );

    await service.handleIncomingWebhook(webhookPayload());

    expect(aiService.generateReply).toHaveBeenCalled();
    expect(senderService.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'AI reply' }),
    );
    expect(conversationsService.handoffToHuman).not.toHaveBeenCalled();
  });
});
