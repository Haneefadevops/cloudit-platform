import { ChatwootController } from './chatwoot.controller';

const CONVERSATION = {
  id: 'conv-1',
  status: 'human',
  csatPending: false,
  client: {
    csatEnabled: true,
    csatMessage: 'Rate us 1-5',
    metaAccessToken: 'token',
    whatsappPhoneNumberId: 'pn-1',
  },
  customer: { phoneNumber: '+94771234567' },
};

function setup(options: {
  conversation?: Record<string, unknown> | null;
  claimCount?: number;
}) {
  const prisma = {
    conversation: {
      findFirst: jest
        .fn()
        .mockResolvedValue(options.conversation ?? CONVERSATION),
      updateMany: jest
        .fn()
        .mockResolvedValue({ count: options.claimCount ?? 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    handoffLog: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    message: { create: jest.fn().mockResolvedValue({}) },
  };
  const sender = { sendMessage: jest.fn().mockResolvedValue(undefined) };
  const controller = new ChatwootController(
    {} as never,
    sender as never,
    prisma as never,
  );
  return { prisma, sender, controller };
}

const RESOLVE_EVENT = {
  event: 'conversation_resolved',
  conversation: { id: 42 },
};

describe('ChatwootController resolve / CSAT guard', () => {
  it('sends the CSAT request once on the first resolve', async () => {
    const { prisma, sender, controller } = setup({});

    await controller.handleWebhook(RESOLVE_EVENT);

    expect(prisma.conversation.updateMany).toHaveBeenCalledWith({
      where: { id: 'conv-1', status: { not: 'resolved' } },
      data: expect.objectContaining({ status: 'resolved' }),
    });
    expect(sender.sendMessage).toHaveBeenCalledTimes(1);
    expect(sender.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '+94771234567',
        message: 'Rate us 1-5',
      }),
    );
    expect(prisma.conversation.update).toHaveBeenCalledWith({
      where: { id: 'conv-1' },
      data: { csatPending: true },
    });
  });

  it('does not send CSAT when a duplicate resolve event loses the atomic claim', async () => {
    const { prisma, sender, controller } = setup({ claimCount: 0 });

    await controller.handleWebhook(RESOLVE_EVENT);

    expect(sender.sendMessage).not.toHaveBeenCalled();
    expect(prisma.conversation.update).not.toHaveBeenCalled();
  });

  it('does nothing when the conversation is already resolved', async () => {
    const { prisma, sender, controller } = setup({
      conversation: { ...CONVERSATION, status: 'resolved' },
    });

    await controller.handleWebhook(RESOLVE_EVENT);

    expect(prisma.conversation.updateMany).not.toHaveBeenCalled();
    expect(sender.sendMessage).not.toHaveBeenCalled();
  });

  it('does not resend CSAT when a rating request is already pending', async () => {
    const { prisma, sender, controller } = setup({
      conversation: { ...CONVERSATION, csatPending: true },
    });

    await controller.handleWebhook(RESOLVE_EVENT);

    // Resolve bookkeeping still happens, but no second CSAT request.
    expect(prisma.conversation.updateMany).toHaveBeenCalled();
    expect(sender.sendMessage).not.toHaveBeenCalled();
  });

  it('does not send CSAT when the client has it disabled', async () => {
    const { sender, controller } = setup({
      conversation: {
        ...CONVERSATION,
        client: { ...CONVERSATION.client, csatEnabled: false },
      },
    });

    await controller.handleWebhook(RESOLVE_EVENT);

    expect(sender.sendMessage).not.toHaveBeenCalled();
  });
});
