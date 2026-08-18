import { PlaygroundService } from './playground.service';
import { NotFoundException } from '@nestjs/common';

const CLIENT = {
  id: 'client-1',
  name: 'Test Clinic',
  status: 'active',
  bookingsEnabled: true,
  ordersEnabled: false,
  businessProfile: {},
  products: [],
  systemPrompt: null,
  aiTemperature: 1,
  aiModel: null,
  maxTokens: 1024,
  fallbackMessage: null,
  language: 'en',
  timezone: 'UTC',
  bookingApprovalMode: 'approval',
  paymentInstructions: null,
  aiPausedMessage: null,
};

function setup() {
  const prisma = {
    client: {
      findUnique: jest.fn().mockResolvedValue(CLIENT),
    },
    customer: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'cust-1',
        name: 'Playground Tester',
        phoneNumber: null,
        channel: 'messenger',
        channelSourceId: 'playground',
      }),
    },
  };
  const aiService = {
    generateReply: jest.fn().mockResolvedValue({
      reply: 'AI reply',
      handoff: false,
      metadata: { usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } },
    }),
  };
  const knowledgeBaseService = { search: jest.fn().mockResolvedValue([]) };
  const bookingActionsService = {
    buildPromptContext: jest.fn().mockResolvedValue({
      services: [],
      staff: [],
      upcomingBookings: [],
    }),
    execute: jest.fn(),
  };
  const orderActionsService = {};
  const usageService = {
    getUsage: jest.fn().mockResolvedValue({ balance: 100 }),
  };

  const service = new PlaygroundService(
    prisma as never,
    aiService as never,
    knowledgeBaseService as never,
    bookingActionsService as never,
    orderActionsService as never,
    usageService as never,
  );

  return { prisma, aiService, service };
}

describe('PlaygroundService', () => {
  it('throws NotFoundException when client does not exist', async () => {
    const { prisma, service } = setup();
    prisma.client.findUnique.mockResolvedValue(null);
    await expect(service.run('missing', { message: 'hi' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('defaults to the WhatsApp channel', async () => {
    const { prisma, service } = setup();
    await service.run('client-1', { message: 'hello' });
    expect(prisma.customer.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ channel: 'whatsapp' }),
      }),
    );
  });

  it('creates a Messenger playground customer without a phone number', async () => {
    const { prisma, service } = setup();
    await service.run('client-1', { message: 'hello', channel: 'messenger' });
    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: 'client-1',
          channel: 'messenger',
          channelSourceId: 'playground',
          phoneNumber: null,
          name: 'Playground Tester',
        }),
      }),
    );
  });

  it('creates an Instagram playground customer without a phone number', async () => {
    const { prisma, service } = setup();
    await service.run('client-1', { message: 'hello', channel: 'instagram' });
    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: 'client-1',
          channel: 'instagram',
          channelSourceId: 'playground',
          phoneNumber: null,
        }),
      }),
    );
  });

  it('creates a WhatsApp playground customer with a placeholder phone number', async () => {
    const { prisma, service } = setup();
    await service.run('client-1', { message: 'hello', channel: 'whatsapp' });
    expect(prisma.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: 'client-1',
          channel: 'whatsapp',
          channelSourceId: 'playground',
          phoneNumber: 'playground',
        }),
      }),
    );
  });
});
