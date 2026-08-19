import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import bcrypt from "bcryptjs";
import type { PoolClient } from "pg";
import type { AuthContext } from "../auth/types";
import { SessionService } from "../auth/session.service";
import { DatabaseService } from "../database/database.service";

type UserRow = {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  role: string;
  organization_id: string | null;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class AccountService {
  constructor(
    private readonly db: DatabaseService,
    private readonly sessions: SessionService,
  ) {}

  async export(user: AuthContext) {
    const customerScope = user.organizationId
      ? user.role === "admin"
        ? "c.organization_id = $2"
        : "c.organization_id = $2 AND c.assigned_to_user_id = $1"
      : "c.organization_id IS NULL AND c.assigned_to_user_id = $1";
    const values = [user.id, user.organizationId];
    const [
      account,
      profile,
      organization,
      meetingTypes,
      availability,
      bookings,
      people,
      activities,
      followUps,
      recaps,
      analytics,
      billing,
    ] = await Promise.all([
      this.db.query(
        `SELECT id, email, full_name, role, organization_id,
           is_billing_contact, plan, created_at, updated_at
         FROM users WHERE id = $1`,
        [user.id],
      ),
      this.db.query(
        `SELECT id, slug, type, full_name, headline, company, location, bio,
           avatar_url, email, phone, website_url, linkedin_url, x_url,
           department, job_title, is_published, created_at, updated_at
         FROM profiles WHERE user_id = $1`,
        [user.id],
      ),
      user.organizationId
        ? this.db.query(
            `SELECT id, slug, name, industry, plan, plan_status,
               trial_ends_at, subscription_renewal_at, created_at, updated_at
             FROM organizations WHERE id = $1`,
            [user.organizationId],
          )
        : Promise.resolve({ rows: [] }),
      this.db.query(
        `SELECT id, slug, title, description, duration_minutes, location_type,
           location_value, is_active, created_at, updated_at
         FROM meeting_types WHERE owner_user_id = $1 ORDER BY created_at`,
        [user.id],
      ),
      this.db.query(
        `SELECT day_of_week, start_time, end_time, timezone, is_active
         FROM availability_rules WHERE owner_user_id = $1 ORDER BY day_of_week, start_time`,
        [user.id],
      ),
      this.db.query(
        `SELECT b.id, b.status, b.source, b.start_at, b.end_at, b.timezone,
           b.created_at, bg.name AS guest_name, bg.email AS guest_email,
           bg.company AS guest_company, bg.message AS guest_message
         FROM bookings b JOIN booking_guests bg ON bg.id = b.guest_id
         WHERE b.owner_user_id = $1 ORDER BY b.start_at`,
        [user.id],
      ),
      this.db.query(
        `SELECT c.id, c.full_name, c.email, c.phone, c.company, c.notes,
           c.lifecycle_stage, c.priority, c.next_step, c.last_contacted_at,
           c.source, c.created_at, c.updated_at
         FROM customers c WHERE ${customerScope} ORDER BY c.created_at`,
        values,
      ),
      this.db.query(
        `SELECT a.id, a.customer_id, a.type, a.title, a.body, a.occurred_at,
           a.created_at
         FROM customer_activities a WHERE a.created_by_user_id = $1
         ORDER BY a.occurred_at`,
        [user.id],
      ),
      this.db.query(
        `SELECT f.id, f.customer_id, f.title, f.due_at, f.completed_at,
           f.created_at
         FROM customer_follow_ups f WHERE f.created_by_user_id = $1
         ORDER BY f.created_at`,
        [user.id],
      ),
      this.db.query(
        `SELECT id, booking_id, customer_id, status, source, summary,
           key_points, commitments, private_note, proposed_follow_up_title,
           proposed_follow_up_due_at, finalized_at, created_at, updated_at
         FROM meeting_recaps WHERE author_user_id = $1 ORDER BY created_at`,
        [user.id],
      ),
      this.db.query(
        `SELECT e.event_type, e.created_at
         FROM analytics_events e JOIN profiles p ON p.id = e.profile_id
         WHERE p.user_id = $1 ORDER BY e.created_at`,
        [user.id],
      ),
      user.organizationId
        ? this.db.query(
            `SELECT product_key, billing_interval, status, current_period_end,
               cancel_at_period_end, created_at, updated_at
             FROM billing_subscriptions WHERE organization_id = $1`,
            [user.organizationId],
          )
        : this.db.query(
            `SELECT product_key, billing_interval, status, current_period_end,
               cancel_at_period_end, created_at, updated_at
             FROM billing_subscriptions
             WHERE organization_id IS NULL AND owner_user_id = $1`,
            [user.id],
          ),
    ]);

    return {
      format: "notchme-account-export.v1",
      generatedAt: new Date().toISOString(),
      scope:
        user.organizationId && user.role === "admin"
          ? "organization_admin"
          : "personal",
      account: account.rows[0] ?? null,
      profile: profile.rows[0] ?? null,
      organization: organization.rows[0] ?? null,
      meetingTypes: meetingTypes.rows,
      availability: availability.rows,
      bookings: bookings.rows,
      people: people.rows,
      activitiesCreatedByYou: activities.rows,
      followUpsCreatedByYou: followUps.rows,
      meetingRecapsAuthoredByYou: recaps.rows,
      analyticsEvents: analytics.rows,
      billing: billing.rows[0] ?? null,
      exclusions: [
        "password hashes and reset tokens",
        "sessions and authentication cookies",
        "calendar access and refresh tokens",
        "guest booking management tokens",
        "webhook and provider secrets",
        "payment card data",
        "AI audio and transcripts, which NotchMe does not retain",
      ],
    };
  }

  async remove(
    user: AuthContext,
    input: { password: string; confirmation: "DELETE MY ACCOUNT" },
  ): Promise<void> {
    const client = await this.db.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<UserRow>(
        `SELECT id, email, full_name, password_hash, role, organization_id,
           created_at, updated_at
         FROM users WHERE id = $1 FOR UPDATE`,
        [user.id],
      );
      const row = result.rows[0];
      if (!row) throw new NotFoundException("Account not found.");
      if (!(await bcrypt.compare(input.password, row.password_hash))) {
        throw new ForbiddenException("The password is incorrect.");
      }

      await this.assertNoActiveBilling(client, row);
      await this.assertOrganizationContinuity(client, row);
      await client.query(
        `DELETE FROM ai_recap_usage WHERE user_id = $1
           OR booking_id IN (SELECT id FROM bookings WHERE owner_user_id = $1)`,
        [row.id],
      );
      await client.query(
        `DELETE FROM meeting_recaps WHERE author_user_id = $1
           OR booking_id IN (SELECT id FROM bookings WHERE owner_user_id = $1)`,
        [row.id],
      );
      const guests = await client.query<{ guest_id: string }>(
        "SELECT DISTINCT guest_id FROM bookings WHERE owner_user_id = $1",
        [row.id],
      );

      const memberCount = row.organization_id
        ? await this.organizationMemberCount(client, row.organization_id)
        : 0;
      if (row.organization_id && memberCount === 1) {
        await client.query("DELETE FROM organizations WHERE id = $1", [
          row.organization_id,
        ]);
      }
      await client.query("DELETE FROM users WHERE id = $1", [row.id]);
      if (guests.rows.length) {
        await client.query(
          `DELETE FROM booking_guests g
           WHERE g.id = ANY($1::uuid[])
             AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.guest_id = g.id)`,
          [guests.rows.map((guest) => guest.guest_id)],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    await this.sessions.revokeAllUserSessions(user.id).catch(() => undefined);
  }

  private async assertNoActiveBilling(client: PoolClient, user: UserRow) {
    const result = user.organization_id
      ? await client.query<{ status: string }>(
          `SELECT status FROM billing_subscriptions WHERE organization_id = $1`,
          [user.organization_id],
        )
      : await client.query<{ status: string }>(
          `SELECT status FROM billing_subscriptions
           WHERE organization_id IS NULL AND owner_user_id = $1`,
          [user.id],
        );
    if (
      result.rows[0] &&
      ["incomplete", "trialing", "active", "past_due", "paused"].includes(
        result.rows[0].status,
      )
    ) {
      throw new ConflictException(
        "End the active subscription in billing before deleting this account.",
      );
    }
  }

  private async assertOrganizationContinuity(
    client: PoolClient,
    user: UserRow,
  ) {
    if (!user.organization_id || user.role !== "admin") return;
    const members = await this.organizationMemberCount(
      client,
      user.organization_id,
    );
    if (members <= 1) return;
    const admins = await client.query<{ count: string }>(
      `SELECT count(*)::text AS count FROM users
       WHERE organization_id = $1 AND role = 'admin' AND id <> $2`,
      [user.organization_id, user.id],
    );
    if (Number(admins.rows[0]?.count ?? 0) === 0) {
      throw new ConflictException(
        "Assign another organization admin before deleting this account.",
      );
    }
  }

  private async organizationMemberCount(
    client: PoolClient,
    organizationId: string,
  ): Promise<number> {
    const result = await client.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM users WHERE organization_id = $1",
      [organizationId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }
}
