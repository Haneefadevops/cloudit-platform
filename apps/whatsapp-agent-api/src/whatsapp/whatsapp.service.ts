import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { ConversationsService } from '../conversations/conversations.service';
import { CustomersService } from '../customers/customers.service';
import { ClientsService } from '../clients/clients.service';
import { WhatsAppSenderService } from '../whatsapp-sender/whatsapp-sender.service';
import { ChatwootService } from '../chatwoot/chatwoot.service';

interface MetaMessage {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
  timestamp: string;
}

interface MetaEntry {
  id: string;
  changes: Array<{
    value: {
      metadata: { phone_number_id: string; display_phone_number: string };
      contacts?: Array<{ wa_id: string; profile: { name: string } }>;
      messages?: MetaMessage[];
    };
  }>;
}

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly conversationsService: ConversationsService,
    private readonly customersService: CustomersService,
    private readonly clientsService: ClientsService,
    private readonly senderService: WhatsAppSenderService,
    private readonly chatwootService: ChatwootService,
  ) {}

  async handleIncomingWebhook(payload: unknown): Promise<void> {
    const entries = (payload as { entry?: MetaEntry[] }).entry || [];

    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value;
        const phoneNumberId = value.metadata?.phone_number_id;
        const messages = value.messages || [];

        for (const message of messages) {
          if (message.type !== 'text' || !message.text?.body) {
            continue;
          }

          await this.handleIncomingMessage({
            phoneNumberId,
            from: message.from,
            messageBody: message.text.body,
            contactName: value.contacts?.[0]?.profile?.name,
          });
        }
      }
    }
  }

  private async handleIncomingMessage(input: {
    phoneNumberId: string;
    from: string;
    messageBody: string;
    contactName?: string;
  }): Promise<void> {
    const { phoneNumberId, from, messageBody, contactName } = input;

    // 1. Find the client by WhatsApp phone number ID
    const client = await this.clientsService.findByPhoneNumberId(phoneNumberId);
    if (!client) {
      this.logger.warn(`No client found for phone number ID: ${phoneNumberId}`);
      return;
    }

    if (client.status !== 'active') {
      this.logger.warn(`Client ${client.id} is not active`);
      return;
    }

    // 2. Find or create customer
    const customer = await this.customersService.findOrCreate({
      clientId: client.id,
      phoneNumber: from,
      name: contactName,
    });

    // 3. Find or create conversation
    let conversation = await this.conversationsService.findActiveByCustomer(
      customer.id,
    );

    if (!conversation) {
      conversation = await this.conversationsService.create({
        clientId: client.id,
        customerId: customer.id,
      });
    }

    // 4. Store customer message
    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'customer',
        content: messageBody,
      },
    });

    // 5. If conversation is handled by human, forward to Chatwoot
    if (conversation.status === 'human') {
      this.logger.log(
        `Conversation ${conversation.id} is with human agent. Forwarding to Chatwoot.`,
      );
      await this.forwardToChatwoot(client, customer, conversation, messageBody);
      return;
    }

    // 6. Check for handoff keywords (client-configurable)
    const lowerMessage = messageBody.toLowerCase();
    const handoffKeywords = client.handoffKeywords
      ? client.handoffKeywords
          .split(',')
          .map((k) => k.trim().toLowerCase())
          .filter(Boolean)
      : [
          'human',
          'agent',
          'person',
          'manager',
          'supervisor',
          'complaint',
          'refund',
          'return',
          'wrong',
          'missing',
          'cancel order',
          'change order',
          'not received',
          'speak to someone',
          'talk to someone',
          'real person',
        ];

    const wantsHuman = handoffKeywords.some((keyword) =>
      lowerMessage.includes(keyword),
    );

    if (wantsHuman) {
      await this.conversationsService.handoffToHuman({
        conversationId: conversation.id,
        triggeredBy: 'customer',
        reason: `Customer requested human agent or used trigger keyword: "${messageBody}"`,
      });

      await this.senderService.sendMessage({
        client,
        to: from,
        message:
          client.fallbackMessage ||
          'I understand. Let me connect you with one of our team members. They will be with you shortly.',
      });
      return;
    }

    // 7. Get conversation history for context
    const recentMessages = await this.prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const history = recentMessages
      .reverse()
      .map((msg) => `${msg.senderType}: ${msg.content}`)
      .join('\n');

    // 8. Call Kimi AI
    const aiResult = await this.aiService.generateReply({
      client: {
        name: client.name,
        businessProfile: client.businessProfile as any,
        products: Array.isArray(client.products) ? client.products : undefined,
        systemPrompt: client.systemPrompt || undefined,
        aiTemperature: client.aiTemperature,
        maxTokens: client.maxTokens,
      },
      customer: {
        name: customer.name,
        metadata: customer.metadata as any,
      },
      message: messageBody,
      history,
    });

    // 9. Store AI message
    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'bot',
        content: aiResult.reply,
        kimiMetadata: aiResult.metadata || {},
      },
    });

    // 10. Handle AI-triggered handoff
    if (aiResult.handoff) {
      await this.conversationsService.handoffToHuman({
        conversationId: conversation.id,
        triggeredBy: 'bot',
        reason: aiResult.handoffReason || 'AI requested human handoff',
      });
    }

    // 11. Send AI reply to customer
    await this.senderService.sendMessage({
      client,
      to: from,
      message: aiResult.reply,
    });
  }

  private async forwardToChatwoot(
    client: { chatwootAccountId?: number | null; chatwootInboxId?: number | null },
    customer: { id: string; phoneNumber: string; name?: string | null; chatwootContactId?: number | null },
    conversation: { id: string; chatwootConversationId?: number | null },
    content: string,
  ) {
    if (!client.chatwootAccountId || !client.chatwootInboxId) {
      this.logger.log(
        `Client ${client.chatwootAccountId ? '' : 'missing account'} ${client.chatwootInboxId ? '' : 'missing inbox'}; cannot forward to Chatwoot`,
      );
      return;
    }

    try {
      let chatwootContactId = customer.chatwootContactId;
      if (!chatwootContactId) {
        const contact = await this.chatwootService.createContact(
          client.chatwootAccountId,
          customer.phoneNumber,
          customer.name || undefined,
        );
        chatwootContactId = contact.payload.contact.id;
        await this.prisma.customer.update({
          where: { id: customer.id },
          data: { chatwootContactId },
        });
      }

      let chatwootConversationId = conversation.chatwootConversationId;
      if (!chatwootConversationId) {
        const chatwootConversation =
          await this.chatwootService.createConversation(
            client.chatwootAccountId,
            client.chatwootInboxId,
            chatwootContactId,
            content,
          );
        chatwootConversationId = chatwootConversation.id;
        await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: {
            chatwootConversationId,
            chatwootContactId,
            chatwootInboxId: client.chatwootInboxId,
          },
        });
      } else {
        await this.chatwootService.sendMessage(
          client.chatwootAccountId,
          chatwootConversationId,
          content,
          'incoming',
        );
      }

      this.logger.log(
        `Forwarded customer message to Chatwoot conversation ${chatwootConversationId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to forward message to Chatwoot: ${(error as Error).message}`,
      );
    }
  }

  async sendWhatsAppMessage(input: {
    client: { metaAccessToken: string; whatsappPhoneNumberId: string };
    to: string;
    message: string;
  }): Promise<void> {
    return this.senderService.sendMessage(input);
  }
}
