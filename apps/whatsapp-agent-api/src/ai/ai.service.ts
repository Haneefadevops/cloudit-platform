import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface GenerateReplyInput {
  client: {
    name: string;
    businessProfile?: any;
    products?: any[];
    systemPrompt?: string;
    aiTemperature?: number | null;
    maxTokens?: number | null;
    fallbackMessage?: string;
    language?: string | null;
    // Bookings module (only present when the client has bookings enabled)
    bookingsEnabled?: boolean;
    bookingApprovalMode?: string;
    services?: Array<{
      name: string;
      description?: string | null;
      durationMinutes: number;
      price?: number | null;
      requiresConfirmation: boolean;
      intakeQuestions?: unknown;
    }>;
    staff?: string[];
    upcomingBookings?: string;
    // Orders module (only present when the client has orders enabled)
    ordersEnabled?: boolean;
    paymentInstructions?: string | null;
    catalog?: Array<{
      name: string;
      description?: string | null;
      price: number;
      category?: string | null;
      available: boolean;
      options?: Array<{ name: string; priceDelta?: number }>;
    }>;
    fulfilment?: string;
    currentDraft?: string;
  };
  customer: {
    name?: string | null;
    metadata?: any;
  };
  message: string;
  history?: string;
  knowledgeContext?: string;
  /** Authoritative result of an action executed by the backend. */
  actionResult?: string;
}

export interface AiAction {
  type: string;
  [key: string]: any;
}

interface GenerateReplyOutput {
  reply: string;
  handoff: boolean;
  handoffReason?: string;
  action?: AiAction;
  metadata?: any;
}

const BOOKING_ACTION_TYPES = [
  'check_availability',
  'create_booking',
  'cancel_booking',
  'reschedule_booking',
];

const ORDER_ACTION_TYPES = [
  'add_items',
  'remove_items',
  'set_order_details',
  'confirm_order',
  'check_order_status',
  'cancel_order',
];

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly configService: ConfigService) {}

  async generateReply(input: GenerateReplyInput): Promise<GenerateReplyOutput> {
    const { client, customer, message, history, knowledgeContext } = input;

    const systemPrompt = this.buildSystemPrompt(
      client,
      customer,
      knowledgeContext,
      input.actionResult,
    );

    const userContent = knowledgeContext
      ? `Use the KNOWLEDGE BASE below to answer. If the answer is not in the knowledge base, reply with the fallback message and set handoff to true.\n\nCustomer message: ${message}`
      : message;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...(history ? [{ role: 'user' as const, content: `Recent conversation:\n${history}` }] : []),
      { role: 'user' as const, content: userContent },
    ];

    try {
      const apiKey = this.configService.get<string>('KIMI_API_KEY');
      const apiUrl = this.configService.get<string>(
        'KIMI_API_URL',
        'https://api.moonshot.cn/v1/chat/completions',
      );
      const model = this.configService.get<string>('KIMI_MODEL', 'kimi-latest');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: client.aiTemperature ?? 0.7,
          max_tokens: client.maxTokens ?? 1024,
          response_format: { type: 'json_object' },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Kimi API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const rawContent = data.choices?.[0]?.message?.content || '{}';

      let parsed: any;
      try {
        parsed = JSON.parse(rawContent);
      } catch {
        // Fallback if model doesn't return valid JSON
        parsed = { reply: rawContent, handoff: false };
      }

      const actionType =
        parsed.action &&
        typeof parsed.action === 'object' &&
        typeof parsed.action.type === 'string'
          ? parsed.action.type
          : null;
      const actionAllowed =
        actionType &&
        ((client.bookingsEnabled &&
          BOOKING_ACTION_TYPES.includes(actionType)) ||
          (client.ordersEnabled && ORDER_ACTION_TYPES.includes(actionType)));
      const action = actionAllowed ? (parsed.action as AiAction) : undefined;

      return {
        reply: parsed.reply || 'Sorry, I could not understand that.',
        handoff: parsed.handoff === true,
        handoffReason: parsed.handoffReason,
        action,
        metadata: {
          model: data.model,
          usage: data.usage,
          finishReason: data.choices?.[0]?.finish_reason,
        },
      };
    } catch (error) {
      this.logger.error('AI generation failed', error);
      return {
        reply:
          "I'm sorry, I'm having trouble understanding right now. Let me connect you with our team.",
        handoff: true,
        handoffReason: 'AI service error',
      };
    }
  }

  async summarizeConversation(
    messages: { role: string; content: string }[],
  ): Promise<string> {
    const conversationText = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n\n');

    const systemPrompt = `Summarize the following customer-support conversation in at most 5 concise bullet points. Use the same language as the conversation.

${conversationText}`;

    try {
      const result = await this.callKimiChat(
        [{ role: 'system', content: systemPrompt }],
        { maxTokens: 512, responseFormat: 'text' },
      );
      return result.content.trim() || 'No summary available.';
    } catch (error) {
      this.logger.error('Conversation summarization failed', error);
      return 'Summary could not be generated.';
    }
  }

  async suggestLabels(conversationText: string): Promise<string[]> {
    const systemPrompt = `Given the following customer support conversation, suggest 1-3 short lowercase topic/intent labels (for example: billing, complaint, pricing, technical, delivery). Return ONLY a JSON object in this exact format:

{"labels": ["label1", "label2"]}

Conversation:
${conversationText}`;

    try {
      const result = await this.callKimiChat(
        [{ role: 'system', content: systemPrompt }],
        { maxTokens: 256, responseFormat: 'json_object' },
      );
      const parsed = JSON.parse(result.content || '{}');
      const rawLabels = Array.isArray(parsed.labels) ? parsed.labels : [];
      const labels = rawLabels
        .slice(0, 3)
        .map((label: unknown) =>
          String(label)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, ''),
        )
        .filter((label: string) => label.length > 0 && label.length <= 32);
      return labels;
    } catch (error) {
      this.logger.error('Label suggestion failed', error);
      return [];
    }
  }

  private async callKimiChat(
    messages: { role: 'system' | 'user'; content: string }[],
    options: {
      temperature?: number;
      maxTokens?: number;
      responseFormat?: 'json_object' | 'text';
    } = {},
  ): Promise<{ content: string; metadata: any }> {
    const apiKey = this.configService.get<string>('KIMI_API_KEY');
    const apiUrl = this.configService.get<string>(
      'KIMI_API_URL',
      'https://api.moonshot.cn/v1/chat/completions',
    );
    const model = this.configService.get<string>('KIMI_MODEL', 'kimi-latest');

    const body: any = {
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1024,
    };
    if (options.responseFormat === 'json_object') {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kimi API error: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    return {
      content,
      metadata: {
        model: data.model,
        usage: data.usage,
        finishReason: data.choices?.[0]?.finish_reason,
      },
    };
  }

  private buildSystemPrompt(
    client: GenerateReplyInput['client'],
    customer: GenerateReplyInput['customer'],
    knowledgeContext?: string,
    actionResult?: string,
  ): string {
    const profile = client.businessProfile || {};
    const products = Array.isArray(client.products) ? client.products : [];

    // The legacy `products` Json is ignored once the client has the orders
    // module — the real catalog (with availability flags) takes over.
    const productList = client.ordersEnabled
      ? ''
      : products
          .map(
            (p: any) =>
              `- ${p.name || 'Product'}: ${p.price ? `LKR ${p.price}` : 'Price not available'} (${p.stock > 0 ? 'In stock' : 'Out of stock'})`,
          )
          .join('\n');

    const fallback =
      client.fallbackMessage ||
      "I'm sorry, I didn't understand that. Let me connect you with our team.";

    const businessLanguage = client.language || 'en';
    const languageDisplay = businessLanguage === 'en' ? 'English' : businessLanguage;

    const knowledgeSection = knowledgeContext
      ? `KNOWLEDGE BASE:\n${knowledgeContext}\n\nFALLBACK MESSAGE (use exactly when the answer is not in the knowledge base):\n${fallback}`
      : `FALLBACK MESSAGE (use exactly when you cannot answer):\n${fallback}`;

    const actionResultBlock = actionResult
      ? `ACTION RESULT (authoritative — executed by the backend, not by you):\n${actionResult}\n\nPhrase your reply to the customer based ONLY on this result. Do NOT include an "action" field in this reply.\n\n`
      : '';

    const bookingSection =
      client.bookingsEnabled && !actionResult
        ? this.buildBookingSection(client)
        : '';
    const orderSection =
      client.ordersEnabled && !actionResult
        ? this.buildOrderSection(client)
        : '';

    const productsSection = client.ordersEnabled
      ? ''
      : `PRODUCTS:\n${productList || 'No products listed'}\n\n`;

    return `${client.systemPrompt || 'You are a helpful AI assistant.'}

BUSINESS INFO:
- Name: ${client.name}
- Address: ${profile.address || 'Not provided'}
- Hours: ${profile.hours || 'Not provided'}
- Contact: ${profile.phone || 'Not provided'}

${productsSection}${actionResultBlock}${bookingSection}${orderSection}${knowledgeSection}

BUSINESS LANGUAGE: ${languageDisplay}

RULES:
1. Be friendly and professional
2. Detect the language of the customer's message and reply in that language. If the language is ambiguous, fall back to the business language above (${languageDisplay})
3. Answer ONLY from the KNOWLEDGE BASE and BUSINESS INFO above
4. If the answer is not in the knowledge base, reply with the FALLBACK MESSAGE exactly and set handoff to true
5. Never make up prices, stock levels, or policies
6. For orders, ask: product, quantity, address, phone
7. For complaints or refund requests, immediately set handoff to true

CUSTOMER CONTEXT:
- Name: ${customer.name || 'New customer'}

IMPORTANT: Reply ONLY with a JSON object in this exact format:
{
  "reply": "your friendly response here",
  "handoff": false,
  "handoffReason": "reason if handing off"${client.bookingsEnabled || client.ordersEnabled ? ',\n  "action": { "type": "...", "...": "optional — see ACTIONS above" }' : ''}
}
`;
  }

  /**
   * Booking instructions for the AI, injected only when the client has the
   * bookings module enabled. The backend owns the truth: the AI may request
   * actions, but slots, prices, and statuses come only from the database.
   */
  private buildBookingSection(
    client: GenerateReplyInput['client'],
  ): string {
    const services = Array.isArray(client.services) ? client.services : [];
    const serviceList = services
      .map((s) => {
        const intake = Array.isArray(s.intakeQuestions)
          ? (s.intakeQuestions as unknown[]).filter((q) => typeof q === 'string')
          : [];
        return `- ${s.name}: ${s.durationMinutes} min${s.price != null ? `, LKR ${s.price}` : ''}${s.requiresConfirmation ? ', always requires staff confirmation' : ''}${s.description ? ` — ${s.description}` : ''}${intake.length ? `\n  Intake questions to ask before booking: ${intake.join('; ')}` : ''}`;
      })
      .join('\n');

    const staffLine =
      client.staff && client.staff.length
        ? `\nSTAFF: ${client.staff.join(', ')}\n`
        : '';

    const upcoming = client.upcomingBookings
      ? `\nCUSTOMER'S UPCOMING BOOKINGS:\n${client.upcomingBookings}\n`
      : '';

    const approvalMode =
      (client.bookingApprovalMode || 'approval') === 'auto'
        ? 'AUTO: new bookings are confirmed immediately, except services marked "always requires staff confirmation".'
        : 'APPROVAL: every new booking is created as pending and a team member confirms it shortly. After creating a booking, tell the customer a team member will confirm shortly — never say it is confirmed.';

    return `SERVICES (bookable):
${serviceList || 'No services configured'}
${staffLine}${upcoming}
BOOKING ACTIONS:
You may include ONE optional "action" field in your JSON reply to make the backend perform a booking operation. The backend is the source of truth — NEVER invent availability, time slots, prices, or booking confirmations yourself.
- Check times BEFORE offering them: {"type":"check_availability","service":"<service name>","date":"YYYY-MM-DD","staff":"<optional staff name>"}
- Create ONLY after the customer explicitly confirms a specific time you offered, and include answers to the service's intake questions if any: {"type":"create_booking","service":"<service name>","date":"YYYY-MM-DD","time":"HH:mm (24h)","staff":"<optional>","intakeAnswers":{"<question>":"<answer>"},"notes":"<optional>"}
- Cancel ONLY after the customer confirms the cancellation: {"type":"cancel_booking","service":"<optional service name>"}
- Reschedule ONLY after the customer confirms a new available time: {"type":"reschedule_booking","service":"<optional>","date":"YYYY-MM-DD","time":"HH:mm"}
Booking approval mode: ${approvalMode}
When you include an action, still write "reply" as a short interim message (e.g. "Let me check that for you..."); the backend executes the action and you will phrase the real answer next turn.

`;
  }

  /**
   * Order instructions for the AI, injected only when the client has the
   * orders module enabled. The backend owns the truth: items, prices, option
   * deltas, availability, and totals come only from the database.
   */
  private buildOrderSection(client: GenerateReplyInput['client']): string {
    const catalog = Array.isArray(client.catalog) ? client.catalog : [];
    const catalogList = catalog
      .map((p) => {
        const options = Array.isArray(p.options) ? p.options : [];
        const optionText = options.length
          ? ` — options: ${options.map((o) => `${o.name}${o.priceDelta ? ` (+LKR ${o.priceDelta})` : ''}`).join(', ')}`
          : '';
        return `- ${p.name}: LKR ${p.price}${p.available ? '' : ' (currently UNAVAILABLE — never promise it; suggest an available alternative)'}${p.category ? ` [${p.category}]` : ''}${p.description ? ` — ${p.description}` : ''}${optionText}`;
      })
      .join('\n');

    const fulfilmentLine = client.fulfilment
      ? `\nFulfilment options: ${client.fulfilment}. Ask "delivery or pickup?" once the customer has items.\n`
      : '';

    const draftLine = client.currentDraft
      ? `\nCURRENT ORDER DRAFT (real, from the database):\n${client.currentDraft}\n`
      : '';

    const paymentLine = client.paymentInstructions
      ? `\nPayment: ${client.paymentInstructions} (mention where relevant, e.g. when confirming the order).\n`
      : '';

    return `CATALOG (orderable):
${catalogList || 'No products configured'}
${fulfilmentLine}${draftLine}${paymentLine}
ORDER ACTIONS:
You may include ONE optional "action" field in your JSON reply to make the backend perform an order operation. The backend is the source of truth — NEVER invent prices, availability, or totals yourself.
- Add items as the customer names them: {"type":"add_items","items":[{"product":"<product name>","quantity":2,"options":["<optional option name>"]}]}
- Remove or reduce items when the customer changes their mind: {"type":"remove_items","items":[{"product":"<product name>","quantity":1}]}
- Save fulfilment details once known: {"type":"set_order_details","orderType":"delivery|pickup","address":"<required for delivery>","customerName":"<optional>","phone":"<optional>","notes":"<optional>"}
- Confirm ONLY after the customer explicitly confirms the full order and total: {"type":"confirm_order"}
- Answer "where's my order?": {"type":"check_order_status"}
- Cancel ONLY after the customer confirms the cancellation: {"type":"cancel_order"}
The draft order persists across messages — add/remove items as the customer changes their mind. Always state the real total from the action result; never compute it yourself.
When you include an action, still write "reply" as a short interim message (e.g. "One moment..."); the backend executes the action and you will phrase the real answer next turn.

`;
  }
}
