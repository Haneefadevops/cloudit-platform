import { ConversationsService } from './conversations.service';

/**
 * Covers the ticket-ref behaviour of handoffToHuman: a TK-XXXXX ref is
 * generated on first handoff, kept on repeat handoffs, and surfaced in the
 * Chatwoot handoff context message.
 */
describe('ConversationsService ticket refs', () => {
  function setup(options: { existingRef?: string | null } = {}) {
    // Tracks what handoffToHuman actually wrote, so the re-fetch inside
    // pushHandoffToChatwoot sees it (like the real DB would).
    let assignedRef: string | null = options.existingRef ?? null;
    const conversationWithClient = {
      id: 'conv-1',
      get ticketRef() {
        return assignedRef;
      },
      chatwootConversationId: null,
      channel: 'whatsapp',
      customer: { id: 'cust-1', phoneNumber: '+9477', chatwootContactId: 10 },
      client: { id: 'client-1', chatwootAccountId: 1, chatwootInboxId: 2 },
    };

    const prisma = {
      conversation: {
        findUnique: jest.fn().mockImplementation((args: any) => {
          // Collision check inside generateTicketRef
          if (args.where?.ticketRef) return Promise.resolve(null);
          // ticketRef lookup at the start of handoffToHuman
          if (args.select?.ticketRef) {
            return Promise.resolve({ ticketRef: options.existingRef ?? null });
          }
          // Full fetch (with include) inside pushHandoffToChatwoot
          return Promise.resolve(conversationWithClient);
        }),
        update: jest.fn().mockImplementation((args: any) => {
          assignedRef = args.data.ticketRef ?? assignedRef;
          return Promise.resolve({ id: 'conv-1', ...args.data });
        }),
      },
      message: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      handoffLog: { create: jest.fn().mockResolvedValue({}) },
    };

    const chatwootService = {
      createContact: jest.fn().mockResolvedValue({
        payload: { contact: { id: 100 } },
      }),
      createConversation: jest.fn().mockResolvedValue({ id: 456 }),
      sendMessage: jest.fn().mockResolvedValue({}),
      addLabelsToConversation: jest.fn().mockResolvedValue({}),
    };
    const aiService = {
      summarizeConversation: jest.fn().mockResolvedValue('summary'),
      suggestLabels: jest.fn().mockResolvedValue([]),
    };
    const config = { get: (_k: string, def?: unknown) => def };

    const service = new ConversationsService(
      prisma as never,
      chatwootService as never,
      config as never,
      aiService as never,
    );

    return { prisma, chatwootService, service };
  }

  it('generates a TK-XXXXX ref on first handoff', async () => {
    const { prisma, service } = setup();

    const conversation = await service.handoffToHuman({
      conversationId: 'conv-1',
      triggeredBy: 'customer',
      reason: 'Customer requested human agent',
    });

    expect(conversation.ticketRef).toMatch(/^TK-\d{5}$/);
    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ticketRef: conversation.ticketRef }),
      }),
    );
  });

  it('keeps the existing ref when a conversation is handed off again', async () => {
    const { prisma, service } = setup({ existingRef: 'TK-11111' });

    const conversation = await service.handoffToHuman({
      conversationId: 'conv-1',
      triggeredBy: 'bot',
      reason: 'AI requested human handoff',
    });

    expect(conversation.ticketRef).toBe('TK-11111');
    // The collision check (findUnique by ticketRef) must never run
    expect(
      prisma.conversation.findUnique.mock.calls.filter(
        (c) => c[0]?.where?.ticketRef,
      ),
    ).toHaveLength(0);
  });

  it('includes the ticket ref in the Chatwoot handoff context message', async () => {
    const { chatwootService, service } = setup();

    const conversation = await service.handoffToHuman({
      conversationId: 'conv-1',
      triggeredBy: 'customer',
      reason: 'Customer requested human agent',
    });

    const history = chatwootService.createConversation.mock.calls[0][4] as Array<{
      content: string;
    }>;
    const contextMessage = history[history.length - 1].content;
    expect(contextMessage).toContain('AI handoff triggered.');
    expect(contextMessage).toContain(`Ticket: ${conversation.ticketRef}`);
  });
});

describe('ConversationsService pushHandoffToChatwoot channels', () => {
  function setup(options: {
    channel?: string;
    phoneNumber?: string | null;
    channelSourceId?: string | null;
    chatwootContactId?: number | null;
    chatwootConversationId?: number | null;
    chatwootInboxId?: number | null;
  } = {}) {
    const conversationWithClient = {
      id: 'conv-1',
      ticketRef: 'TK-12345',
      channel: options.channel || 'whatsapp',
      chatwootConversationId: options.chatwootConversationId ?? null,
      customer: {
        id: 'cust-1',
        phoneNumber: options.phoneNumber ?? '+9477',
        channelSourceId: options.channelSourceId ?? null,
        chatwootContactId: options.chatwootContactId ?? null,
      },
      client: {
        id: 'client-1',
        chatwootAccountId: 1,
        chatwootInboxId: options.chatwootInboxId ?? 2,
      },
    };

    const prisma = {
      conversation: {
        findUnique: jest.fn().mockResolvedValue(conversationWithClient),
        update: jest.fn().mockResolvedValue({ id: 'conv-1' }),
      },
      message: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      handoffLog: { create: jest.fn().mockResolvedValue({}) },
      customer: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const chatwootService = {
      createContact: jest.fn().mockResolvedValue({
        payload: { contact: { id: 100 } },
      }),
      createConversation: jest.fn().mockResolvedValue({ id: 456 }),
      sendMessage: jest.fn().mockResolvedValue({}),
      addLabelsToConversation: jest.fn().mockResolvedValue({}),
    };
    const aiService = {
      summarizeConversation: jest.fn().mockResolvedValue('summary'),
      suggestLabels: jest.fn().mockResolvedValue([]),
    };
    const config = { get: (_k: string, def?: unknown) => def };

    const service = new ConversationsService(
      prisma as never,
      chatwootService as never,
      config as never,
      aiService as never,
    );

    return { prisma, chatwootService, service };
  }

  it('creates WhatsApp contact from phone number when contact id is missing', async () => {
    const { chatwootService, service } = setup({
      chatwootContactId: null,
      chatwootConversationId: null,
    });

    await service.handoffToHuman({
      conversationId: 'conv-1',
      triggeredBy: 'customer',
      reason: 'Customer requested human agent',
    });

    expect(chatwootService.createContact).toHaveBeenCalledWith(
      1,
      '+9477',
      undefined,
      undefined,
    );
    expect(chatwootService.createConversation).toHaveBeenCalled();
    expect(chatwootService.addLabelsToConversation).toHaveBeenCalledWith(
      1,
      456,
      expect.arrayContaining(['ai-handoff']),
    );
  });

  it('does not abort Messenger/Instagram handoff when phone number is missing', async () => {
    const { chatwootService, service } = setup({
      channel: 'messenger',
      phoneNumber: null,
      channelSourceId: 'PSID-123',
      chatwootContactId: null,
      chatwootConversationId: 789,
    });

    await service.handoffToHuman({
      conversationId: 'conv-1',
      triggeredBy: 'customer',
      reason: 'Customer requested human agent',
    });

    expect(chatwootService.createContact).toHaveBeenCalledWith(
      1,
      undefined,
      undefined,
      'PSID-123',
    );
    expect(chatwootService.createConversation).not.toHaveBeenCalled();
    expect(chatwootService.addLabelsToConversation).toHaveBeenCalledWith(
      1,
      789,
      expect.arrayContaining(['ai-handoff']),
    );
  });

  it('creates Instagram contact from channelSourceId and labels existing conversation', async () => {
    const { chatwootService, service } = setup({
      channel: 'instagram',
      phoneNumber: null,
      channelSourceId: 'IGSID-456',
      chatwootContactId: null,
      chatwootConversationId: 999,
    });

    await service.handoffToHuman({
      conversationId: 'conv-1',
      triggeredBy: 'customer',
      reason: 'Customer requested human agent',
    });

    expect(chatwootService.createContact).toHaveBeenCalledWith(
      1,
      undefined,
      undefined,
      'IGSID-456',
    );
    expect(chatwootService.createConversation).not.toHaveBeenCalled();
    expect(chatwootService.addLabelsToConversation).toHaveBeenCalledWith(
      1,
      999,
      expect.arrayContaining(['ai-handoff']),
    );
  });

  it('skips non-WhatsApp handoff when no native Chatwoot conversation exists', async () => {
    const { chatwootService, service } = setup({
      channel: 'messenger',
      phoneNumber: null,
      channelSourceId: 'PSID-123',
      chatwootConversationId: null,
    });

    await service.handoffToHuman({
      conversationId: 'conv-1',
      triggeredBy: 'customer',
      reason: 'Customer requested human agent',
    });

    expect(chatwootService.createContact).not.toHaveBeenCalled();
    expect(chatwootService.addLabelsToConversation).not.toHaveBeenCalled();
  });
});
