import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AuthContext } from "../auth/types";
import { DatabaseService } from "../database/database.service";
import type { RecapDraftInput } from "./meeting-recaps.schemas";

type BookingRow = {
  id: string;
  customer_id: string;
  status: string;
  start_at: Date | string;
};

type MeetingRecapRow = {
  id: string;
  organization_id: string;
  booking_id: string;
  customer_id: string;
  author_user_id: string | null;
  status: "draft" | "finalized";
  source: "manual" | "ai_assisted";
  summary: string;
  key_points: string[];
  commitments: string[];
  private_note: string | null;
  proposed_follow_up_title: string | null;
  proposed_follow_up_due_at: Date | null;
  finalized_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class MeetingRecapsService {
  constructor(private readonly db: DatabaseService) {}

  private organizationId(user: AuthContext): string {
    if (!user.organizationId) {
      throw new NotFoundException("Booking not found.");
    }
    return user.organizationId;
  }

  private async booking(user: AuthContext, id: string): Promise<BookingRow> {
    const organizationId = this.organizationId(user);
    const result = await this.db.query<BookingRow>(
      `SELECT b.id, b.customer_id, b.status, b.start_at
       FROM bookings b
       JOIN users u ON u.id = b.owner_user_id
       JOIN customers c ON c.id = b.customer_id
       WHERE b.id = $1
         AND b.owner_user_id = $2
         AND u.organization_id = $3
         AND c.organization_id = $3`,
      [id, user.id, organizationId],
    );
    const booking = result.rows[0];
    if (!booking) throw new NotFoundException("Booking not found.");
    return booking;
  }

  private async recap(
    organizationId: string,
    bookingId: string,
  ): Promise<MeetingRecapRow | null> {
    const result = await this.db.query<MeetingRecapRow>(
      "SELECT * FROM meeting_recaps WHERE booking_id = $1 AND organization_id = $2",
      [bookingId, organizationId],
    );
    return result.rows[0] ?? null;
  }

  async get(user: AuthContext, id: string): Promise<MeetingRecapRow | null> {
    await this.booking(user, id);
    return this.recap(this.organizationId(user), id);
  }

  async save(
    user: AuthContext,
    id: string,
    input: RecapDraftInput,
  ): Promise<MeetingRecapRow> {
    const organizationId = this.organizationId(user);
    const booking = await this.booking(user, id);
    if (
      booking.status === "cancelled" ||
      new Date(booking.start_at).getTime() > Date.now()
    ) {
      throw new ConflictException(
        "A recap cannot be drafted for this booking.",
      );
    }

    const existing = await this.recap(organizationId, id);
    if (existing?.status === "finalized") {
      throw new ConflictException("Finalized recaps are immutable.");
    }

    const result = await this.db.query<MeetingRecapRow>(
      `INSERT INTO meeting_recaps (
         organization_id, booking_id, customer_id, author_user_id, summary,
         key_points, commitments, private_note, proposed_follow_up_title,
         proposed_follow_up_due_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (organization_id, booking_id) DO UPDATE SET
         summary = EXCLUDED.summary,
         key_points = EXCLUDED.key_points,
         commitments = EXCLUDED.commitments,
         private_note = EXCLUDED.private_note,
         proposed_follow_up_title = EXCLUDED.proposed_follow_up_title,
         proposed_follow_up_due_at = EXCLUDED.proposed_follow_up_due_at,
         updated_at = now()
       WHERE meeting_recaps.status = 'draft'
       RETURNING *`,
      [
        organizationId,
        id,
        booking.customer_id,
        user.id,
        input.summary,
        JSON.stringify(input.keyPoints),
        JSON.stringify(input.commitments),
        input.privateNote || null,
        input.proposedFollowUpTitle || null,
        input.proposedFollowUpDueAt ?? null,
      ],
    );
    const recap = result.rows[0];
    if (!recap) throw new ConflictException("Finalized recaps are immutable.");
    return recap;
  }

  async remove(user: AuthContext, id: string): Promise<void> {
    const organizationId = this.organizationId(user);
    await this.booking(user, id);
    const result = await this.db.query<{ id: string }>(
      `DELETE FROM meeting_recaps
       WHERE booking_id = $1 AND organization_id = $2 AND status = 'draft'
       RETURNING id`,
      [id, organizationId],
    );
    if (result.rowCount) return;

    const recap = await this.recap(organizationId, id);
    if (recap?.status === "finalized") {
      throw new ConflictException("Finalized recaps are immutable.");
    }
    throw new NotFoundException("Recap not found.");
  }
}
