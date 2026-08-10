import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { ConversationsService } from '../conversations/conversations.service';
import { CustomersService } from '../customers/customers.service';
import { ClientsService } from '../clients/clients.service';
import { WhatsAppSenderService } from '../whatsapp-sender/whatsapp-sender.service';
import { ChatwootService } from '../chatwoot/chatwoot.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { BookingActionsService } from '../bookings/booking-actions.service';
import type { BookingActionResult } from '../bookings/booking-actions.service';
import { OrderActionsService } from '../orders/order-actions.service';
import type { OrderActionResult } from '../orders/order-actions.service';
import { UsageService } from '../usage/usage.service';
import { StaffAlertsService } from '../staff-alerts/staff-alerts.service';
import { WorkflowRuntimeService } from '../workflows/workflow-runtime.service';

/** Max AI replies per conversation before handing off to the human team. */
export const AI_REPLY_LIMIT = 50;

/** Polite note sent when the reply cap is reached. */
export const AI_REPLY_LIMIT_MESSAGE =
  "I've noted everything so far; let me get our team to continue with you.";
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
  referral?: Record<string, unknown>;
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
    private readonly bookingActionsService: BookingActionsService,
    private readonly orderActionsService: OrderActionsService,
    private readonly usageService: UsageService,
    private readonly mediaService: MediaService,
    private readonly staffAlertsService: StaffAlertsService,
    private readonly workflowRuntime: WorkflowRuntimeService,
  ) {}

  /**
   * Verifies Meta's `x-hub-signature-256` header against the raw request
   * body using the app secret (HMAC-SHA256, timing-safe compare).
   *
   * Throws 401 when the signature is missing or invalid. When
   * META_APP_SECRET is not configured the check is skipped with a loud
   * warning — this keeps the webhook alive during rollout, but the secret
   * MUST be set in production or anyone can POST fabricated messages.
   */
  verifySignature(rawBody: Buffer | undefined, signature: string | undefined): void {
    const appSecret = this.configService.get<string>('META_APP_SECRET');
    if (!appSecret) {
      this.logger.warn(
        'META_APP_SECRET is not set — skipping webhook signature verification. Set it to secure the webhook.',
      );
      return;
    }

    if (!signature || !rawBody) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    const expected =
      'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');

    const received = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      received.length !== expectedBuffer.length ||
      !timingSafeEqual(received, expectedBuffer)
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

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
              messageId: message.id,
              messageBody: message.text.body,
              contactName,
              referral: message.referral,
            });
            continue;
          }

          const media = this.extractMedia(message);
          if (media) {
            await this.handleIncomingMessage({
              phoneNumberId,
              from: message.from,
              messageId: message.id,
              messageBody: '',
              contactName,
              media,
              referral: message.referral,
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
    phoneNumberId?: string;
    from?: string;
    messageId?: string;
    messageBody: string;
    contactName?: string;
    media?: IncomingMedia;
    referral?: Record<string, unknown>;
    // Non-WhatsApp channels bridged through Chatwoot:
    channel?: string; // default 'whatsapp'; 'messenger' | 'instagram'
    clientId?: string; // pre-resolved client for channel messages
    channelSourceId?: string; // Meta PSID/IGSID
    chatwootConversationId?: number; // native Chatwoot conversation
  }): Promise<void> {
    const { from, contactName } = input;
    const channel = input.channel || 'whatsapp';
    let { messageBody } = input;

    // 1. Find the client — by WhatsApp phone number ID for the Meta webhook,
    // or directly by id for channel messages routed from Chatwoot.
    const client = input.clientId
      ? await this.clientsService.findOne(input.clientId)
      : await this.clientsService.findByPhoneNumberId(
          input.phoneNumberId as string,
        );
    if (!client) {
      this.logger.warn(`No client found for incoming message (${channel})`);
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

    // 2. Find or create customer (phone-based on WhatsApp, source-ID based
    // on Messenger/Instagram)
    const customer = await this.customersService.findOrCreate({
      clientId: client.id,
      phoneNumber: channel === 'whatsapp' ? from : undefined,
      name: contactName,
      channel,
      channelSourceId: input.channelSourceId,
      ...(input.referral ? { leadSource: 'ctwa_ad' } : {}),
    });

    // 2.5 If the customer is replying to a CSAT rating request, capture it
    // (WhatsApp only — CSAT requests are only sent to WhatsApp customers)
    if (channel === 'whatsapp' && from) {
      const csatHandled = await this.handleCsatResponse(
        client,
        customer,
        messageBody,
        from,
      );
      if (csatHandled) return;
    }

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
        channel,
        ...(input.referral
          ? { referral: input.referral as unknown as Prisma.InputJsonValue }
          : {}),
      });

      // Channel messages arrive from an existing Chatwoot conversation —
      // link it so agent replies and bot replies route back through it.
      if (input.chatwootConversationId) {
        conversation = await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: { chatwootConversationId: input.chatwootConversationId },
        });
      }

      if (previousConversations === 0 && client.welcomeMessage) {
        await this.prisma.message.create({
          data: {
            conversationId: conversation.id,
            senderType: 'bot',
            content: client.welcomeMessage,
          },
        });
        await this.sendToCustomer({
          client,
          channel,
          to: from,
          chatwootConversationId: conversation.chatwootConversationId,
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

    // 5. If conversation is handled by human, forward to Chatwoot.
    // Messenger/Instagram messages already live in Chatwoot natively — the
    // agent sees them without any forwarding.
    if (conversation.status === 'human') {
      if (channel === 'whatsapp') {
        this.logger.log(
          `Conversation ${conversation.id} is with human agent. Forwarding to Chatwoot.`,
        );
        await this.forwardToChatwoot(client, customer, conversation, messageBody);
      }
      return;
    }

    // 5.5 Usage wallet: when the AI allowance is exhausted, hand the
    // conversation to the team without calling the AI. Resuming is
    // automatic — a top-up raises the balance above 0 and the next
    // message flows through the AI again.
    const usage = await this.usageService.getUsage(client.id);
    if (usage && usage.balance <= 0) {
      const pausedMessage =
        client.aiPausedMessage ||
        'Thanks for your message! Our team will reply to you shortly.';
      const handedOff = await this.conversationsService.handoffToHuman({
        conversationId: conversation.id,
        triggeredBy: 'system',
        reason: 'AI allowance exhausted',
      });
      const pausedContent = this.withTicketRef(
        pausedMessage,
        handedOff.ticketRef,
      );
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderType: 'bot',
          content: pausedContent,
        },
      });
      await this.sendToCustomer({
        client,
        channel,
        to: from,
        chatwootConversationId: conversation.chatwootConversationId,
        message: pausedContent,
      });
      this.logger.log(
        `Client ${client.id} AI allowance exhausted; conversation ${conversation.id} handed off`,
      );
      return;
    }

    // 5.6 Abuse guard: cap AI replies per conversation so worst-case token
    // spend is bounded regardless of the per-conversation pricing.
    const botReplyCount = await this.prisma.message.count({
      where: { conversationId: conversation.id, senderType: 'bot' },
    });
    if (botReplyCount >= AI_REPLY_LIMIT) {
      const handedOff = await this.conversationsService.handoffToHuman({
        conversationId: conversation.id,
        triggeredBy: 'system',
        reason: `Conversation reached the ${AI_REPLY_LIMIT}-reply AI limit`,
      });
      const limitContent = this.withTicketRef(
        AI_REPLY_LIMIT_MESSAGE,
        handedOff.ticketRef,
      );
      await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderType: 'bot',
          content: limitContent,
        },
      });
      await this.sendToCustomer({
        client,
        channel,
        to: from,
        chatwootConversationId: conversation.chatwootConversationId,
        message: limitContent,
      });
      this.logger.log(
        `Conversation ${conversation.id} reached the ${AI_REPLY_LIMIT}-reply AI limit; handed off`,
      );
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

      const handedOff = await this.conversationsService.handoffToHuman({
        conversationId: conversation.id,
        triggeredBy: outsideHours ? 'system' : 'customer',
        reason,
      });

      const handoffMessage = outsideHours
        ? client.outsideHoursMessage ||
          'Thank you for contacting us! We are currently outside our business hours. Please leave your message and our team will get back to you as soon as we open.'
        : client.fallbackMessage ||
          'We will connect you to one of our available agents.';

      await this.sendToCustomer({
        client,
        channel,
        to: from,
        chatwootConversationId: conversation.chatwootConversationId,
        message: this.withTicketRef(handoffMessage, handedOff.ticketRef),
      });
      return;
    }

    // 6.5 Show the "typing…" indicator on the customer's phone while the AI
    // prepares its reply (lasts up to 25s or until the reply is sent; also
    // marks the incoming message as read). WhatsApp only — Chatwoot channels
    // show their own read/typing state.
    if (channel === 'whatsapp' && input.messageId) {
      await this.senderService.sendTypingIndicator({
        client,
        messageId: input.messageId,
      });
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
        // The search returns cosine similarity in [0, 1] (1 = identical). The
        // confidence threshold is a minimum similarity; scores below it are
        // treated as no relevant context, so the AI falls back to the client
        // fallback message and triggers handoff.
        const bestScore = searchResults[0].similarity;
        const threshold = client.confidenceThreshold ?? 0;
        if (threshold > 0 && bestScore < threshold) {
          this.logger.log(
            `KB best score ${bestScore.toFixed(4)} below client confidence threshold ${threshold}; treating as no relevant context`,
          );
        } else {
          knowledgeContext = searchResults
            .map((r) => `- ${r.content}`)
            .join('\n---\n');
        }
      }
    } catch (error) {
      this.logger.warn(
        `Knowledge base search failed: ${(error as Error).message}`,
      );
    }

    // 8.5 Load module context (bookings / orders) for enabled modules
    const bookingContext = client.bookingsEnabled
      ? await this.bookingActionsService.buildPromptContext(client, customer.id)
      : null;
    const orderContext = client.ordersEnabled
      ? await this.orderActionsService.buildPromptContext(
          client,
          customer.id,
          conversation.id,
        )
      : null;

    // 8.6 AI workflows: load the client's playbooks and resume any session
    // already running on this conversation. Zero overhead (and zero prompt
    // change) for clients without workflows.
    let activeWorkflows: Awaited<
      ReturnType<WorkflowRuntimeService['findActiveWorkflows']>
    > = [];
    let workflowSession: Awaited<
      ReturnType<WorkflowRuntimeService['findActiveSession']>
    > = null;
    try {
      activeWorkflows = await this.workflowRuntime.findActiveWorkflows(
        client.id,
      );
      if (activeWorkflows.length) {
        workflowSession = await this.workflowRuntime.findActiveSession(
          conversation.id,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Workflow load failed: ${(error as Error).message}`,
      );
    }

    // 9. Call Kimi AI
    const aiInput = {
      client: {
        name: client.name,
        businessProfile: client.businessProfile as any,
        products: Array.isArray(client.products) ? client.products : undefined,
        systemPrompt: client.systemPrompt || undefined,
        aiTemperature: client.aiTemperature,
        aiModel: client.aiModel,
        maxTokens: client.maxTokens,
        fallbackMessage: client.fallbackMessage || undefined,
        language: client.language,
        timezone: client.timezone,
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
        ...(activeWorkflows.length && !workflowSession
          ? {
              workflows: activeWorkflows.map((w) => ({
                name: w.name,
                trigger: w.trigger,
              })),
            }
          : {}),
        ...(workflowSession
          ? {
              activeWorkflow: {
                name: workflowSession.workflow.name,
                instructions: workflowSession.workflow.instructions,
                collectFields: Array.isArray(
                  workflowSession.workflow.collectFields,
                )
                  ? (workflowSession.workflow.collectFields as string[])
                  : undefined,
                collectedData:
                  (workflowSession.collectedData as Record<string, unknown>) ||
                  undefined,
              },
            }
          : {}),
      },
      customer: {
        name: customer.name,
        metadata: customer.metadata as any,
      },
      message: messageBody,
      history,
      knowledgeContext,
    };
    const aiResult = await this.aiService.generateReply(aiInput);

    // 9.1 If the reply was served via provider failover, alert staff
    // (rate-limited so an outage doesn't spam one alert per message).
    await this.maybeAlertFailover(client, aiResult.metadata);

    // 9.5 Execute an action if the AI requested one, then let the AI phrase
    // its reply from the authoritative backend result. At most one action
    // per customer message; a follow-up action is never executed.
    let reply = aiResult.reply;
    let handoff = aiResult.handoff;
    let handoffReason = aiResult.handoffReason;
    let actionResult: (BookingActionResult | OrderActionResult) | null = null;
    let workflowMatch = aiResult.workflowMatch;
    let workflowStatus = aiResult.workflowStatus;
    let collectedData = aiResult.collectedData;

    if (aiResult.action) {
      if (client.bookingsEnabled && this.isBookingAction(aiResult.action)) {
        actionResult = await this.bookingActionsService.execute({
          client,
          customer: {
            id: customer.id,
            name: customer.name,
            phoneNumber: customer.phoneNumber || from,
          },
          action: aiResult.action,
        });
      } else if (client.ordersEnabled) {
        actionResult = await this.orderActionsService.execute({
          client,
          customer: {
            id: customer.id,
            name: customer.name,
            phoneNumber: customer.phoneNumber || from,
          },
          conversationId: conversation.id,
          action: aiResult.action,
        });
      }

      if (actionResult) {
        const followUp = await this.aiService.generateReply({
          ...aiInput,
          actionResult: actionResult.summary,
        });
        reply = followUp.reply;
        handoff = followUp.handoff;
        handoffReason = followUp.handoffReason;
        workflowMatch = followUp.workflowMatch;
        workflowStatus = followUp.workflowStatus;
        collectedData = followUp.collectedData;
        if (followUp.action) {
          this.logger.warn(
            `Ignoring follow-up action "${followUp.action.type}" — only one action per message is executed`,
          );
        }
      }
    }

    // 9.6 Workflow bookkeeping: open a session when the AI matched a
    // playbook, carry collected data forward, close the session when the AI
    // reports completion — handing off when the workflow's end action says so.
    if (activeWorkflows.length) {
      try {
        if (!workflowSession && workflowMatch) {
          const matched = activeWorkflows.find(
            (w) => w.name.toLowerCase() === workflowMatch.toLowerCase(),
          );
          if (matched) {
            workflowSession = await this.workflowRuntime.startSession({
              clientId: client.id,
              conversationId: conversation.id,
              workflowId: matched.id,
              customerId: customer.id,
            });
          }
        } else if (workflowSession) {
          if (collectedData) {
            await this.workflowRuntime.updateProgress(
              workflowSession.id,
              collectedData,
            );
          }
          if (
            workflowStatus === 'completed' ||
            workflowStatus === 'abandoned'
          ) {
            await this.workflowRuntime.completeSession(
              workflowSession.id,
              workflowStatus,
            );
            if (
              workflowStatus === 'completed' &&
              workflowSession.workflow.endAction === 'handoff' &&
              !handoff
            ) {
              handoff = true;
              handoffReason = `Workflow "${workflowSession.workflow.name}" completed — collected: ${JSON.stringify(
                collectedData || workflowSession.collectedData || {},
              )}`;
            }
          }
        }
      } catch (error) {
        this.logger.warn(
          `Workflow bookkeeping failed: ${(error as Error).message}`,
        );
      }
    }

    // 10. Store AI message
    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderType: 'bot',
        content: reply,
        kimiMetadata: {
          ...(aiResult.metadata || {}),
          ...(aiResult.action ? { action: aiResult.action } : {}),
          ...(actionResult ? { actionSummary: actionResult.summary } : {}),
        },
      },
    });

    // 10.5 Action side effects: notify staff in Chatwoot, and hand the
    // conversation to a human when a booking needs staff confirmation.
    // (WhatsApp only — Messenger/Instagram conversations already live in
    // Chatwoot, and contact creation there requires a phone number.)
    let handoffTicketRef: string | null = null;
    if (actionResult?.staffNotification && channel === 'whatsapp') {
      await this.forwardToChatwoot(
        client,
        customer,
        conversation,
        actionResult.staffNotification,
      );
    }
    if ((actionResult as BookingActionResult | null)?.requiresApproval) {
      const handedOff = await this.conversationsService.handoffToHuman({
        conversationId: conversation.id,
        triggeredBy: 'bot',
        reason:
          actionResult?.staffNotification ||
          'Booking pending staff confirmation',
      });
      handoffTicketRef = handedOff.ticketRef;
    }

    // 11. Handle AI-triggered handoff
    if (handoff) {
      const handedOff = await this.conversationsService.handoffToHuman({
        conversationId: conversation.id,
        triggeredBy: 'bot',
        reason: handoffReason || 'AI requested human handoff',
      });
      handoffTicketRef = handoffTicketRef ?? handedOff.ticketRef;
    }

    // 12. Send AI reply to customer (with the ticket ref when handed off)
    await this.sendToCustomer({
      client,
      channel,
      to: from,
      chatwootConversationId: conversation.chatwootConversationId,
      message: this.withTicketRef(reply, handoffTicketRef),
    });
  }

  /**
   * Entry point for Messenger/Instagram messages bridged through Chatwoot.
   * Runs the same AI pipeline as WhatsApp; outbound replies are posted back
   * into the native Chatwoot conversation (see sendToCustomer).
   */
  async handleChannelIncomingMessage(input: {
    clientId: string;
    channel: 'messenger' | 'instagram';
    channelSourceId: string;
    contactName?: string;
    messageBody: string;
    chatwootConversationId?: number;
  }): Promise<void> {
    await this.handleIncomingMessage({
      clientId: input.clientId,
      channel: input.channel,
      channelSourceId: input.channelSourceId,
      contactName: input.contactName,
      messageBody: input.messageBody,
      chatwootConversationId: input.chatwootConversationId,
    });
  }

  /**
   * Channel-aware outbound: WhatsApp sends go through the Meta sender;
   * Messenger/Instagram replies are posted into the existing Chatwoot
   * conversation, which delivers them via the Facebook page token.
   */
  private async sendToCustomer(input: {
    client: {
      metaAccessToken: string;
      whatsappPhoneNumberId: string;
      chatwootAccountId?: number | null;
    };
    channel: string;
    to?: string;
    chatwootConversationId?: number | null;
    message: string;
  }): Promise<void> {
    if (input.channel === 'whatsapp') {
      if (!input.to) {
        this.logger.warn('WhatsApp send skipped: no recipient number');
        return;
      }
      await this.senderService.sendMessage({
        client: input.client,
        to: input.to,
        message: input.message,
      });
      return;
    }

    if (!input.client.chatwootAccountId || !input.chatwootConversationId) {
      this.logger.warn(
        `${input.channel} send skipped: missing Chatwoot account/conversation`,
      );
      return;
    }
    await this.chatwootService.sendMessage(
      input.client.chatwootAccountId,
      input.chatwootConversationId,
      input.message,
      'outgoing',
    );
  }

  /** Appends the ticket reference to a customer-facing handoff message. */
  private withTicketRef(message: string, ref?: string | null): string {
    return ref ? `${message}\n\nYour ticket reference is ${ref}.` : message;
  }

  /** Last failover staff-alert time (rate limit: one alert per 30 min). */
  private lastFailoverAlertAt = 0;

  /**
   * Alerts staff on WhatsApp when an AI reply was served via provider
   * failover. Rate-limited so a provider outage triggers one alert per
   * 30 minutes, not one per customer message.
   */
  private async maybeAlertFailover(
    client: { metaAccessToken: string; whatsappPhoneNumberId: string },
    metadata: any,
  ): Promise<void> {
    const failover = metadata?.failover;
    if (!failover) return;
    const now = Date.now();
    if (now - this.lastFailoverAlertAt < 30 * 60 * 1000) return;
    this.lastFailoverAlertAt = now;

    try {
      await this.staffAlertsService.sendAlert(
        client,
        `AI provider failover: ${failover.fromModel} failed — replies are being served by the fallback model (${failover.toModel}). Error: ${String(failover.reason).slice(0, 150)}`,
      );
    } catch (error) {
      this.logger.warn(
        `Failover staff alert failed: ${(error as Error).message}`,
      );
    }
  }

  private isBookingAction(action: { type: string }): boolean {
    return [
      'check_availability',
      'create_booking',
      'cancel_booking',
      'reschedule_booking',
    ].includes(action.type);
  }

  private async forwardToChatwoot(
    client: { chatwootAccountId?: number | null; chatwootInboxId?: number | null },
    customer: { id: string; phoneNumber: string | null; name?: string | null; chatwootContactId?: number | null },
    conversation: { id: string; chatwootConversationId?: number | null },
    content: string,
  ) {
    if (!client.chatwootAccountId || !client.chatwootInboxId) {
      this.logger.log(
        `Client ${client.chatwootAccountId ? '' : 'missing account'} ${client.chatwootInboxId ? '' : 'missing inbox'}; cannot forward to Chatwoot`,
      );
      return;
    }

    if (!customer.phoneNumber) {
      this.logger.log(`Customer ${customer.id} has no WhatsApp number; cannot forward to Chatwoot`);
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
