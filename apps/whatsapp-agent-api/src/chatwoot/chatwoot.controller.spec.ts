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
    chatwootAccountId: 1,
  },
  customer: { phoneNumber: '+94771234567' },
  chatwootConversationId: 42,
  channel: 'whatsapp',
};

function setup(options: {
  conversation?: Record<string, unknown> | null;
  claimCount?: number;
  adminUserId?: string;
  client?: Record<string, unknown> | null;
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
    client: {
      findFirst: jest.fn().mockResolvedValue(
        options.client === undefined
          ? { id: 'client-1', chatwootAccountId: 1, chatwootInboxId: 7 }
          : options.client,
      ),
    },
    handoffLog: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    message: { create: jest.fn().mockResolvedValue({}) },
  };
  const sender = {
    sendMessage: jest.fn().mockResolvedValue(undefined),
    sendWithTemplateFallback: jest.fn().mockResolvedValue(undefined),
  };
  const chatwoot = { sendMessage: jest.fn().mockResolvedValue(undefined) };
  const whatsapp = {
    handleChannelIncomingMessage: jest.fn().mockResolvedValue(undefined),
  };
  const controller = new ChatwootController(
    chatwoot as never,
    sender as never,
    prisma as never,
    { get: () => options.adminUserId } as never,
    whatsapp as never,
  );
  return { prisma, sender, chatwoot, whatsapp, controller };
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
    expect(sender.sendWithTemplateFallback).toHaveBeenCalledTimes(1);
    expect(sender.sendWithTemplateFallback).toHaveBeenCalledWith(
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

    expect(sender.sendWithTemplateFallback).not.toHaveBeenCalled();
    expect(prisma.conversation.update).not.toHaveBeenCalled();
  });

  it('does nothing when the conversation is already resolved', async () => {
    const { prisma, sender, controller } = setup({
      conversation: { ...CONVERSATION, status: 'resolved' },
    });

    await controller.handleWebhook(RESOLVE_EVENT);

    expect(prisma.conversation.updateMany).not.toHaveBeenCalled();
    expect(sender.sendWithTemplateFallback).not.toHaveBeenCalled();
  });

  it('does not resend CSAT when a rating request is already pending', async () => {
    const { prisma, sender, controller } = setup({
      conversation: { ...CONVERSATION, csatPending: true },
    });

    await controller.handleWebhook(RESOLVE_EVENT);

    // Resolve bookkeeping still happens, but no second CSAT request.
    expect(prisma.conversation.updateMany).toHaveBeenCalled();
    expect(sender.sendWithTemplateFallback).not.toHaveBeenCalled();
  });

  it('does not send CSAT when the client has it disabled', async () => {
    const { sender, controller } = setup({
      conversation: {
        ...CONVERSATION,
        client: { ...CONVERSATION.client, csatEnabled: false },
      },
    });

    await controller.handleWebhook(RESOLVE_EVENT);

    expect(sender.sendWithTemplateFallback).not.toHaveBeenCalled();
  });
});

describe('ChatwootController outbound channel routing', () => {
  const AGENT_REPLY = {
    event: 'message_created',
    message_type: 'outgoing',
    content: 'Hello from the team',
    conversation: { id: 42 },
    sender: { id: 9, type: 'User' },
  };

  it('sends WhatsApp conversation replies through the WhatsApp sender', async () => {
    const { sender, chatwoot, controller } = setup({});

    await controller.handleWebhook(AGENT_REPLY);

    expect(sender.sendMessage).toHaveBeenCalledWith(expect.objectContaining({
      to: '+94771234567', message: 'Hello from the team',
    }));
    expect(chatwoot.sendMessage).not.toHaveBeenCalled();
  });

  it('sends Messenger conversation replies through Chatwoot', async () => {
    const { sender, chatwoot, controller } = setup({
      conversation: { ...CONVERSATION, channel: 'messenger', customer: { phoneNumber: null } },
    });

    await controller.handleWebhook(AGENT_REPLY);

    expect(chatwoot.sendMessage).toHaveBeenCalledWith(
      1, 42, 'Hello from the team', 'outgoing',
    );
    expect(sender.sendMessage).not.toHaveBeenCalled();
  });

  it('ignores echoes posted by the configured API admin user', async () => {
    const { sender, chatwoot, controller } = setup({ adminUserId: '99' });

    await controller.handleWebhook({ ...AGENT_REPLY, sender: { id: 99 } });

    expect(sender.sendMessage).not.toHaveBeenCalled();
    expect(chatwoot.sendMessage).not.toHaveBeenCalled();
  });
});

describe('ChatwootController inbound channel routing', () => {
  const MESSENGER_MESSAGE = {
    event: 'message_created',
    message_type: 'incoming',
    content: 'Do you deliver to Kandy?',
    account: { id: 1 },
    inbox: { id: 12 },
    conversation: {
      id: 42,
      channel: 'Channel::FacebookPage',
      inbox_id: 12,
      meta: { sender: { name: 'Nimal' } },
      contact_inbox: { source_id: 'PSID-123' },
    },
    sender: { id: 55, type: 'contact', name: 'Nimal' },
  };

  it('routes a Messenger message into the AI pipeline', async () => {
    const { whatsapp, controller } = setup({});

    await controller.handleWebhook(MESSENGER_MESSAGE);

    expect(whatsapp.handleChannelIncomingMessage).toHaveBeenCalledWith({
      clientId: 'client-1',
      channel: 'messenger',
      channelSourceId: 'PSID-123',
      contactName: 'Nimal',
      messageBody: 'Do you deliver to Kandy?',
      chatwootConversationId: 42,
    });
  });

  it('maps Instagram inboxes to the instagram channel', async () => {
    const { whatsapp, controller } = setup({});

    await controller.handleWebhook({
      ...MESSENGER_MESSAGE,
      conversation: {
        ...MESSENGER_MESSAGE.conversation,
        channel: 'Channel::Instagram',
      },
    });

    expect(whatsapp.handleChannelIncomingMessage).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'instagram' }),
    );
  });

  it('ignores incoming events from the WhatsApp API inbox (already processed via Meta webhook)', async () => {
    const { whatsapp, controller } = setup({});

    await controller.handleWebhook({
      ...MESSENGER_MESSAGE,
      inbox: { id: 7 },
      conversation: {
        ...MESSENGER_MESSAGE.conversation,
        channel: 'Channel::Api',
        inbox_id: 7,
      },
    });

    expect(whatsapp.handleChannelIncomingMessage).not.toHaveBeenCalled();
  });

  it('ignores private notes and empty messages', async () => {
    const { whatsapp, controller } = setup({});

    await controller.handleWebhook({ ...MESSENGER_MESSAGE, private: true });
    await controller.handleWebhook({ ...MESSENGER_MESSAGE, content: '' });

    expect(whatsapp.handleChannelIncomingMessage).not.toHaveBeenCalled();
  });

  it('ignores messages for unknown Chatwoot accounts', async () => {
    const { whatsapp, controller } = setup({ client: null });

    await controller.handleWebhook(MESSENGER_MESSAGE);

    expect(whatsapp.handleChannelIncomingMessage).not.toHaveBeenCalled();
  });
});
