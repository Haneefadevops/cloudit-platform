import { Controller, Post, Body, Logger } from '@nestjs/common';
import { ChatwootService } from './chatwoot.service';
import { WhatsAppSenderService } from '../whatsapp-sender/whatsapp-sender.service';
import { PrismaService } from '../prisma/prisma.service';

interface ChatwootMessagePayload {
  event: string;
  id?: number;
  content?: string;
  message_type?: string;
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
        event === 'conversation_resolved' ||
        (event === 'conversation_status_changed' && payload.conversation?.status === 'resolved') ||
        (event === 'conversation_updated' && payload.conversation?.status === 'resolved')
      ) {
        await this.handleConversationResolved(payload.conversation?.id ?? payload.id);
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
    });

    if (!conversation) return;

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: 'resolved', resolvedAt: new Date() },
    });

    this.logger.log(`Conversation ${conversation.id} resolved from Chatwoot`);
  }
}
