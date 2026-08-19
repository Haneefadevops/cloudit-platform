import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DatabaseService } from "../database/database.service";
import { getWeekNumber } from "./analytics.helper";
import type {
  AnalyticsEventType,
  ProfileMetrics,
  UsageSummary,
} from "../common/contracts/notchme.v2";
import type { AuthContext } from "../auth/types";

type InsightCountRow = Record<string, string | number | boolean | null>;

export type ActionableInsights = {
  periodDays: 30;
  activity: {
    profileViews: number;
    profileViewsPrevious: number;
    newPeople: number;
    newPeoplePrevious: number;
    bookings: number;
    bookingsPrevious: number;
    completedFollowUps: number;
  };
  workflow: {
    overdueFollowUps: number;
    dueNextSevenDays: number;
    upcomingBookings: number;
    recapsToReview: number;
  };
  actions: Array<{
    kind: "overdue" | "recaps" | "publish" | "booking_setup";
    title: string;
    description: string;
    count: number;
    href: string;
  }>;
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async trackEvent(
    profileId: string,
    eventType: AnalyticsEventType,
    metadata: {
      visitorId?: string;
      referrer?: string;
      userAgent?: string;
    } = {},
  ): Promise<void> {
    await this.databaseService.query(
      "INSERT INTO analytics_events (profile_id, event_type, visitor_id, referrer, user_agent) VALUES ($1, $2, $3, $4, $5)",
      [
        profileId,
        eventType,
        metadata.visitorId ?? null,
        metadata.referrer ?? null,
        metadata.userAgent ?? null,
      ],
    );
  }

  async trackActivationEvent(
    userId: string,
    eventType: AnalyticsEventType,
  ): Promise<void> {
    await this.databaseService.query(
      `INSERT INTO analytics_events (profile_id, event_type)
       SELECT p.id, $2
       FROM profiles p
       WHERE p.user_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM analytics_events e WHERE e.profile_id = p.id AND e.event_type = $2
         )`,
      [userId, eventType],
    );
  }

  async getProfileMetrics(profileId: string): Promise<ProfileMetrics> {
    const [eventsResult, ratingsResult] = await Promise.all([
      this.databaseService.query(
        `SELECT
           COUNT(*) FILTER (WHERE event_type = 'profile_view') AS profile_views,
           COUNT(*) FILTER (WHERE event_type = 'qr_scan') AS qr_scans,
           COUNT(*) FILTER (WHERE event_type = 'vcard_download') AS vcard_downloads,
           COUNT(*) FILTER (WHERE event_type = 'connection_added') AS connections_added,
           COUNT(*) FILTER (WHERE event_type = 'booking_created') AS bookings_created
         FROM analytics_events
         WHERE profile_id = $1`,
        [profileId],
      ),
      this.databaseService.query(
        `SELECT COALESCE(AVG(rating), 0) AS ratings_average, COUNT(*) AS ratings_count
         FROM customer_ratings
         WHERE profile_id = $1`,
        [profileId],
      ),
    ]);

    const eventRow = eventsResult.rows[0];
    const ratingRow = ratingsResult.rows[0];

    return {
      profileViews: Number(eventRow.profile_views),
      qrScans: Number(eventRow.qr_scans),
      vcardDownloads: Number(eventRow.vcard_downloads),
      connectionsAdded: Number(eventRow.connections_added),
      bookingsCreated: Number(eventRow.bookings_created),
      ratingsAverage: Number(ratingRow.ratings_average),
      ratingsCount: Number(ratingRow.ratings_count),
    };
  }

  async getUsageSummary(
    profileId: string,
    maxBookingsPerWeek: number | null,
  ): Promise<UsageSummary> {
    const now = new Date();
    const year = now.getFullYear();
    const week = getWeekNumber(now);

    const result = await this.databaseService.query(
      "SELECT count FROM usage_bookings WHERE profile_id = $1 AND year = $2 AND week = $3",
      [profileId, year, week],
    );

    return {
      bookingsThisWeek: Number(result.rows[0]?.count ?? 0),
      bookingsWeekLimit: maxBookingsPerWeek,
      staffCount: 1,
      staffLimit: 1,
    };
  }

  async getActionableInsights(user: AuthContext): Promise<ActionableInsights> {
    const organizationPredicate = user.organizationId
      ? "c.organization_id = $2"
      : "c.organization_id IS NULL AND c.owned_by_user_id = $1";
    const parameters = [user.id, user.organizationId];
    const [profileResult, peopleResult, bookingResult, meetingTypeResult] =
      await Promise.all([
        this.databaseService.query<InsightCountRow>(
          `SELECT p.is_published,
             count(e.id) FILTER (WHERE e.event_type = 'profile_view'
               AND e.created_at >= now() - interval '30 days')::text AS views_current,
             count(e.id) FILTER (WHERE e.event_type = 'profile_view'
               AND e.created_at >= now() - interval '60 days'
               AND e.created_at < now() - interval '30 days')::text AS views_previous
           FROM profiles p
           LEFT JOIN analytics_events e ON e.profile_id = p.id
           WHERE p.user_id = $1
           GROUP BY p.id, p.is_published`,
          [user.id],
        ),
        this.databaseService.query<InsightCountRow>(
          `SELECT
             count(DISTINCT c.id) FILTER (WHERE c.created_at >= now() - interval '30 days')::text AS people_current,
             count(DISTINCT c.id) FILTER (WHERE c.created_at >= now() - interval '60 days'
               AND c.created_at < now() - interval '30 days')::text AS people_previous,
             count(f.id) FILTER (WHERE f.completed_at IS NULL AND f.due_at < now())::text AS overdue,
             count(f.id) FILTER (WHERE f.completed_at IS NULL AND f.due_at >= now()
               AND f.due_at < now() + interval '7 days')::text AS due_soon,
             count(f.id) FILTER (WHERE f.completed_at >= now() - interval '30 days')::text AS completed
           FROM customers c
           LEFT JOIN customer_follow_ups f ON f.customer_id = c.id
           WHERE ${organizationPredicate}`,
          parameters,
        ),
        this.databaseService.query<InsightCountRow>(
          `SELECT
             count(*) FILTER (WHERE b.status <> 'cancelled'
               AND b.created_at >= now() - interval '30 days')::text AS bookings_current,
             count(*) FILTER (WHERE b.status <> 'cancelled'
               AND b.created_at >= now() - interval '60 days'
               AND b.created_at < now() - interval '30 days')::text AS bookings_previous,
             count(*) FILTER (WHERE b.status <> 'cancelled' AND b.start_at >= now())::text AS upcoming,
             count(*) FILTER (WHERE b.status <> 'cancelled' AND b.start_at < now()
               AND b.start_at >= now() - interval '30 days' AND mr.id IS NULL)::text AS recaps_to_review
           FROM bookings b
           LEFT JOIN meeting_recaps mr ON mr.booking_id = b.id
             AND mr.organization_id = $2
           WHERE b.owner_user_id = $1`,
          parameters,
        ),
        this.databaseService.query<InsightCountRow>(
          `SELECT count(*) FILTER (WHERE is_active)::text AS active_count
           FROM meeting_types WHERE owner_user_id = $1`,
          [user.id],
        ),
      ]);

    const profile = profileResult.rows[0] ?? {};
    const people = peopleResult.rows[0] ?? {};
    const bookings = bookingResult.rows[0] ?? {};
    const activeMeetingTypes = this.count(
      meetingTypeResult.rows[0]?.active_count,
    );
    const workflow = {
      overdueFollowUps: this.count(people.overdue),
      dueNextSevenDays: this.count(people.due_soon),
      upcomingBookings: this.count(bookings.upcoming),
      recapsToReview: this.count(bookings.recaps_to_review),
    };
    const actions: ActionableInsights["actions"] = [];
    if (!profile.is_published) {
      actions.push({
        kind: "publish",
        title: "Publish your professional page",
        description: "Make your page available before sharing it.",
        count: 1,
        href: "/dashboard/profile",
      });
    }
    if (activeMeetingTypes === 0) {
      actions.push({
        kind: "booking_setup",
        title: "Add a booking option",
        description: "Create an active meeting type so visitors can book.",
        count: 1,
        href: "/dashboard/scheduling/meeting-types",
      });
    }
    if (workflow.overdueFollowUps > 0) {
      actions.push({
        kind: "overdue",
        title: "Return to overdue relationships",
        description: `${workflow.overdueFollowUps} next action${workflow.overdueFollowUps === 1 ? " is" : "s are"} overdue.`,
        count: workflow.overdueFollowUps,
        href: "/dashboard",
      });
    }
    if (workflow.recapsToReview > 0) {
      actions.push({
        kind: "recaps",
        title: "Review recent meetings",
        description: `${workflow.recapsToReview} recent meeting${workflow.recapsToReview === 1 ? " has" : "s have"} no recap yet.`,
        count: workflow.recapsToReview,
        href: "/dashboard/scheduling/bookings",
      });
    }

    return {
      periodDays: 30,
      activity: {
        profileViews: this.count(profile.views_current),
        profileViewsPrevious: this.count(profile.views_previous),
        newPeople: this.count(people.people_current),
        newPeoplePrevious: this.count(people.people_previous),
        bookings: this.count(bookings.bookings_current),
        bookingsPrevious: this.count(bookings.bookings_previous),
        completedFollowUps: this.count(people.completed),
      },
      workflow,
      actions,
    };
  }

  private count(value: unknown): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  @OnEvent("rating.submitted")
  async handleRatingSubmitted(payload: {
    profileId: string;
    eventType: AnalyticsEventType;
  }) {
    await this.trackEvent(payload.profileId, payload.eventType);
  }
}
