import { pool } from "../../db/postgres.js";
import { getWeekNumber } from "../../lib/time.js";
import type { AnalyticsEventType, ProfileMetrics, UsageSummary } from "../../../../contracts/orbitone.v2.js";

export async function trackEvent(
  profileId: string,
  eventType: AnalyticsEventType,
  metadata: { visitorId?: string; referrer?: string; userAgent?: string } = {}
): Promise<void> {
  await pool.query(
    "INSERT INTO analytics_events (profile_id, event_type, visitor_id, referrer, user_agent) VALUES ($1, $2, $3, $4, $5)",
    [profileId, eventType, metadata.visitorId ?? null, metadata.referrer ?? null, metadata.userAgent ?? null]
  );
}

export async function getProfileMetrics(profileId: string): Promise<ProfileMetrics> {
  const [eventsResult, ratingsResult] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE event_type = 'profile_view') AS profile_views,
         COUNT(*) FILTER (WHERE event_type = 'qr_scan') AS qr_scans,
         COUNT(*) FILTER (WHERE event_type = 'vcard_download') AS vcard_downloads,
         COUNT(*) FILTER (WHERE event_type = 'connection_added') AS connections_added,
         COUNT(*) FILTER (WHERE event_type = 'booking_created') AS bookings_created
       FROM analytics_events
       WHERE profile_id = $1`,
      [profileId]
    ),
    pool.query(
      `SELECT COALESCE(AVG(rating), 0) AS ratings_average, COUNT(*) AS ratings_count
       FROM customer_ratings
       WHERE profile_id = $1`,
      [profileId]
    )
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

export async function getUsageSummary(profileId: string, maxBookingsPerWeek: number | null): Promise<UsageSummary> {
  const now = new Date();
  const year = now.getFullYear();
  const week = getWeekNumber(now);

  const result = await pool.query(
    "SELECT count FROM usage_bookings WHERE profile_id = $1 AND year = $2 AND week = $3",
    [profileId, year, week]
  );

  return {
    bookingsThisWeek: Number(result.rows[0]?.count ?? 0),
    bookingsWeekLimit: maxBookingsPerWeek,
    staffCount: 1,
    staffLimit: 1,
  };
}
