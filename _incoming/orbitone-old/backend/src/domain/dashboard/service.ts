import { pool } from "../../db/postgres.js";
import { getProfileMetrics, getUsageSummary } from "../analytics/service.js";
import { getCRMSummary } from "../customers/service.js";
import { mapBookingWithJoins } from "../../lib/mappers.js";
import type { AuthContext } from "../../lib/auth.js";
import type { DashboardSummary } from "../../../../contracts/orbitone.v2.js";
import { getPlanLimit } from "../../middleware/plan.js";
import { getProfilePlan } from "../scheduling/service.js";

export async function getDashboardSummary(user: AuthContext): Promise<DashboardSummary> {
  const profileResult = await pool.query("SELECT * FROM profiles WHERE user_id = $1", [user.id]);
  const profile = profileResult.rows[0];

  const [profileMetrics, usage, crmSummary, upcomingBookings] = await Promise.all([
    profile ? getProfileMetrics(profile.id) : Promise.resolve(getEmptyProfileMetrics()),
    profile
      ? getUsageSummary(profile.id, getPlanLimit(await getProfilePlan(user.id)).maxBookingsPerWeek)
      : Promise.resolve(getEmptyUsageSummary()),
    user.organizationId || user.plan.startsWith("pro_business")
      ? getCRMSummary({ userId: user.id, organizationId: user.organizationId })
      : Promise.resolve(null),
    pool.query(
      `SELECT
        b.id, b.owner_user_id, b.meeting_type_id, b.guest_id, b.customer_id, b.source, b.status,
        b.start_at, b.end_at, b.timezone, b.cancellation_reason, b.rescheduled_from_booking_id,
        b.external_provider, b.external_event_id, b.created_at, b.updated_at,
        mt.id AS meeting_type_id, mt.slug AS meeting_type_slug, mt.title AS meeting_type_title,
        mt.description AS meeting_type_description, mt.duration_minutes AS meeting_type_duration_minutes,
        mt.location_type AS meeting_type_location_type, mt.location_value AS meeting_type_location_value,
        mt.buffer_before_minutes AS meeting_type_buffer_before_minutes,
        mt.buffer_after_minutes AS meeting_type_buffer_after_minutes,
        mt.min_notice_minutes AS meeting_type_min_notice_minutes,
        mt.booking_window_days AS meeting_type_booking_window_days,
        mt.is_active AS meeting_type_is_active, mt.requires_approval AS meeting_type_requires_approval,
        mt.max_bookings_per_day AS meeting_type_max_bookings_per_day,
        mt.created_at AS meeting_type_created_at, mt.updated_at AS meeting_type_updated_at,
        bg.id AS guest_id, bg.name AS guest_name, bg.email AS guest_email,
        bg.company AS guest_company, bg.message AS guest_message, bg.created_at AS guest_created_at
       FROM bookings b
       JOIN meeting_types mt ON mt.id = b.meeting_type_id
       JOIN booking_guests bg ON bg.id = b.guest_id
       WHERE b.owner_user_id = $1 AND b.status IN ('pending', 'confirmed')
       ORDER BY b.start_at ASC
       LIMIT 10`,
      [user.id]
    )
  ]);

  return {
    profileMetrics,
    crmSummary,
    usage,
    upcomingBookings: upcomingBookings.rows.map(mapBookingWithJoins)
  };
}

function getEmptyProfileMetrics() {
  return {
    profileViews: 0,
    qrScans: 0,
    vcardDownloads: 0,
    connectionsAdded: 0,
    bookingsCreated: 0,
    ratingsAverage: 0,
    ratingsCount: 0
  };
}

function getEmptyUsageSummary() {
  return {
    bookingsThisWeek: 0,
    bookingsWeekLimit: 3,
    staffCount: 1,
    staffLimit: 1
  };
}
