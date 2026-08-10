import { WhatsAppService, AI_REPLY_LIMIT } from './whatsapp.service';
import { CustomersService } from '../customers/customers.service';

const CLIENT = {
  id: 'client-1',
  name: 'Test Clinic',
  status: 'active',
  metaAccessToken: 'token',
  whatsappPhoneNumberId: 'pn-1',
  welcomeMessage: null,
  handoffKeywords: 'human,agent',
  aiPausedMessage: null,
};

const REFERRAL = {
  source_url: 'https://example.com/ad',
  source_id: 'ad-123',
  source_type: 'ad',
  ctwa_clid: 'clid-123',
};

function webhookPayload(referral?: Record<string, unknown>) {
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
                  ...(referral ? { referral } : {}),
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function setup() {
  const prisma = {
    conversation: {
      findFirst: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
    },
    message: {
      create: jest.fn().mockResolvedValue({}),
      count: jest.fn().mockResolvedValue(AI_REPLY_LIMIT),
    },
  };
  const conversationsService = {
    findActiveByCustomer: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'conv-1', status: 'bot' }),
    handoffToHuman: jest.fn().mockResolvedValue({}),
  };
  const customersService = {
    findOrCreate: jest.fn().mockResolvedValue({ id: 'cust-1', name: 'Nimal' }),
  };
  const service = new WhatsAppService(
    {} as never,
    prisma as never,
    {} as never,
    conversationsService as never,
    customersService as never,
    { findByPhoneNumberId: jest.fn().mockResolvedValue(CLIENT) } as never,
    { sendMessage: jest.fn(), sendTypingIndicator: jest.fn() } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { getUsage: jest.fn() } as never,
    {} as never,
    {} as never,
    {
      findActiveWorkflows: jest.fn().mockResolvedValue([]),
      findActiveSession: jest.fn().mockResolvedValue(null),
    } as never,
  );

  return { customersService, conversationsService, service };
}

describe('WhatsAppService referral handling', () => {
  it('stores CTWA attribution for a new customer and conversation', async () => {
    const { customersService, conversationsService, service } = setup();

    await service.handleIncomingWebhook(webhookPayload(REFERRAL));

    expect(customersService.findOrCreate).toHaveBeenCalledWith({
      clientId: 'client-1',
      phoneNumber: '+94771234567',
      name: 'Nimal',
      channel: 'whatsapp',
      channelSourceId: undefined,
      leadSource: 'ctwa_ad',
    });
    expect(conversationsService.create).toHaveBeenCalledWith({
      clientId: 'client-1',
      customerId: 'cust-1',
      channel: 'whatsapp',
      referral: REFERRAL,
    });
  });

  it('keeps existing organic customer lead source unchanged', async () => {
    const prisma = {
      customer: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'cust-1',
          name: 'Nimal',
          leadSource: null,
        }),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    const customersService = new CustomersService(prisma as never);

    const customer = await customersService.findOrCreate({
      clientId: 'client-1',
      phoneNumber: '+94771234567',
      leadSource: 'ctwa_ad',
    });

    expect(customer.leadSource).toBeNull();
    expect(prisma.customer.update).not.toHaveBeenCalled();
    expect(prisma.customer.create).not.toHaveBeenCalled();
  });

  it('preserves existing behavior when no referral is supplied', async () => {
    const { customersService, conversationsService, service } = setup();

    await service.handleIncomingWebhook(webhookPayload());

    expect(customersService.findOrCreate).toHaveBeenCalledWith({
      clientId: 'client-1',
      phoneNumber: '+94771234567',
      name: 'Nimal',
      channel: 'whatsapp',
      channelSourceId: undefined,
    });
    expect(conversationsService.create).toHaveBeenCalledWith({
      clientId: 'client-1',
      customerId: 'cust-1',
      channel: 'whatsapp',
    });
  });
});
