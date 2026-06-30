import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { DatabaseService } from "../database/database.service";
import { mapCustomerRating } from "../common/lib/mappers";
import type {
  SubmitRatingInput,
  CustomerRating,
} from "../common/contracts/orbitone.v2";
import type { AuthContext } from "../auth/types";

@Injectable()
export class RatingsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async submitRating(
    input: SubmitRatingInput,
    user: AuthContext,
  ): Promise<CustomerRating> {
    const client = await this.databaseService.connect();
    try {
      await client.query("BEGIN");

      // Verify the profile belongs to the authenticated user.
      const profileResult = await client.query(
        "SELECT id FROM profiles WHERE id = $1 AND user_id = $2",
        [input.profileId, user.id],
      );
      if (profileResult.rowCount === 0) {
        throw new RatingError("Profile not found.", 404);
      }

      if (input.bookingId) {
        const bookingResult = await client.query(
          "SELECT id FROM bookings WHERE id = $1 AND owner_user_id = $2",
          [input.bookingId, user.id],
        );
        if (bookingResult.rowCount === 0) {
          throw new RatingError("Booking not found.", 404);
        }
      }

      if (input.customerId) {
        const customerWhere = user.organizationId
          ? "id = $1 AND organization_id = $2"
          : "id = $1 AND assigned_to_user_id = $2";
        const customerResult = await client.query(
          `SELECT id FROM customers WHERE ${customerWhere}`,
          [input.customerId, user.organizationId ?? user.id],
        );
        if (customerResult.rowCount === 0) {
          throw new RatingError("Customer not found.", 404);
        }
      }

      const result = await client.query(
        `INSERT INTO customer_ratings (booking_id, customer_id, profile_id, rating, review)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          input.bookingId ?? null,
          input.customerId ?? null,
          input.profileId,
          input.rating,
          input.review ?? null,
        ],
      );

      this.eventEmitter.emit("rating.submitted", {
        profileId: input.profileId,
        eventType: "rating_submitted" as const,
      });

      const rating = mapCustomerRating(result.rows[0]);

      await client.query("COMMIT");

      if (input.feedbackToken) {
        this.eventEmitter.emit("feedback.rating.recorded", {
          token: input.feedbackToken,
          ratingId: rating.id,
        });
      }

      return rating;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

export class RatingError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "RatingError";
  }
}
