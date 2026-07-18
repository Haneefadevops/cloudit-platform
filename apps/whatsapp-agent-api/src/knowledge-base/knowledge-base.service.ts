import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

export interface SearchResult {
  id: string;
  title: string;
  content: string;
  similarity: number;
}

export interface ParsedFile {
  originalName: string;
  content: string;
  contentType: string;
}

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private get embeddingApiUrl(): string {
    return (
      this.configService.get<string>('EMBEDDING_API_URL') ||
      'https://api.moonshot.ai/v1/embeddings'
    );
  }

  private get embeddingApiKey(): string {
    return (
      this.configService.get<string>('EMBEDDING_API_KEY') ||
      this.configService.get<string>('KIMI_API_KEY', '')
    );
  }

  private get embeddingModel(): string {
    return (
      this.configService.get<string>('EMBEDDING_MODEL') ||
      'moonshot-v3-embedding'
    );
  }

  private chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end).trim());
      if (end === text.length) break;
      start += chunkSize - overlap;
    }
    return chunks.filter((c) => c.length > 0);
  }

  private async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.embeddingApiKey) {
      this.logger.warn('No embedding API key configured; skipping embeddings');
      return null;
    }

    try {
      const response = await fetch(this.embeddingApiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.embeddingApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.embeddingModel,
          input: [text],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.warn(
          `Embedding API error: ${response.status} ${errorText}`,
        );
        return null;
      }

      const data = await response.json();
      const vector = data.data?.[0]?.embedding;
      if (!Array.isArray(vector)) {
        this.logger.warn('Embedding API returned unexpected shape');
        return null;
      }
      return vector;
    } catch (error) {
      this.logger.warn(
        `Failed to generate embedding: ${(error as Error).message}`,
      );
      return null;
    }
  }

  async createDocument(
    clientId: string,
    title: string,
    content: string,
    contentType = 'text',
  ) {
    const chunks = this.chunkText(content);
    const created = [];

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await this.generateEmbedding(chunks[i]);
      const vectorLiteral = embedding ? `[${embedding.join(',')}]` : null;
      const doc = await this.prisma.$queryRaw`
        INSERT INTO "documents" ("id", "title", "content", "contentType", "embedding", "chunkIndex", "metadata", "clientId", "createdAt", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          ${title},
          ${chunks[i]},
          ${contentType},
          ${vectorLiteral}::vector,
          ${i},
          '{}'::jsonb,
          ${clientId},
          NOW(),
          NOW()
        )
        RETURNING "id", "title", "contentType", "chunkIndex", "createdAt"
      `;
      created.push(doc);
    }

    return created;
  }

  async parseFile(
    buffer: Buffer,
    originalName: string,
  ): Promise<ParsedFile> {
    const lowerName = originalName.toLowerCase();

    if (lowerName.endsWith('.pdf')) {
      const parsed = await pdfParse(buffer);
      return {
        originalName,
        content: parsed.text,
        contentType: 'pdf',
      };
    }

    if (lowerName.endsWith('.docx')) {
      const parsed = await mammoth.extractRawText({ buffer });
      return {
        originalName,
        content: parsed.value,
        contentType: 'docx',
      };
    }

    if (lowerName.endsWith('.txt')) {
      return {
        originalName,
        content: buffer.toString('utf-8'),
        contentType: 'txt',
      };
    }

    throw new Error(`Unsupported file type: ${originalName}`);
  }

  async createDocumentsFromFiles(
    clientId: string,
    files: Array<{ buffer: Buffer; originalname: string }>,
  ) {
    const results = [];
    for (const file of files) {
      const parsed = await this.parseFile(file.buffer, file.originalname);
      const docs = await this.createDocument(
        clientId,
        parsed.originalName,
        parsed.content,
        parsed.contentType,
      );
      results.push({ file: parsed.originalName, chunks: docs.length });
    }
    return results;
  }

  async search(
    clientId: string,
    query: string,
    limit = 5,
  ): Promise<SearchResult[]> {
    const embedding = await this.generateEmbedding(query);

    if (!embedding) {
      // Fallback to simple keyword search if embeddings are unavailable
      const keyword = query.toLowerCase();
      const docs = await this.prisma.$queryRaw<Array<{ id: string; title: string; content: string }>>`
        SELECT "id", "title", "content"
        FROM "documents"
        WHERE "clientId" = ${clientId}
          AND LOWER("content") LIKE ${`%${keyword}%`}
        ORDER BY "createdAt" DESC
        LIMIT ${limit}
      `;
      return docs.map((d) => ({ ...d, similarity: 0.5 }));
    }

    const vectorLiteral = `[${embedding.join(',')}]`;
    const results = await this.prisma.$queryRaw<Array<{ id: string; title: string; content: string; similarity: number }>>`
      SELECT "id", "title", "content", 1 - ("embedding" <=> ${vectorLiteral}::vector) AS "similarity"
      FROM "documents"
      WHERE "clientId" = ${clientId}
        AND "embedding" IS NOT NULL
      ORDER BY "embedding" <=> ${vectorLiteral}::vector
      LIMIT ${limit}
    `;

    return results;
  }

  async findAll(clientId: string) {
    return this.prisma.$queryRaw`
      SELECT "id", "title", "contentType", "chunkIndex", "metadata", "createdAt", "updatedAt"
      FROM "documents"
      WHERE "clientId" = ${clientId}
      ORDER BY "createdAt" DESC
    `;
  }

  async remove(clientId: string, documentId: string) {
    await this.prisma.$queryRaw`
      DELETE FROM "documents"
      WHERE "id" = ${documentId} AND "clientId" = ${clientId}
    `;
  }
}
