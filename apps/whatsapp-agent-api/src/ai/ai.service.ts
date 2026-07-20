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
  };
  customer: {
    name?: string | null;
    metadata?: any;
  };
  message: string;
  history?: string;
  knowledgeContext?: string;
}

interface GenerateReplyOutput {
  reply: string;
  handoff: boolean;
  handoffReason?: string;
  metadata?: any;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly configService: ConfigService) {}

  async generateReply(input: GenerateReplyInput): Promise<GenerateReplyOutput> {
    const { client, customer, message, history, knowledgeContext } = input;

    const systemPrompt = this.buildSystemPrompt(client, customer, knowledgeContext);

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

      return {
        reply: parsed.reply || 'Sorry, I could not understand that.',
        handoff: parsed.handoff === true,
        handoffReason: parsed.handoffReason,
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
  ): string {
    const profile = client.businessProfile || {};
    const products = Array.isArray(client.products) ? client.products : [];

    const productList = products
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

    return `${client.systemPrompt || 'You are a helpful AI assistant.'}

BUSINESS INFO:
- Name: ${client.name}
- Address: ${profile.address || 'Not provided'}
- Hours: ${profile.hours || 'Not provided'}
- Contact: ${profile.phone || 'Not provided'}

PRODUCTS:
${productList || 'No products listed'}

${knowledgeSection}

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
  "handoffReason": "reason if handing off"
}
`;
  }
}
