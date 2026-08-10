import { Controller, Post, Body, Logger, Inject, forwardRef } from '@nestjs/common';
import { ChatwootService } from './chatwoot.service';
import { WhatsAppSenderService } from '../whatsapp-sender/whatsapp-sender.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

interface ChatwootMessagePayload {
  event: string;
  id?: number;
  content?: string;
  message_type?: string;
  private?: boolean;
  status?: string;
  account?: { id?: number };
  inbox?: { id?: number };
  conversation?: {
    id?: number;
    status?: string;
    channel?: string; // e.g. 'Channel::FacebookPage', 'Channel::Instagram', 'Channel::Api'
    inbox_id?: number;
    meta?: { sender?: { name?: string } };
    contact_inbox?: { source_id?: string };
  };
  sender?: { id?: number; type?: string; name?: string; email?: string };
}

@Controller('webhooks/chatwoot')
export class ChatwootController {
  private readonly logger = new Logger(ChatwootController.name);

  constructor(
    private readonly chatwootService: ChatwootService,
    private readonly senderService: WhatsAppSenderService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => WhatsAppService))
    private readonly whatsappService: WhatsAppService,
  ) {}

  @Post()
  async handleWebhook(@Body() payload: ChatwootMessagePayload) {
    try {
      const event = payload.event;

      this.logger.log(`Received Chatwoot event: ${event}`);

      if (event === 'message_created' && payload.message_type === 'outgoing') {
        await this.handleAgentReply(payload);
      }

      // Messenger/Instagram customer messages arrive here from the native
      // Chatwoot channel inboxes (WhatsApp uses the Meta webhook instead).
      if (event === 'message_created' && payload.message_type === 'incoming') {
        await this.handleChannelMessage(payload);
      }

      if (
        event === 'conversation_status_changed' ||
        event === 'conversation_updated'
      ) {
        this.logger.log(
          `Conversation event payload: ${JSON.stringify(payload)}`,
        );
      }

      const isResolveEvent =
        event === 'conversation_resolved' ||
        (event === 'conversation_status_changed' &&
          (payload.status === 'resolved' || payload.conversation?.status === 'resolved')) ||
        (event === 'conversation_updated' &&
          (payload.status === 'resolved' || payload.conversation?.status === 'resolved'));

      if (isResolveEvent) {
        await this.handleConversationResolved(
          payload.conversation?.id ?? payload.id,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to process Chatwoot webhook: ${(error as Error).message}`,
      );
    }

    return { status: 'ok' };
  }

  /**
   * Routes an incoming Messenger/Instagram message from a native Chatwoot
   * channel inbox into the AI pipeline. Defensive by design: Chatwoot
   * payload shapes vary by version, so anything unrecognised is logged
   * and skipped rather than erroring.
   */
  private async handleChannelMessage(data: ChatwootMessagePayload) {
    if (data.private) return; // private notes are never customer messages

    const accountId = data.account?.id;
    const chatwootConversationId = data.conversation?.id;
    const content = data.content;
    if (!accountId || !chatwootConversationId || !content) return;

    const client = await this.prisma.client.findFirst({
      where: { chatwootAccountId: accountId },
    });
    if (!client) return;

    // The client's own API inbox is the WhatsApp bridge — its incoming
    // events are copies of messages the Meta webhook already processed.
    const inboxId = data.inbox?.id ?? data.conversation?.inbox_id;
    if (inboxId && client.chatwootInboxId && inboxId === client.chatwootInboxId) {
      return;
    }

    const channelRaw = data.conversation?.channel || '';
    const channel = channelRaw.includes('Facebook')
      ? 'messenger'
      : channelRaw.includes('Instagram')
        ? 'instagram'
        : null;
    if (!channel) return; // Channel::Api and anything unknown

    const sourceId =
      data.conversation?.contact_inbox?.source_id ??
      (data.sender?.id ? String(data.sender.id) : null);
    if (!sourceId) {
      this.logger.warn(
        `Channel message without source id (conversation ${chatwootConversationId}); skipping`,
      );
      return;
    }

    await this.whatsappService.handleChannelIncomingMessage({
      clientId: client.id,
      channel,
      channelSourceId: sourceId,
      contactName:
        data.conversation?.meta?.sender?.name || data.sender?.name || undefined,
      messageBody: content,
      chatwootConversationId,
    });
  }

  private async handleAgentReply(data: ChatwootMessagePayload) {
    const adminUserId = this.configService.get<string>('CHATWOOT_ADMIN_USER_ID');
    if (adminUserId && String(data.sender?.id) === adminUserId) {
      this.logger.log('Skipping Chatwoot echo from API admin user');
      return;
    }

    const conversationId = data.conversation?.id;
    const content = data.content;

    if (!conversationId || !content) {
      this.logger.warn('Skipping agent reply: missing conversation or content');
      return;
    }

    if (data.private) {
      this.logger.log(
        `Skipping private note in Chatwoot conversation ${conversationId}`,
      );
      return;
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: { chatwootConversationId: conversationId },
      include: { customer: true, client: true },
    });

    if (!conversation) {
      this.logger.warn(`No local conversation for Chatwoot conversation ${conversationId}`);
      return;
    }

    // Expand canned-response shortcuts (e.g. "/greeting") into templates
    const finalContent = content.startsWith('/')
      ? await this.expandCannedResponse(content, conversation, data.sender?.name)
      : content;

    // Store agent reply
    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'agent',
        content: finalContent,
      },
    });

    if (!conversation.channel || conversation.channel === 'whatsapp') {
      await this.senderService.sendMessage({
        client: {
          metaAccessToken: conversation.client.metaAccessToken,
          whatsappPhoneNumberId: conversation.client.whatsappPhoneNumberId,
        },
        to: conversation.customer.phoneNumber as string,
        message: finalContent,
      });

      this.logger.log(
        `Agent reply forwarded to ${conversation.customer.phoneNumber} for conversation ${conversation.id}`,
      );
      return;
    }

    if (!conversation.client.chatwootAccountId || !conversation.chatwootConversationId) {
      this.logger.warn(`Cannot send ${conversation.channel} reply without Chatwoot IDs`);
      return;
    }

    await this.chatwootService.sendMessage(
      conversation.client.chatwootAccountId,
      conversation.chatwootConversationId,
      finalContent,
      'outgoing',
    );
    this.logger.log(
      `Agent reply forwarded through Chatwoot for conversation ${conversation.id}`,
    );
  }

  /**
   * Expands "/shortcut" agent messages using the client's canned responses.
   * Supported variables: {{customer_name}}, {{business_name}}, {{agent_name}}.
   * Returns the original content when no matching template exists.
   */
  private async expandCannedResponse(
    content: string,
    conversation: {
      clientId: string;
      client: { name: string };
      customer: { name?: string | null };
    },
    agentName?: string,
  ): Promise<string> {
    const shortcut = content.slice(1).split(/\s+/)[0]?.toLowerCase();
    if (!shortcut) return content;

    const template = await this.prisma.cannedResponse.findUnique({
      where: { clientId_shortcut: { clientId: conversation.clientId, shortcut } },
    });
    if (!template) {
      this.logger.warn(`No canned response found for shortcut "/${shortcut}"`);
      return content;
    }

    return template.content
      .replace(/\{\{\s*customer_name\s*\}\}/gi, conversation.customer.name || 'there')
      .replace(/\{\{\s*business_name\s*\}\}/gi, conversation.client.name)
      .replace(/\{\{\s*client_name\s*\}\}/gi, conversation.client.name)
      .replace(/\{\{\s*agent_name\s*\}\}/gi, agentName || 'Support Team');
  }

  private async handleConversationResolved(chatwootConversationId?: number) {
    if (!chatwootConversationId) return;

    const conversation = await this.prisma.conversation.findFirst({
      where: { chatwootConversationId },
      include: { client: true, customer: true },
    });

    if (!conversation || conversation.status === 'resolved') return;

    const resolvedAt = new Date();

    // Atomically claim the resolve: Chatwoot can emit conversation_resolved,
    // conversation_status_changed AND conversation_updated for one resolve,
    // and near-simultaneous webhooks would otherwise all pass the status
    // check above and send duplicate CSAT requests. Only the first caller
    // to flip the status proceeds.
    const claimed = await this.prisma.conversation.updateMany({
      where: { id: conversation.id, status: { not: 'resolved' } },
      data: { status: 'resolved', resolvedAt },
    });
    if (claimed.count === 0) {
      this.logger.log(
        `Conversation ${conversation.id} already resolved by a concurrent event; skipping`,
      );
      return;
    }

    await this.prisma.handoffLog.updateMany({
      where: { conversationId: conversation.id, resolvedAt: null },
      data: { resolvedAt },
    });

    this.logger.log(`Conversation ${conversation.id} resolved from Chatwoot`);

    // Send CSAT rating request to the customer (skip if one is already
    // pending — e.g. the conversation was resolved, reopened, resolved again)
    if (
      conversation.client.csatEnabled &&
      !conversation.csatPending &&
      conversation.customer.phoneNumber
    ) {
      const csatMessage =
        conversation.client.csatMessage ||
        'Thank you for chatting with us! How would you rate your experience? Please reply with a number from 1 (poor) to 5 (excellent).';
      try {
        await this.senderService.sendWithTemplateFallback({
          client: {
            metaAccessToken: conversation.client.metaAccessToken,
            whatsappPhoneNumberId: conversation.client.whatsappPhoneNumberId,
          },
          to: conversation.customer.phoneNumber,
          message: csatMessage,
          template: {
            kind: 'general_followup',
            parameters: [
              conversation.customer.name || 'there',
              conversation.client.name,
              csatMessage,
            ],
          },
        });
        await this.prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderType: 'bot',
            content: csatMessage,
          },
        });
        await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: { csatPending: true },
        });
      } catch (error) {
        this.logger.error(
          `Failed to send CSAT request for conversation ${conversation.id}: ${(error as Error).message}`,
        );
      }
    }
  }
}
