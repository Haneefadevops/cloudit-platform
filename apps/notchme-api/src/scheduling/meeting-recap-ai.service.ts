import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AuthContext } from "../auth/types";
import { DatabaseService } from "../database/database.service";
import { recapDraftSchema } from "./meeting-recaps.schemas";
import { MeetingRecapAiProvider } from "./meeting-recap-ai.provider";
import { MeetingRecapsService } from "./meeting-recaps.service";

type BookingRow = {
  id: string;
  status: string;
  start_at: Date | string;
};

type UsageRow = { id: string };

export type PrivateAudioUpload = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
  size: number;
};

const ACCEPTED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/flac",
];

@Injectable()
export class MeetingRecapAiService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly provider: MeetingRecapAiProvider,
    private readonly recaps: MeetingRecapsService,
  ) {}

  async availability(user: AuthContext, bookingId: string) {
    await this.booking(user, bookingId);
    const monthlyLimit = this.positiveInteger(
      "NOTCHME_AI_RECAP_MONTHLY_LIMIT",
      10,
    );
    const used = await this.monthlyUsed(user);
    return {
      enabled: this.provider.enabled(),
      monthlyUsed: used,
      monthlyLimit,
      remaining: Math.max(0, monthlyLimit - used),
      maxAudioBytes: this.maxAudioBytes(),
      acceptedAudioTypes: ACCEPTED_AUDIO_TYPES,
      retention:
        "Audio and transcript are processed in memory and are not stored by NotchMe. Only the reviewable recap draft and content-free usage metadata are retained.",
    };
  }

  async suggest(
    user: AuthContext,
    bookingId: string,
    file: PrivateAudioUpload | undefined,
    consent: boolean,
  ) {
    if (!consent) {
      throw new ConflictException(
        "Confirm that this private voice note may be processed by AI.",
      );
    }
    if (!this.provider.enabled()) {
      throw new ServiceUnavailableException(
        "AI recap assistance is not configured.",
      );
    }
    if (!file?.buffer?.length) {
      throw new ConflictException("Choose a voice note to process.");
    }
    if (!ACCEPTED_AUDIO_TYPES.includes(file.mimetype)) {
      throw new ConflictException("This audio format is not supported.");
    }
    if (file.size > this.maxAudioBytes()) {
      throw new ConflictException("The voice note is too large.");
    }

    await this.booking(user, bookingId);
    const usageId = await this.reserveUsage(user, bookingId, file.size);
    try {
      const generated = await this.provider.suggest({
        buffer: file.buffer,
        mimeType: file.mimetype,
        filename: this.safeFilename(file.originalname, file.mimetype),
      });
      const input = recapDraftSchema.parse({
        summary: generated.suggestion.summary,
        keyPoints: generated.suggestion.keyPoints,
        commitments: generated.suggestion.commitments,
        privateNote: null,
        proposedFollowUpTitle:
          generated.suggestion.proposedFollowUpTitle || null,
        proposedFollowUpDueAt: this.validFutureDate(
          generated.suggestion.proposedFollowUpDueAt,
        ),
      });
      const recap = await this.recaps.saveAiDraft(user, bookingId, input);
      await this.db.query(
        `UPDATE ai_recap_usage SET
           recap_id = $2, status = 'succeeded', completed_at = now(),
           transcription_input_tokens = $3,
           transcription_output_tokens = $4,
           extraction_input_tokens = $5,
           extraction_output_tokens = $6
         WHERE id = $1`,
        [
          usageId,
          recap.id,
          generated.transcriptionUsage.inputTokens,
          generated.transcriptionUsage.outputTokens,
          generated.extractionUsage.inputTokens,
          generated.extractionUsage.outputTokens,
        ],
      );
      return {
        recap,
        usage: await this.usageSummary(user),
        audioRetained: false,
        transcriptRetained: false,
      };
    } catch (error) {
      await this.db.query(
        `UPDATE ai_recap_usage
         SET status = 'failed', error_code = $2, completed_at = now()
         WHERE id = $1`,
        [usageId, this.errorCode(error)],
      );
      throw error;
    }
  }

  private async booking(user: AuthContext, bookingId: string) {
    if (!user.organizationId) throw new NotFoundException("Booking not found.");
    const result = await this.db.query<BookingRow>(
      `SELECT b.id, b.status, b.start_at
       FROM bookings b
       JOIN users u ON u.id = b.owner_user_id
       JOIN customers c ON c.id = b.customer_id
       WHERE b.id = $1 AND b.owner_user_id = $2
         AND u.organization_id = $3 AND c.organization_id = $3`,
      [bookingId, user.id, user.organizationId],
    );
    const booking = result.rows[0];
    if (!booking) throw new NotFoundException("Booking not found.");
    if (
      booking.status === "cancelled" ||
      new Date(booking.start_at).getTime() > Date.now()
    ) {
      throw new ConflictException(
        "AI recap assistance is available after a completed meeting.",
      );
    }
    return booking;
  }

  private async reserveUsage(
    user: AuthContext,
    bookingId: string,
    audioBytes: number,
  ): Promise<string> {
    const organizationId = user.organizationId!;
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        `notchme-ai-recap:${organizationId}:${user.id}`,
      ]);
      const count = await client.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM ai_recap_usage
         WHERE organization_id = $1 AND user_id = $2
           AND status IN ('started','succeeded')
           AND created_at >= date_trunc('month', now())`,
        [organizationId, user.id],
      );
      if (
        Number(count.rows[0]?.count ?? 0) >=
        this.positiveInteger("NOTCHME_AI_RECAP_MONTHLY_LIMIT", 10)
      ) {
        throw new HttpException(
          "Monthly AI recap limit reached.",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      const inserted = await client.query<UsageRow>(
        `INSERT INTO ai_recap_usage (
           organization_id, user_id, booking_id, transcription_model,
           extraction_model, audio_bytes
         ) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          organizationId,
          user.id,
          bookingId,
          this.provider.transcriptionModel(),
          this.provider.extractionModel(),
          audioBytes,
        ],
      );
      await client.query("COMMIT");
      return inserted.rows[0].id;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async monthlyUsed(user: AuthContext): Promise<number> {
    if (!user.organizationId) return 0;
    const result = await this.db.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM ai_recap_usage
       WHERE organization_id = $1 AND user_id = $2
         AND status = 'succeeded'
         AND created_at >= date_trunc('month', now())`,
      [user.organizationId, user.id],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  private async usageSummary(user: AuthContext) {
    const monthlyLimit = this.positiveInteger(
      "NOTCHME_AI_RECAP_MONTHLY_LIMIT",
      10,
    );
    const monthlyUsed = await this.monthlyUsed(user);
    return {
      monthlyUsed,
      monthlyLimit,
      remaining: Math.max(0, monthlyLimit - monthlyUsed),
    };
  }

  private maxAudioBytes(): number {
    return this.positiveInteger("NOTCHME_AI_RECAP_MAX_BYTES", 10 * 1024 * 1024);
  }

  private positiveInteger(key: string, fallback: number): number {
    const value = Number(this.config.get(key));
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }

  private safeFilename(name: string, mimeType: string): string {
    const extension = name.match(/\.[a-z0-9]{1,5}$/i)?.[0];
    if (extension) return `voice-note${extension.toLowerCase()}`;
    if (mimeType === "audio/webm") return "voice-note.webm";
    if (mimeType === "audio/wav" || mimeType === "audio/x-wav") {
      return "voice-note.wav";
    }
    return "voice-note.mp4";
  }

  private validFutureDate(value: string | null): string | null {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) && parsed.getTime() > Date.now()
      ? parsed.toISOString()
      : null;
  }

  private errorCode(error: unknown): string {
    if (error instanceof HttpException) {
      return `http_${error.getStatus()}`;
    }
    return "processing_failed";
  }
}
