import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ChatwootService } from '../chatwoot/chatwoot.service';

const URGENT_KEYWORDS = ['urgent', 'complaint', 'refund', 'missing', 'wrong', 'cancel', 'not received'];

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatwootService: ChatwootService,
    private readonly configService: ConfigService,
  ) {}

  async findActiveByCustomer(customerId: string) {
    return this.prisma.conversation.findFirst({
      where: {
        customerId,
        status: { in: ['bot', 'human'] },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: { clientId: string; customerId: string }) {
    return this.prisma.conversation.create({
      data: {
        clientId: data.clientId,
        customerId: data.customerId,
        status: 'bot',
      },
    });
  }

  async handoffToHuman(input: {
    conversationId: string;
    triggeredBy: string;
    reason: string;
    assignedToId?: string;
  }) {
    const { conversationId, triggeredBy, reason, assignedToId } = input;

    const conversation = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        status: 'human',
        handoffReason: reason,
        assignedToId,
      },
    });

    await this.prisma.handoffLog.create({
      data: {
        conversationId,
        triggeredBy,
        reason,
        assignedAgentId: assignedToId,
      },
    });

    // Push handoff to Chatwoot if the client is connected
    await this.pushHandoffToChatwoot(conversationId, reason);

    // Optional n8n alert for urgent handoffs
    await this.notifyUrgentHandoff(conversationId, reason, triggeredBy);

    return conversation;
  }

  private async pushHandoffToChatwoot(
    conversationId: string,
    reason: string,
  ) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { customer: true, client: true },
    });

    if (!conversation) return;
    const { client, customer } = conversation;

    if (!client.chatwootAccountId || !client.chatwootInboxId) {
      this.logger.log(
        `Client ${client.id} has no Chatwoot setup; skipping Chatwoot handoff push`,
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
        const recentMessages = await this.prisma.message.findMany({
          where: { conversationId: conversation.id },
          orderBy: { createdAt: 'asc' },
          take: 20,
        });

        const contextLines = recentMessages
          .map((m) => `${m.senderType}: ${m.content}`)
          .join('\n');

        const initialContent = `Handed off to human agent.\n\nReason: ${reason}\n\nRecent conversation:\n${contextLines}`;

        const chatwootConversation =
          await this.chatwootService.createConversation(
            client.chatwootAccountId,
            client.chatwootInboxId,
            chatwootContactId,
            initialContent,
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

        // Apply handoff labels in Chatwoot
        const labels = ['ai-handoff'];
        const lowerReason = reason.toLowerCase();
        if (URGENT_KEYWORDS.some((k) => lowerReason.includes(k))) {
          labels.push('urgent');
        }
        await this.chatwootService.addLabelsToConversation(
          client.chatwootAccountId,
          chatwootConversationId,
          labels,
        );
      }

      this.logger.log(
        `Pushed handoff for conversation ${conversation.id} to Chatwoot conversation ${chatwootConversationId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to push handoff to Chatwoot: ${(error as Error).message}`,
      );
    }
  }

  private async notifyUrgentHandoff(
    conversationId: string,
    reason: string,
    triggeredBy: string,
  ) {
    const webhookUrl = this.configService.get<string>('N8N_WEBHOOK_URL', '');
    if (!webhookUrl) return;

    const lowerReason = reason.toLowerCase();
    if (!URGENT_KEYWORDS.some((k) => lowerReason.includes(k))) return;

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'urgent_handoff',
          conversationId,
          reason,
          triggeredBy,
          timestamp: new Date().toISOString(),
        }),
      });
      this.logger.log(`Sent urgent handoff alert to n8n for conversation ${conversationId}`);
    } catch (error) {
      this.logger.error(
        `Failed to send n8n alert: ${(error as Error).message}`,
      );
    }
  }

  async resolve(id: string) {
    return this.prisma.conversation.update({
      where: { id },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
      },
    });
  }

  async assignToAgent(id: string, assignedToId: string) {
    return this.prisma.conversation.update({
      where: { id },
      data: { assignedToId },
    });
  }

  async findAllForAgent(agentId: string, status?: string) {
    return this.prisma.conversation.findMany({
      where: {
        assignedToId: agentId,
        ...(status ? { status } : {}),
      },
      include: {
        customer: true,
        client: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findAll(status?: string) {
    return this.prisma.conversation.findMany({
      where: status ? { status } : undefined,
      include: {
        customer: true,
        client: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.conversation.findUnique({
      where: { id },
      include: {
        customer: true,
        client: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
  }
}
