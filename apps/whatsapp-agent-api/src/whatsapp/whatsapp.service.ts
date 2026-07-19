import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { ConversationsService } from '../conversations/conversations.service';
import { CustomersService } from '../customers/customers.service';
import { ClientsService } from '../clients/clients.service';
import { WhatsAppSenderService } from '../whatsapp-sender/whatsapp-sender.service';
import { ChatwootService } from '../chatwoot/chatwoot.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { MediaService, IncomingMediaType } from './media.service';

interface MetaMedia {
  id: string;
  mime_type?: string;
  caption?: string;
  filename?: string;
}

interface MetaMessage {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
  image?: MetaMedia;
  audio?: MetaMedia;
  voice?: MetaMedia;
  document?: MetaMedia;
  timestamp: string;
}

interface IncomingMedia {
  type: IncomingMediaType;
  mediaId: string;
  caption?: string;
  filename?: string;
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
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly mediaService: MediaService,
  ) {}

  async handleIncomingWebhook(payload: unknown): Promise<void> {
    const entries = (payload as { entry?: MetaEntry[] }).entry || [];

    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value;
        const phoneNumberId = value.metadata?.phone_number_id;
        const messages = value.messages || [];

        for (const message of messages) {
          const contactName = value.contacts?.[0]?.profile?.name;

          if (message.type === 'text' && message.text?.body) {
            await this.handleIncomingMessage({
              phoneNumberId,
              from: message.from,
              messageBody: message.text.body,
              contactName,
            });
            continue;
          }

          const media = this.extractMedia(message);
          if (media) {
            await this.handleIncomingMessage({
              phoneNumberId,
              from: message.from,
              messageBody: '',
              contactName,
              media,
            });
          }
        }
      }
    }
  }

  private extractMedia(message: MetaMessage): IncomingMedia | null {
    if (message.type === 'image' && message.image?.id) {
      return {
        type: 'image',
        mediaId: message.image.id,
        caption: message.image.caption,
      };
    }
    if (message.type === 'audio' && message.audio?.id) {
      return { type: 'audio', mediaId: message.audio.id };
    }
    if (message.type === 'voice' && message.voice?.id) {
      return { type: 'audio', mediaId: message.voice.id };
    }
    if (message.type === 'document' && message.document?.id) {
      return {
        type: 'document',
        mediaId: message.document.id,
        caption: message.document.caption,
        filename: message.document.filename,
      };
    }
    return null;
  }

  private async handleIncomingMessage(input: {
    phoneNumberId: string;
    from: string;
    messageBody: string;
    contactName?: string;
    media?: IncomingMedia;
  }): Promise<void> {
    const { phoneNumberId, from, contactName } = input;
    let { messageBody } = input;

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

    // Convert incoming media (voice/image/document) to text for the AI flow
    if (input.media) {
      messageBody = await this.mediaService.mediaToText({
        ...input.media,
        accessToken: client.metaAccessToken,
      });
    }

    if (!messageBody) {
      this.logger.warn('Skipping message with no processable content');
      return;
    }

    // 2. Find or create customer
    const customer = await this.customersService.findOrCreate({
      clientId: client.id,
      phoneNumber: from,
      name: contactName,
    });

    // 2.5 If the customer is replying to a CSAT rating request, capture it
    const csatHandled = await this.handleCsatResponse(
      client,
      customer,
      messageBody,
      from,
    );
    if (csatHandled) return;

    // 3. Find or create conversation
    let conversation = await this.conversationsService.findActiveByCustomer(
      customer.id,
    );

    if (!conversation) {
      // Send the welcome message on the customer's first-ever conversation
      const previousConversations = await this.prisma.conversation.count({
        where: { customerId: customer.id },
      });

      conversation = await this.conversationsService.create({
        clientId: client.id,
        customerId: customer.id,
      });

      if (previousConversations === 0 && client.welcomeMessage) {
        await this.prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderType: 'bot',
            content: client.welcomeMessage,
          },
        });
        await this.senderService.sendMessage({
          client,
          to: from,
          message: client.welcomeMessage,
        });
      }
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
      const outsideHours = !this.isWithinOperatingHours(client);
      const reason = outsideHours
        ? 'Customer requested human agent outside operating hours'
        : `Customer requested human agent or used trigger keyword: "${messageBody}"`;

      await this.conversationsService.handoffToHuman({
        conversationId: conversation.id,
        triggeredBy: outsideHours ? 'system' : 'customer',
        reason,
      });

      const handoffMessage = outsideHours
        ? client.outsideHoursMessage ||
          'Thank you for contacting us! We are currently outside our business hours. Please leave your message and our team will get back to you as soon as we open.'
        : client.fallbackMessage ||
          'We will connect you to one of our available agents.';

      await this.senderService.sendMessage({
        client,
        to: from,
        message: handoffMessage,
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

    // 8. Search knowledge base for relevant context
    let knowledgeContext = '';
    try {
      const searchResults = await this.knowledgeBaseService.search(
        client.id,
        messageBody,
        3,
      );
      if (searchResults.length > 0) {
        knowledgeContext = searchResults
          .map((r) => `- ${r.content}`)
          .join('\n---\n');
      }
    } catch (error) {
      this.logger.warn(
        `Knowledge base search failed: ${(error as Error).message}`,
      );
    }

    // 9. Call Kimi AI
    const aiResult = await this.aiService.generateReply({
      client: {
        name: client.name,
        businessProfile: client.businessProfile as any,
        products: Array.isArray(client.products) ? client.products : undefined,
        systemPrompt: client.systemPrompt || undefined,
        aiTemperature: client.aiTemperature,
        maxTokens: client.maxTokens,
        fallbackMessage: client.fallbackMessage || undefined,
      },
      customer: {
        name: customer.name,
        metadata: customer.metadata as any,
      },
      message: messageBody,
      history,
      knowledgeContext,
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
        // Fetch full conversation history so the human agent has context
        const historyMessages = await this.prisma.message.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: 'asc' },
        });

        const history = historyMessages.map((msg) => ({
          content: msg.content,
          senderType: msg.senderType,
        }));

        const chatwootConversation =
          await this.chatwootService.createConversation(
            client.chatwootAccountId,
            client.chatwootInboxId,
            chatwootContactId,
            undefined,
            history,
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

  /**
   * Checks the client's operating hours (in the client's timezone) and closed days.
   * Returns true when the business is currently open. Fails open (true) when
   * hours are not configured or the timezone is invalid.
   */
  private isWithinOperatingHours(client: {
    operatingHoursStart?: string | null;
    operatingHoursEnd?: string | null;
    closedDays?: string | null;
    timezone?: string | null;
  }): boolean {
    const { operatingHoursStart, operatingHoursEnd, closedDays } = client;
    if (!operatingHoursStart || !operatingHoursEnd) return true;

    let localNow: Date;
    try {
      localNow = new Date(
        new Date().toLocaleString('en-US', {
          timeZone: client.timezone || 'UTC',
        }),
      );
      if (isNaN(localNow.getTime())) return true;
    } catch {
      return true;
    }

    const dayName = localNow
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toLowerCase();
    const closed = (closedDays || '')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    if (closed.includes(dayName)) return false;

    const [sh, sm] = operatingHoursStart.split(':').map(Number);
    const [eh, em] = operatingHoursEnd.split(':').map(Number);
    if ([sh, sm, eh, em].some((n) => isNaN(n))) return true;

    const minutes = localNow.getHours() * 60 + localNow.getMinutes();
    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;

    // Supports overnight ranges (e.g. 22:00 - 02:00)
    if (startMinutes <= endMinutes) {
      return minutes >= startMinutes && minutes < endMinutes;
    }
    return minutes >= startMinutes || minutes < endMinutes;
  }

  /**
   * Captures a 1-5 rating when the customer replies to a CSAT request sent
   * after their conversation was resolved. Returns true when the message was
   * consumed as a rating and the normal flow should stop.
   */
  private async handleCsatResponse(
    client: { id: string; metaAccessToken: string; whatsappPhoneNumberId: string },
    customer: { id: string },
    messageBody: string,
    from: string,
  ): Promise<boolean> {
    const pending = await this.prisma.conversation.findFirst({
      where: { customerId: customer.id, csatPending: true },
      orderBy: { resolvedAt: 'desc' },
    });
    if (!pending) return false;

    const ratingMatch = messageBody.trim().match(/^([1-5])\b/);

    if (!ratingMatch) {
      // Customer started a new topic instead of rating; expire the request
      await this.prisma.conversation.update({
        where: { id: pending.id },
        data: { csatPending: false },
      });
      return false;
    }

    const rating = Number(ratingMatch[1]);
    const feedback = messageBody.trim().slice(1).trim() || null;

    await this.prisma.conversation.update({
      where: { id: pending.id },
      data: { csatPending: false, csatRating: rating, csatFeedback: feedback },
    });

    await this.prisma.handoffLog.updateMany({
      where: { conversationId: pending.id, customerSatisfaction: null },
      data: { customerSatisfaction: rating },
    });

    await this.prisma.message.create({
      data: {
        conversationId: pending.id,
        senderType: 'customer',
        content: messageBody,
      },
    });

    const thankYou =
      rating >= 4
        ? 'Thank you for your feedback! We are glad we could help.'
        : 'Thank you for your feedback. We will use it to improve our service.';

    await this.prisma.message.create({
      data: {
        conversationId: pending.id,
        senderType: 'bot',
        content: thankYou,
      },
    });

    await this.senderService.sendMessage({
      client,
      to: from,
      message: thankYou,
    });

    // Post the rating as a private note in Chatwoot so the agent can see it
    try {
      const conversationWithClient = await this.prisma.conversation.findUnique({
        where: { id: pending.id },
        include: { client: true, customer: true },
      });

      if (
        conversationWithClient?.chatwootConversationId &&
        conversationWithClient.client.chatwootAccountId
      ) {
        const csatNote = `Customer rated the conversation ${rating}/5${feedback ? `\nFeedback: ${feedback}` : ''}`;
        await this.chatwootService.sendMessage(
          conversationWithClient.client.chatwootAccountId,
          conversationWithClient.chatwootConversationId,
          csatNote,
          'outgoing',
          true,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Failed to post CSAT note to Chatwoot: ${(error as Error).message}`,
      );
    }

    this.logger.log(
      `Captured CSAT rating ${rating} for conversation ${pending.id}`,
    );
    return true;
  }

  async sendWhatsAppMessage(input: {
    client: { metaAccessToken: string; whatsappPhoneNumberId: string };
    to: string;
    message: string;
  }): Promise<void> {
    return this.senderService.sendMessage(input);
  }
}
