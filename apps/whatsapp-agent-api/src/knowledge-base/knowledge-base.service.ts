import {
  BadRequestException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
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

  private extractKeywords(query: string): string[] {
    const stopWords = new Set([
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
      'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
      'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
      'below', 'between', 'under', 'again', 'further', 'then', 'once', 'here',
      'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
      'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
      'same', 'so', 'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or',
      'because', 'until', 'while', 'what', 'which', 'who', 'whom', 'this',
      'that', 'these', 'those', 'am', 'i', 'me', 'my', 'myself', 'we', 'our',
      'you', 'your', 'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they',
      'them', 'their', 's', 't', 'don', 'doesn', 'didn', 'wasn', 'weren',
      'won', 'wouldn', 'couldn', 'shouldn', 'isn', 'aren', 'hasn', 'haven',
      'hadn', 'ma', 'mightn', 'mustn', 'needn', 'shan', 'shouldn', 'wasn',
      'weren', 'won', 'wouldn', 'yours', 'yourself', 'yourselves', 'himself',
      'herself', 'itself', 'themselves', 'ourselves', 'us',
    ]);

    return query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 3 && !stopWords.has(w));
  }

  async search(
    clientId: string,
    query: string,
    limit = 5,
  ): Promise<SearchResult[]> {
    const embedding = await this.generateEmbedding(query);

    if (!embedding) {
      // Fallback to multi-keyword search if embeddings are unavailable
      const keywords = this.extractKeywords(query);
      this.logger.debug(`Keyword fallback keywords: ${keywords.join(', ')}`);

      if (keywords.length === 0) {
        return [];
      }

      const conditions = keywords.map(
        (keyword) =>
          Prisma.sql`LOWER("content") LIKE ${`%${keyword}%`}`,
      );
      const whereClause = Prisma.join(conditions, ' OR ');

      const docs = await this.prisma.$queryRaw<
        Array<{ id: string; title: string; content: string; matches: number }>
      >`
        SELECT "id", "title", "content",
          ${Prisma.join(
            keywords.map(
              (keyword) =>
                Prisma.sql`CASE WHEN LOWER("content") LIKE ${`%${keyword}%`} THEN 1 ELSE 0 END`,
            ),
            ' + ',
          )} AS "matches"
        FROM "documents"
        WHERE "clientId" = ${clientId}
          AND (${whereClause})
        ORDER BY "matches" DESC, "createdAt" DESC
        LIMIT ${limit}
      `;

      this.logger.debug(`Keyword fallback found ${docs.length} documents`);
      return docs.map((d) => ({ ...d, similarity: 0.5 + Math.min(d.matches * 0.1, 0.4) }));
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

  private htmlToText(html: string): string {
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#0?39;|&apos;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  async crawlUrl(clientId: string, url: string) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new BadRequestException('Invalid URL');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('Only HTTP and HTTPS URLs are supported');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const MAX_BYTES = 2 * 1024 * 1024;

    try {
      const response = await fetch(parsed.toString(), {
        signal: controller.signal,
        redirect: 'follow',
      });
      if (!response.ok) {
        throw new BadRequestException(
          `Failed to fetch URL: HTTP ${response.status}`,
        );
      }

      const contentLength = Number(response.headers.get('content-length') || 0);
      if (contentLength > MAX_BYTES) {
        throw new BadRequestException('Page too large (max 2MB)');
      }

      let html = '';
      if (response.body) {
        const body = response.body as any;
        const chunks: Buffer[] = [];
        let received = 0;
        for await (const chunk of body) {
          const len = chunk.byteLength ?? chunk.length ?? 0;
          received += len;
          if (received > MAX_BYTES) {
            throw new BadRequestException('Page too large (max 2MB)');
          }
          chunks.push(Buffer.from(chunk));
        }
        html = Buffer.concat(chunks).toString('utf-8');
      } else {
        html = await response.text();
      }

      const text = this.htmlToText(html);
      if (!text) {
        throw new UnprocessableEntityException(
          'Could not extract readable text from the URL',
        );
      }

      const created = (await this.createDocument(clientId, url, text, 'url')) as any[];
      return {
        documentId: created[0]?.[0]?.id,
        characters: text.length,
        chunks: created.length,
      };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof UnprocessableEntityException
      ) {
        throw error;
      }
      if ((error as Error).name === 'AbortError') {
        throw new BadRequestException('URL fetch timed out after 10 seconds');
      }
      throw new BadRequestException(
        `Failed to fetch URL: ${(error as Error).message}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
