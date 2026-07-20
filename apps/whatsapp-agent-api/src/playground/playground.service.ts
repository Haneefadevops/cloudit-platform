import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { PlaygroundMessageDto } from './dto/playground-message.dto';

@Injectable()
export class PlaygroundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly knowledgeBaseService: KnowledgeBaseService,
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

    const aiResult = await this.aiService.generateReply({
      client: {
        name: client.name,
        businessProfile: client.businessProfile as any,
        products: Array.isArray(client.products) ? client.products : undefined,
        systemPrompt: client.systemPrompt || undefined,
        aiTemperature: client.aiTemperature,
        maxTokens: client.maxTokens,
        fallbackMessage: client.fallbackMessage || undefined,
        language: client.language || undefined,
      },
      customer: {},
      message: dto.message,
      history,
      knowledgeContext: knowledgeContext || undefined,
    });

    return {
      reply: aiResult.reply,
      handoffRecommended: aiResult.handoff,
      handoffReason: aiResult.handoffReason,
      sources: searchResults.map((r) => ({
        documentId: r.id,
        preview: r.content.slice(0, 200),
        score: r.similarity,
      })),
      usage: aiResult.metadata?.usage ?? null,
    };
  }
}
