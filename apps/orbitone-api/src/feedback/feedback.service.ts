import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { randomBytes } from "crypto";
import { DatabaseService } from "../database/database.service";
import type {
  FeedbackRequest,
  FeedbackRequestInput,
  FeedbackChannel,
  FeedbackStatus,
  FeedbackTokenInfo,
} from "../common/contracts/orbitone.v2";

export type FeedbackContext = {
  userId: string;
  organizationId: string | null;
};

@Injectable()
export class FeedbackService {
  constructor(private readonly databaseService: DatabaseService) {}

  private mapFeedbackRequest(row: Record<string, unknown>): FeedbackRequest {
    return {
      id: row.id as string,
      customerId: row.customer_id as string,
      bookingId: (row.booking_id as string | null) ?? null,
      token: row.token as string,
      channel: row.channel as FeedbackChannel,
      status: row.status as FeedbackStatus,
      ratingId: (row.rating_id as string | null) ?? null,
      sentAt: row.sent_at ? (row.sent_at as Date).toISOString() : null,
      completedAt: row.completed_at
        ? (row.completed_at as Date).toISOString()
        : null,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    };
  }

  private ownershipClause(tableAlias = "c"): string {
    return `${tableAlias}.organization_id = $1 OR (${tableAlias}.organization_id IS NULL AND ${tableAlias}.assigned_to_user_id = $2)`;
  }

  async listFeedbackRequests(
    context: FeedbackContext,
    customerId: string,
  ): Promise<FeedbackRequest[]> {
    const result = await this.databaseService.query(
      `SELECT f.*
       FROM feedback_requests f
       JOIN customers c ON c.id = f.customer_id
       WHERE f.customer_id = $3 AND (${this.ownershipClause("c")})
       ORDER BY f.created_at DESC`,
      [context.organizationId, context.userId, customerId],
    );
    return result.rows.map((row) => this.mapFeedbackRequest(row));
  }

  async createFeedbackRequest(
    context: FeedbackContext,
    customerId: string,
    input: FeedbackRequestInput,
  ): Promise<FeedbackRequest> {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");
      const customerResult = await client.query(
        `SELECT c.id, c.full_name, c.source_profile_id, c.assigned_to_user_id, c.source_user_id
         FROM customers c
         WHERE c.id = $3 AND (${this.ownershipClause("c")})
         FOR UPDATE`,
        [context.organizationId, context.userId, customerId],
      );
      if (customerResult.rowCount === 0) {
        await client.query("ROLLBACK");
        throw new FeedbackError("Customer not found.", 404);
      }
      const customer = customerResult.rows[0];

      if (input.bookingId) {
        const bookingResult = await client.query(
          `SELECT b.id FROM bookings b
           JOIN customers c ON c.id = $1
           WHERE b.id = $2 AND b.owner_user_id = COALESCE(c.assigned_to_user_id, c.source_user_id, $3)`,
          [customerId, input.bookingId, context.userId],
        );
        if (bookingResult.rowCount === 0) {
          await client.query("ROLLBACK");
          throw new FeedbackError(
            "Booking not found or does not belong to this customer.",
          );
        }
      }

      const token = randomBytes(32).toString("hex");
      const channel: FeedbackChannel = input.channel ?? "email";

      const result = await client.query(
        `INSERT INTO feedback_requests (customer_id, booking_id, token, channel, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING *`,
        [customerId, input.bookingId ?? null, token, channel],
      );

      await client.query(
        `INSERT INTO customer_activities (customer_id, created_by_user_id, type, title, body, occurred_at)
         VALUES ($1, $2, 'other', $3, $4, now())`,
        [
          customerId,
          context.userId,
          "Feedback request created",
          `Channel: ${channel}`,
        ],
      );

      await client.query("COMMIT");
      return this.mapFeedbackRequest(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getFeedbackByToken(token: string): Promise<FeedbackTokenInfo | null> {
    const result = await this.databaseService.query(
      `SELECT f.customer_id, f.booking_id, c.full_name, c.source_profile_id, c.assigned_to_user_id, c.source_user_id
       FROM feedback_requests f
       JOIN customers c ON c.id = f.customer_id
       WHERE f.token = $1`,
      [token],
    );
    if (result.rowCount === 0) return null;
    const row = result.rows[0];

    let profileId: string | null = row.source_profile_id;
    if (!profileId && row.booking_id) {
      const bookingResult = await this.databaseService.query(
        "SELECT owner_user_id FROM bookings WHERE id = $1",
        [row.booking_id],
      );
      if (bookingResult.rowCount && bookingResult.rows[0].owner_user_id) {
        const profileResult = await this.databaseService.query(
          "SELECT id FROM profiles WHERE user_id = $1 LIMIT 1",
          [bookingResult.rows[0].owner_user_id],
        );
        if (profileResult.rowCount) {
          profileId = profileResult.rows[0].id;
        }
      }
    }
    if (!profileId) {
      const ownerId = row.assigned_to_user_id ?? row.source_user_id;
      const profileResult = await this.databaseService.query(
        "SELECT id FROM profiles WHERE user_id = $1 LIMIT 1",
        [ownerId],
      );
      if (profileResult.rowCount) {
        profileId = profileResult.rows[0].id;
      }
    }
    if (!profileId) return null;

    return {
      customerId: row.customer_id,
      customerName: row.full_name,
      profileId,
      bookingId: row.booking_id ?? null,
    };
  }

  async recordFeedbackRating(
    token: string,
    ratingId: string,
  ): Promise<boolean> {
    const result = await this.databaseService.query(
      `UPDATE feedback_requests
       SET status = 'completed', rating_id = $2, completed_at = now(), updated_at = now()
       WHERE token = $1 AND status != 'completed'
       RETURNING id`,
      [token, ratingId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  @OnEvent("feedback.rating.recorded")
  async handleFeedbackRatingRecorded(payload: {
    token: string;
    ratingId: string;
  }) {
    await this.recordFeedbackRating(payload.token, payload.ratingId);
  }

  async markFeedbackSent(token: string): Promise<boolean> {
    const result = await this.databaseService.query(
      `UPDATE feedback_requests
       SET status = 'sent', sent_at = now(), updated_at = now()
       WHERE token = $1 AND status = 'pending'
       RETURNING id`,
      [token],
    );
    return (result.rowCount ?? 0) > 0;
  }
}

export class FeedbackError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}
