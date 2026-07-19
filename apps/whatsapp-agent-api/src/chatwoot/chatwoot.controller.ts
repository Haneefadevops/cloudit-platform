import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ChatwootService } from './chatwoot.service';
import { WhatsAppSenderService } from '../whatsapp-sender/whatsapp-sender.service';
import { PrismaService } from '../prisma/prisma.service';

interface ChatwootMessagePayload {
  event: string;
  id?: number;
  content?: string;
  message_type?: string;
  private?: boolean;
  status?: string;
  conversation?: { id?: number; status?: string };
  sender?: { id?: number; name?: string; email?: string };
}

@Controller('webhooks/chatwoot')
export class ChatwootController {
  private readonly logger = new Logger(ChatwootController.name);

  constructor(
    private readonly chatwootService: ChatwootService,
    private readonly senderService: WhatsAppSenderService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  async handleWebhook(@Body() payload: ChatwootMessagePayload) {
    try {
      const event = payload.event;

      this.logger.log(`Received Chatwoot event: ${event}`);

      if (event === 'message_created' && payload.message_type === 'outgoing') {
        await this.handleAgentReply(payload);
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

  private async handleAgentReply(data: ChatwootMessagePayload) {
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

    // Store agent reply
    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'agent',
        content,
      },
    });

    // Send to customer via WhatsApp
    await this.senderService.sendMessage({
      client: {
        metaAccessToken: conversation.client.metaAccessToken,
        whatsappPhoneNumberId: conversation.client.whatsappPhoneNumberId,
      },
      to: conversation.customer.phoneNumber,
      message: content,
    });

    this.logger.log(
      `Agent reply forwarded to ${conversation.customer.phoneNumber} for conversation ${conversation.id}`,
    );
  }

  private async handleConversationResolved(chatwootConversationId?: number) {
    if (!chatwootConversationId) return;

    const conversation = await this.prisma.conversation.findFirst({
      where: { chatwootConversationId },
      include: { client: true, customer: true },
    });

    if (!conversation || conversation.status === 'resolved') return;

    const resolvedAt = new Date();

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: 'resolved', resolvedAt },
    });

    await this.prisma.handoffLog.updateMany({
      where: { conversationId: conversation.id, resolvedAt: null },
      data: { resolvedAt },
    });

    this.logger.log(`Conversation ${conversation.id} resolved from Chatwoot`);

    // Send CSAT rating request to the customer
    if (conversation.client.csatEnabled) {
      const csatMessage =
        conversation.client.csatMessage ||
        'Thank you for chatting with us! How would you rate your experience? Please reply with a number from 1 (poor) to 5 (excellent).';
      try {
        await this.senderService.sendMessage({
          client: {
            metaAccessToken: conversation.client.metaAccessToken,
            whatsappPhoneNumberId: conversation.client.whatsappPhoneNumberId,
          },
          to: conversation.customer.phoneNumber,
          message: csatMessage,
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
