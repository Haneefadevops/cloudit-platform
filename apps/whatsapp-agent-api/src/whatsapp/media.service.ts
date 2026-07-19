import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

export type IncomingMediaType = 'image' | 'audio' | 'document';

interface DownloadedMedia {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Handles incoming WhatsApp media: downloads files from the Meta Graph API
 * and converts them to text the normal AI pipeline can work with:
 * - audio/voice notes -> Whisper transcription
 * - images -> Kimi vision description
 * - documents (pdf/docx/txt) -> extracted text
 */
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(private readonly configService: ConfigService) {}

  private get metaBaseUrl(): string {
    return this.configService.get<string>(
      'META_API_BASE_URL',
      'https://graph.facebook.com/v18.0',
    );
  }

  /**
   * Downloads a media file. Meta requires a two-step flow:
   * 1) GET /{media-id} to resolve a temporary download URL
   * 2) GET that URL with the access token
   */
  private async downloadMedia(
    mediaId: string,
    accessToken: string,
  ): Promise<DownloadedMedia> {
    const metaResponse = await fetch(`${this.metaBaseUrl}/${mediaId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaResponse.ok) {
      throw new Error(
        `Failed to resolve media ${mediaId}: ${metaResponse.status} ${await metaResponse.text()}`,
      );
    }
    const meta = (await metaResponse.json()) as {
      url?: string;
      mime_type?: string;
    };
    if (!meta.url) throw new Error(`No download URL for media ${mediaId}`);

    const fileResponse = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!fileResponse.ok) {
      throw new Error(
        `Failed to download media ${mediaId}: ${fileResponse.status}`,
      );
    }

    return {
      buffer: Buffer.from(await fileResponse.arrayBuffer()),
      mimeType: meta.mime_type || 'application/octet-stream',
    };
  }

  /** Transcribes an audio/voice note via an OpenAI-compatible Whisper API. */
  private async transcribeAudio(
    media: DownloadedMedia,
  ): Promise<string | null> {
    const apiKey =
      this.configService.get<string>('WHISPER_API_KEY') ||
      this.configService.get<string>('EMBEDDING_API_KEY');
    if (!apiKey) {
      this.logger.warn('No WHISPER_API_KEY/EMBEDDING_API_KEY configured');
      return null;
    }
    const apiUrl = this.configService.get<string>(
      'WHISPER_API_URL',
      'https://api.openai.com/v1/audio/transcriptions',
    );
    const model = this.configService.get<string>('WHISPER_MODEL', 'whisper-1');

    const extension = media.mimeType.split('/')[1]?.split(';')[0] || 'ogg';
    const form = new FormData();
    form.append('model', model);
    form.append(
      'file',
      new Blob([new Uint8Array(media.buffer)], { type: media.mimeType }),
      `voice.${extension}`,
    );

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!response.ok) {
      throw new Error(
        `Whisper API error: ${response.status} ${await response.text()}`,
      );
    }
    const data = (await response.json()) as { text?: string };
    return data.text?.trim() || null;
  }

  /** Describes an image (and extracts visible text) via Kimi vision. */
  private async describeImage(
    media: DownloadedMedia,
    caption?: string,
  ): Promise<string | null> {
    const apiKey = this.configService.get<string>('KIMI_API_KEY');
    if (!apiKey) return null;
    const apiUrl = this.configService.get<string>(
      'KIMI_API_URL',
      'https://api.moonshot.ai/v1/chat/completions',
    );
    const model = this.configService.get<string>(
      'KIMI_VISION_MODEL',
      'kimi-latest',
    );

    const base64 = media.buffer.toString('base64');
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  'Describe this image briefly for a customer-service chat. ' +
                  'If it contains readable text (documents, receipts, products), transcribe the important parts. ' +
                  (caption ? `The customer added this caption: "${caption}".` : ''),
              },
              {
                type: 'image_url',
                image_url: { url: `data:${media.mimeType};base64,${base64}` },
              },
            ],
          },
        ],
        max_tokens: 512,
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Kimi vision API error: ${response.status} ${await response.text()}`,
      );
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  }

  /** Extracts text from pdf/docx/txt documents. */
  private async extractDocumentText(
    media: DownloadedMedia,
    filename?: string,
  ): Promise<string | null> {
    const name = (filename || '').toLowerCase();
    const mime = media.mimeType.toLowerCase();

    if (mime === 'application/pdf' || name.endsWith('.pdf')) {
      const parsed = await pdfParse(media.buffer);
      return parsed.text?.trim() || null;
    }
    if (
      mime ===
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      name.endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ buffer: media.buffer });
      return result.value?.trim() || null;
    }
    if (mime.startsWith('text/') || name.endsWith('.txt')) {
      return media.buffer.toString('utf-8').trim() || null;
    }
    return null;
  }

  /**
   * Converts an incoming media message into text for the AI pipeline.
   * Always returns a string; falls back to a placeholder when processing fails.
   */
  async mediaToText(input: {
    type: IncomingMediaType;
    mediaId: string;
    accessToken: string;
    caption?: string;
    filename?: string;
  }): Promise<string> {
    const { type, mediaId, accessToken, caption, filename } = input;
    const label =
      type === 'audio' ? 'voice note' : type === 'image' ? 'image' : 'document';

    try {
      const media = await this.downloadMedia(mediaId, accessToken);

      if (type === 'audio') {
        const transcript = await this.transcribeAudio(media);
        if (transcript) return `[Voice note transcription]: ${transcript}`;
      } else if (type === 'image') {
        const description = await this.describeImage(media, caption);
        if (description) {
          return `[Image${caption ? ` (caption: ${caption})` : ''}]: ${description}`;
        }
      } else {
        const text = await this.extractDocumentText(media, filename);
        if (text) {
          const truncated =
            text.length > 2000 ? `${text.slice(0, 2000)}...` : text;
          return `[Document${filename ? ` "${filename}"` : ''} content]: ${truncated}`;
        }
      }

      this.logger.warn(`Could not extract content from ${label} ${mediaId}`);
      return `[Customer sent a ${label}${filename ? ` "${filename}"` : ''} that could not be processed]`;
    } catch (error) {
      this.logger.error(
        `Failed to process ${label} ${mediaId}: ${(error as Error).message}`,
      );
      return `[Customer sent a ${label}${filename ? ` "${filename}"` : ''} that could not be processed]`;
    }
  }
}
