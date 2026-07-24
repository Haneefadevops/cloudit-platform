import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { BookingActionsService } from '../bookings/booking-actions.service';
import { OrderActionsService } from '../orders/order-actions.service';
import { PlaygroundMessageDto } from './dto/playground-message.dto';

const BOOKING_ACTION_TYPES = [
  'check_availability',
  'create_booking',
  'cancel_booking',
  'reschedule_booking',
];

@Injectable()
export class PlaygroundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly knowledgeBaseService: KnowledgeBaseService,
    private readonly bookingActionsService: BookingActionsService,
    private readonly orderActionsService: OrderActionsService,
  ) {}

  async run(clientId: string, dto: PlaygroundMessageDto) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
    });
    if (!client) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }

    const searchResults = await this.knowledgeBaseService.search(
      clientId,
      dto.message,
      3,
    );
    const knowledgeContext = searchResults.length
      ? searchResults.map((r) => `- ${r.content}`).join('\n---\n')
      : '';

    const history = dto.history?.length
      ? dto.history
          .map((h) => `${h.role}: ${h.content}`)
          .join('\n')
      : undefined;

    // Modules: act on real data via a dedicated playground customer so staff
    // can test booking/order flows end-to-end without WhatsApp.
    let bookingContext: Awaited<
      ReturnType<BookingActionsService['buildPromptContext']>
    > | null = null;
    let orderContext: Awaited<
      ReturnType<OrderActionsService['buildPromptContext']>
    > | null = null;
    let playgroundCustomer: {
      id: string;
      name: string | null;
      phoneNumber: string;
    } | null = null;
    if (client.bookingsEnabled || client.ordersEnabled) {
      playgroundCustomer = await this.prisma.customer.upsert({
        where: {
          clientId_phoneNumber: { clientId, phoneNumber: 'playground' },
        },
        update: {},
        create: {
          clientId,
          phoneNumber: 'playground',
          name: 'Playground Tester',
        },
      });
      if (client.bookingsEnabled) {
        bookingContext = await this.bookingActionsService.buildPromptContext(
          client,
          playgroundCustomer.id,
        );
      }
      if (client.ordersEnabled) {
        orderContext = await this.orderActionsService.buildPromptContext(
          client,
          playgroundCustomer.id,
          null, // playground drafts are keyed on the customer, no conversation
        );
      }
    }

    const aiInput = {
      client: {
        name: client.name,
        businessProfile: client.businessProfile as any,
        products: Array.isArray(client.products) ? client.products : undefined,
        systemPrompt: client.systemPrompt || undefined,
        aiTemperature: client.aiTemperature,
        maxTokens: client.maxTokens,
        fallbackMessage: client.fallbackMessage || undefined,
        language: client.language || undefined,
        ...(bookingContext
          ? {
              bookingsEnabled: true,
              bookingApprovalMode: client.bookingApprovalMode,
              services: bookingContext.services,
              staff: bookingContext.staff,
              upcomingBookings: bookingContext.upcomingBookings,
            }
          : {}),
        ...(orderContext
          ? {
              ordersEnabled: true,
              paymentInstructions: client.paymentInstructions,
              catalog: orderContext.catalog,
              fulfilment: orderContext.fulfilment,
              currentDraft: orderContext.currentDraft,
            }
          : {}),
      },
      customer: { name: playgroundCustomer?.name },
      message: dto.message,
      history,
      knowledgeContext: knowledgeContext || undefined,
    };

    const aiResult = await this.aiService.generateReply(aiInput);

    // Execute an action if the AI requested one, then let the AI phrase the
    // reply from the authoritative result (same loop as WhatsApp, minus
    // Chatwoot notifications and handoff).
    let reply = aiResult.reply;
    let actionResult: string | null = null;
    if (aiResult.action && playgroundCustomer) {
      const result = BOOKING_ACTION_TYPES.includes(aiResult.action.type)
        ? await this.bookingActionsService.execute({
            client,
            customer: playgroundCustomer,
            action: aiResult.action,
          })
        : await this.orderActionsService.execute({
            client,
            customer: playgroundCustomer,
            conversationId: null,
            action: aiResult.action,
          });
      actionResult = result.summary;
      const followUp = await this.aiService.generateReply({
        ...aiInput,
        actionResult: result.summary,
      });
      reply = followUp.reply;
    }

    return {
      reply,
      handoffRecommended: aiResult.handoff,
      handoffReason: aiResult.handoffReason,
      action: aiResult.action ?? null,
      actionResult,
      sources: searchResults.map((r) => ({
        documentId: r.id,
        preview: r.content.slice(0, 200),
        score: r.similarity,
      })),
      usage: aiResult.metadata?.usage ?? null,
    };
  }
}
