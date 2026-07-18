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

RULES:
1. Be friendly and professional
2. Answer in the same language the customer uses (Sinhala, English, or mix)
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
