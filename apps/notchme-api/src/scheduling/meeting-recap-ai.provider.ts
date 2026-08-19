import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type AiRecapSuggestion = {
  summary: string;
  keyPoints: string[];
  commitments: string[];
  proposedFollowUpTitle: string | null;
  proposedFollowUpDueAt: string | null;
};

export type AiUsageTokens = {
  inputTokens: number | null;
  outputTokens: number | null;
};

export type AiRecapProviderResult = {
  suggestion: AiRecapSuggestion;
  transcriptionUsage: AiUsageTokens;
  extractionUsage: AiUsageTokens;
};

type ProviderResponse = {
  text?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  output?: Array<{
    content?: Array<{ type?: string; text?: string }>;
  }>;
};

@Injectable()
export class MeetingRecapAiProvider {
  constructor(private readonly config: ConfigService) {}

  enabled(): boolean {
    return Boolean(this.config.get<string>("OPENAI_API_KEY")?.trim());
  }

  transcriptionModel(): string {
    return (
      this.config.get<string>("NOTCHME_AI_TRANSCRIPTION_MODEL")?.trim() ||
      "gpt-4o-mini-transcribe"
    );
  }

  extractionModel(): string {
    return (
      this.config.get<string>("NOTCHME_AI_EXTRACTION_MODEL")?.trim() ||
      "gpt-4o-mini"
    );
  }

  async suggest(input: {
    buffer: Buffer;
    mimeType: string;
    filename: string;
  }): Promise<AiRecapProviderResult> {
    const apiKey = this.config.get<string>("OPENAI_API_KEY")?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        "AI recap assistance is not configured.",
      );
    }

    const form = new FormData();
    form.append("model", this.transcriptionModel());
    form.append(
      "file",
      new Blob([Uint8Array.from(input.buffer)], { type: input.mimeType }),
      input.filename,
    );
    const transcription = await this.request<ProviderResponse>(
      "https://api.openai.com/v1/audio/transcriptions",
      apiKey,
      { method: "POST", body: form },
    );
    if (!transcription.text?.trim()) {
      throw new ServiceUnavailableException(
        "The voice note was not clear enough.",
      );
    }

    const extraction = await this.request<ProviderResponse>(
      "https://api.openai.com/v1/responses",
      apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.extractionModel(),
          store: false,
          max_output_tokens: 900,
          instructions:
            "Turn a private post-meeting voice note into a concise factual draft. Do not invent facts. Use null when no follow-up is stated. Never compose an outbound message.",
          input: transcription.text,
          text: {
            format: {
              type: "json_schema",
              name: "meeting_recap_draft",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  summary: { type: "string" },
                  keyPoints: {
                    type: "array",
                    items: { type: "string" },
                  },
                  commitments: {
                    type: "array",
                    items: { type: "string" },
                  },
                  proposedFollowUpTitle: { type: ["string", "null"] },
                  proposedFollowUpDueAt: { type: ["string", "null"] },
                },
                required: [
                  "summary",
                  "keyPoints",
                  "commitments",
                  "proposedFollowUpTitle",
                  "proposedFollowUpDueAt",
                ],
              },
            },
          },
        }),
      },
    );
    const outputText = extraction.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === "output_text")?.text;
    if (!outputText) {
      throw new ServiceUnavailableException(
        "AI recap assistance returned no draft.",
      );
    }

    return {
      suggestion: JSON.parse(outputText) as AiRecapSuggestion,
      transcriptionUsage: this.tokens(transcription),
      extractionUsage: this.tokens(extraction),
    };
  }

  private tokens(response: ProviderResponse): AiUsageTokens {
    return {
      inputTokens: response.usage?.input_tokens ?? null,
      outputTokens: response.usage?.output_tokens ?? null,
    };
  }

  private async request<T>(
    url: string,
    apiKey: string,
    init: RequestInit,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...init.headers,
        },
      });
      if (!response.ok) {
        throw new ServiceUnavailableException(
          "AI recap assistance is temporarily unavailable.",
        );
      }
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(
        "AI recap assistance is temporarily unavailable.",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
