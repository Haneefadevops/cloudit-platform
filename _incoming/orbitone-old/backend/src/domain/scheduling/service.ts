import { randomBytes, createHash } from "node:crypto";
import { pool } from "../../db/postgres.js";
import {
  mapMeetingType,
  mapAvailabilityRule,
  mapAvailabilityException,
  mapBookingWithJoins,
  mapPublicProfile,
  buildPublicBookingProfile,
  buildBookingSlot
} from "../../lib/mappers.js";
import { slugify } from "../../lib/slug.js";
import {
  parseTimeToMinutes,
  formatMinutesAsTime,
  getDatePartsInTimeZone,
  zonedDateTimeToUtc,
  addDaysToDateValue,
  overlaps,
  subtractLocalInterval,
  getWeekNumber
} from "../../lib/time.js";
import { getPlanLimit } from "../../middleware/plan.js";
import { upsertCustomerFromBooking, createBookingMeetingActivity } from "../customers/service.js";
import type { Plan } from "../../../../contracts/orbitone.v2.js";
import type {
  MeetingTypeInput,
  AvailabilityRuleInput,
  AvailabilityExceptionInput,
  PublicBookingInput,
  PublicBookingConfirmation
} from "../../../../contracts/orbitone.v2.js";

export async function getMeetingTypes(ownerUserId: string) {
  const result = await pool.query(
    "SELECT * FROM meeting_types WHERE owner_user_id = $1 ORDER BY created_at DESC",
    [ownerUserId]
  );
  return result.rows.map(mapMeetingType);
}

export async function createMeetingType(ownerUserId: string, input: MeetingTypeInput) {
  const slug = input.slug ?? slugify(input.title);

  const result = await pool.query(
    `INSERT INTO meeting_types (
      owner_user_id, slug, title, description, duration_minutes, location_type, location_value,
      buffer_before_minutes, buffer_after_minutes, min_notice_minutes, booking_window_days,
      max_bookings_per_day, requires_approval, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *`,
    [
      ownerUserId,
      slug,
      input.title,
      input.description ?? null,
      input.durationMinutes,
      input.locationType ?? "video",
      input.locationValue ?? null,
      input.bufferBeforeMinutes ?? 0,
      input.bufferAfterMinutes ?? 0,
      input.minNoticeMinutes ?? 60,
      input.bookingWindowDays ?? 30,
      input.maxBookingsPerDay ?? null,
      input.requiresApproval ?? false,
      input.isActive ?? true
    ]
  );

  return mapMeetingType(result.rows[0]);
}

export async function updateMeetingType(ownerUserId: string, id: string, input: Partial<MeetingTypeInput>) {
  const fields: string[] = [];
  const values: unknown[] = [];

  const addField = (column: string, value: unknown) => {
    values.push(value);
    fields.push(`${column} = $${values.length}`);
  };

  if (input.slug !== undefined) addField("slug", input.slug);
  if (input.title !== undefined) addField("title", input.title);
  if (input.description !== undefined) addField("description", input.description);
  if (input.durationMinutes !== undefined) addField("duration_minutes", input.durationMinutes);
  if (input.locationType !== undefined) addField("location_type", input.locationType);
  if (input.locationValue !== undefined) addField("location_value", input.locationValue);
  if (input.bufferBeforeMinutes !== undefined) addField("buffer_before_minutes", input.bufferBeforeMinutes);
  if (input.bufferAfterMinutes !== undefined) addField("buffer_after_minutes", input.bufferAfterMinutes);
  if (input.minNoticeMinutes !== undefined) addField("min_notice_minutes", input.minNoticeMinutes);
  if (input.bookingWindowDays !== undefined) addField("booking_window_days", input.bookingWindowDays);
  if (input.maxBookingsPerDay !== undefined) addField("max_bookings_per_day", input.maxBookingsPerDay);
  if (input.requiresApproval !== undefined) addField("requires_approval", input.requiresApproval);
  if (input.isActive !== undefined) addField("is_active", input.isActive);

  if (fields.length === 0) {
    const result = await pool.query(
      "SELECT * FROM meeting_types WHERE id = $1 AND owner_user_id = $2",
      [id, ownerUserId]
    );
    if (result.rowCount === 0) return null;
    return mapMeetingType(result.rows[0]);
  }

  values.push(id, ownerUserId);
  const result = await pool.query(
    `UPDATE meeting_types SET ${fields.join(", ")} WHERE id = $${values.length - 1} AND owner_user_id = $${values.length} RETURNING *`,
    values
  );

  if (result.rowCount === 0) return null;
  return mapMeetingType(result.rows[0]);
}

export async function deleteMeetingType(ownerUserId: string, id: string) {
  const result = await pool.query(
    "DELETE FROM meeting_types WHERE id = $1 AND owner_user_id = $2 RETURNING id",
    [id, ownerUserId]
  );
  return result.rowCount !== null && result.rowCount > 0;
}

export async function getAvailability(ownerUserId: string) {
  const [rulesResult, exceptionsResult] = await Promise.all([
    pool.query(
      "SELECT * FROM availability_rules WHERE owner_user_id = $1 ORDER BY day_of_week ASC, start_time ASC",
      [ownerUserId]
    ),
    pool.query(
      "SELECT * FROM availability_exceptions WHERE owner_user_id = $1 ORDER BY exception_date ASC, start_time ASC",
      [ownerUserId]
    )
  ]);

  return {
    rules: rulesResult.rows.map(mapAvailabilityRule),
    exceptions: exceptionsResult.rows.map(mapAvailabilityException)
  };
}

export async function updateAvailability(
  ownerUserId: string,
  rules: AvailabilityRuleInput[],
  exceptions: AvailabilityExceptionInput[]
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM availability_rules WHERE owner_user_id = $1", [ownerUserId]);
    await client.query("DELETE FROM availability_exceptions WHERE owner_user_id = $1", [ownerUserId]);

    for (const rule of rules) {
      await client.query(
        `INSERT INTO availability_rules (
          owner_user_id, day_of_week, start_time, end_time, timezone, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [ownerUserId, rule.dayOfWeek, rule.startTime, rule.endTime, rule.timezone, rule.isActive ?? true]
      );
    }

    for (const exception of exceptions) {
      await client.query(
        `INSERT INTO availability_exceptions (
          owner_user_id, exception_date, start_time, end_time, timezone, is_available, reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          ownerUserId,
          exception.exceptionDate,
          exception.startTime ?? null,
          exception.endTime ?? null,
          exception.timezone,
          exception.isAvailable ?? false,
          exception.reason ?? null
        ]
      );
    }

    await client.query("COMMIT");
    return getAvailability(ownerUserId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getBookings(ownerUserId: string) {
  const result = await pool.query(
    `SELECT
      b.*,
      mt.slug AS meeting_type_slug, mt.title AS meeting_type_title, mt.description AS meeting_type_description,
      mt.duration_minutes AS meeting_type_duration_minutes, mt.location_type AS meeting_type_location_type,
      mt.location_value AS meeting_type_location_value, mt.buffer_before_minutes AS meeting_type_buffer_before_minutes,
      mt.buffer_after_minutes AS meeting_type_buffer_after_minutes, mt.min_notice_minutes AS meeting_type_min_notice_minutes,
      mt.booking_window_days AS meeting_type_booking_window_days, mt.is_active AS meeting_type_is_active,
      mt.requires_approval AS meeting_type_requires_approval, mt.max_bookings_per_day AS meeting_type_max_bookings_per_day,
      mt.created_at AS meeting_type_created_at, mt.updated_at AS meeting_type_updated_at,
      bg.id AS guest_id, bg.name AS guest_name, bg.email AS guest_email,
      bg.company AS guest_company, bg.message AS guest_message, bg.created_at AS guest_created_at
    FROM bookings b
    JOIN meeting_types mt ON mt.id = b.meeting_type_id
    JOIN booking_guests bg ON bg.id = b.guest_id
    WHERE b.owner_user_id = $1
    ORDER BY b.start_at DESC`,
    [ownerUserId]
  );

  return result.rows.map(mapBookingWithJoins);
}

export async function getBooking(ownerUserId: string, id: string) {
  const result = await pool.query(
    `SELECT
      b.*,
      mt.slug AS meeting_type_slug, mt.title AS meeting_type_title, mt.description AS meeting_type_description,
      mt.duration_minutes AS meeting_type_duration_minutes, mt.location_type AS meeting_type_location_type,
      mt.location_value AS meeting_type_location_value, mt.buffer_before_minutes AS meeting_type_buffer_before_minutes,
      mt.buffer_after_minutes AS meeting_type_buffer_after_minutes, mt.min_notice_minutes AS meeting_type_min_notice_minutes,
      mt.booking_window_days AS meeting_type_booking_window_days, mt.is_active AS meeting_type_is_active,
      mt.requires_approval AS meeting_type_requires_approval, mt.max_bookings_per_day AS meeting_type_max_bookings_per_day,
      mt.created_at AS meeting_type_created_at, mt.updated_at AS meeting_type_updated_at,
      bg.id AS guest_id, bg.name AS guest_name, bg.email AS guest_email,
      bg.company AS guest_company, bg.message AS guest_message, bg.created_at AS guest_created_at
    FROM bookings b
    JOIN meeting_types mt ON mt.id = b.meeting_type_id
    JOIN booking_guests bg ON bg.id = b.guest_id
    WHERE b.id = $1 AND b.owner_user_id = $2`,
    [id, ownerUserId]
  );

  if (result.rowCount === 0) return null;
  return mapBookingWithJoins(result.rows[0]);
}

export async function cancelBooking(ownerUserId: string, id: string, reason?: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE bookings SET status = 'cancelled', cancellation_reason = $1
       WHERE id = $2 AND owner_user_id = $3 RETURNING *`,
      [reason ?? null, id, ownerUserId]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      "INSERT INTO booking_audit_events (booking_id, owner_user_id, event_type, metadata) VALUES ($1, $2, 'cancelled', $3)",
      [id, ownerUserId, JSON.stringify({ reason: reason ?? null })]
    );

    await client.query("COMMIT");
    return getBooking(ownerUserId, id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function approveBooking(ownerUserId: string, id: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE bookings SET status = 'confirmed'
       WHERE id = $1 AND owner_user_id = $2 AND status = 'pending' RETURNING *`,
      [id, ownerUserId]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      "INSERT INTO booking_audit_events (booking_id, owner_user_id, event_type, metadata) VALUES ($1, $2, 'approved', $3)",
      [id, ownerUserId, JSON.stringify({})]
    );

    await client.query("COMMIT");

    const booking = result.rows[0];
    if (booking.customer_id) {
      await createBookingMeetingActivity(
        booking.id,
        booking.customer_id,
        ownerUserId,
        (booking.start_at as Date).toISOString(),
        (booking.end_at as Date).toISOString()
      );
    }

    return getBooking(ownerUserId, id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function declineBooking(ownerUserId: string, id: string, reason?: string) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE bookings SET status = 'cancelled', cancellation_reason = $1
       WHERE id = $2 AND owner_user_id = $3 AND status = 'pending' RETURNING *`,
      [reason ?? null, id, ownerUserId]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      "INSERT INTO booking_audit_events (booking_id, owner_user_id, event_type, metadata) VALUES ($1, $2, 'declined', $3)",
      [id, ownerUserId, JSON.stringify({ reason: reason ?? null })]
    );

    await client.query("COMMIT");
    return getBooking(ownerUserId, id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getPublicBookingContext(profileSlug: string, meetingTypeSlug?: string) {
  const profileResult = await pool.query(
    "SELECT * FROM profiles WHERE slug = $1 AND is_published = true",
    [profileSlug]
  );

  if (profileResult.rowCount === 0) return null;
  const profile = profileResult.rows[0];

  let meetingTypesQuery =
    "SELECT * FROM meeting_types WHERE owner_user_id = $1 AND is_active = true";
  const params: unknown[] = [profile.user_id];

  if (meetingTypeSlug) {
    meetingTypesQuery += " AND slug = $2";
    params.push(meetingTypeSlug);
  }
  meetingTypesQuery += " ORDER BY created_at DESC";

  const meetingTypesResult = await pool.query(meetingTypesQuery, params);
  if (meetingTypesResult.rowCount === 0) return null;

  return {
    profile,
    meetingTypes: meetingTypesResult.rows
  };
}

export async function getPublicBookingProfile(profileSlug: string) {
  const profileResult = await pool.query(
    "SELECT * FROM profiles WHERE slug = $1 AND is_published = true",
    [profileSlug]
  );
  if (profileResult.rowCount === 0) return null;

  const profile = profileResult.rows[0];
  const meetingTypesResult = await pool.query(
    "SELECT * FROM meeting_types WHERE owner_user_id = $1 AND is_active = true ORDER BY created_at DESC",
    [profile.user_id]
  );

  return buildPublicBookingProfile(
    mapPublicProfile(profile),
    meetingTypesResult.rows.map(mapMeetingType)
  );
}

export async function generateBookingSlots(options: {
  ownerUserId: string;
  meetingType: Record<string, unknown>;
  from: Date;
  to: Date;
  timezone: string;
}) {
  const durationMinutes = Number(options.meetingType.duration_minutes);
  const bufferBeforeMinutes = Number(options.meetingType.buffer_before_minutes ?? 0);
  const bufferAfterMinutes = Number(options.meetingType.buffer_after_minutes ?? 0);
  const minNoticeMinutes = Number(options.meetingType.min_notice_minutes ?? 0);
  const bookingWindowDays = Number(options.meetingType.booking_window_days ?? 30);
  const maxBookingsPerDay =
    options.meetingType.max_bookings_per_day === null ||
    options.meetingType.max_bookings_per_day === undefined
      ? null
      : Number(options.meetingType.max_bookings_per_day);

  const now = new Date();
  const earliest = new Date(now.getTime() + minNoticeMinutes * 60 * 1000);
  const latest = new Date(now.getTime() + bookingWindowDays * 24 * 60 * 60 * 1000);
  const from = new Date(Math.max(options.from.getTime(), earliest.getTime()));
  const to = new Date(Math.min(options.to.getTime(), latest.getTime()));

  if (to <= from) return [];

  const [rulesResult, exceptionsResult, bookingsResult] = await Promise.all([
    pool.query(
      "SELECT * FROM availability_rules WHERE owner_user_id = $1 AND is_active = true",
      [options.ownerUserId]
    ),
    pool.query(
      "SELECT * FROM availability_exceptions WHERE owner_user_id = $1 AND exception_date BETWEEN $2 AND $3 ORDER BY exception_date ASC",
      [
        options.ownerUserId,
        getDatePartsInTimeZone(from, options.timezone).date,
        getDatePartsInTimeZone(to, options.timezone).date
      ]
    ),
    pool.query(
      `SELECT start_at, end_at FROM bookings
       WHERE owner_user_id = $1
         AND status IN ('pending', 'confirmed')
         AND start_at < $2
         AND end_at > $3`,
      [options.ownerUserId, to.toISOString(), from.toISOString()]
    )
  ]);

  const rulesByDay = new Map<number, Record<string, unknown>[]>();
  for (const rule of rulesResult.rows) {
    const day = Number(rule.day_of_week);
    rulesByDay.set(day, [...(rulesByDay.get(day) ?? []), rule]);
  }

  const exceptionsByDate = new Map<string, Record<string, unknown>[]>();
  for (const exception of exceptionsResult.rows) {
    const key = exception.exception_date instanceof Date
      ? exception.exception_date.toISOString().slice(0, 10)
      : String(exception.exception_date).slice(0, 10);
    exceptionsByDate.set(key, [...(exceptionsByDate.get(key) ?? []), exception]);
  }

  const busyIntervals = bookingsResult.rows.map((booking) => ({
    start: new Date(booking.start_at),
    end: new Date(booking.end_at)
  }));
  const bookingCountByDate = new Map<string, number>();
  for (const busy of busyIntervals) {
    const date = getDatePartsInTimeZone(busy.start, options.timezone).date;
    bookingCountByDate.set(date, (bookingCountByDate.get(date) ?? 0) + 1);
  }

  const slots: Array<{ startAt: string; endAt: string; timezone: string; available: boolean }> = [];
  let currentDate = getDatePartsInTimeZone(from, options.timezone).date;
  const endDate = getDatePartsInTimeZone(to, options.timezone).date;

  while (currentDate <= endDate) {
    const noon = zonedDateTimeToUtc(currentDate, "12:00", options.timezone);
    const dayOfWeek = getDatePartsInTimeZone(noon, options.timezone).dayOfWeek;
    if (maxBookingsPerDay !== null && (bookingCountByDate.get(currentDate) ?? 0) >= maxBookingsPerDay) {
      currentDate = addDaysToDateValue(currentDate, 1);
      continue;
    }

    let intervals = (rulesByDay.get(dayOfWeek) ?? []).map((rule) => ({
      startMinutes: parseTimeToMinutes(rule.start_time),
      endMinutes: parseTimeToMinutes(rule.end_time)
    }));

    for (const exception of exceptionsByDate.get(currentDate) ?? []) {
      if (exception.is_available && exception.start_time && exception.end_time) {
        intervals.push({
          startMinutes: parseTimeToMinutes(exception.start_time),
          endMinutes: parseTimeToMinutes(exception.end_time)
        });
      } else if (!exception.is_available && exception.start_time && exception.end_time) {
        intervals = subtractLocalInterval(intervals, {
          startMinutes: parseTimeToMinutes(exception.start_time),
          endMinutes: parseTimeToMinutes(exception.end_time)
        });
      } else if (!exception.is_available) {
        intervals = [];
      }
    }

    for (const interval of intervals) {
      for (
        let slotStartMinutes = interval.startMinutes;
        slotStartMinutes + durationMinutes <= interval.endMinutes;
        slotStartMinutes += 15
      ) {
        const start = zonedDateTimeToUtc(currentDate, formatMinutesAsTime(slotStartMinutes), options.timezone);
        const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
        const candidateStart = new Date(start.getTime() - bufferBeforeMinutes * 60 * 1000);
        const candidateEnd = new Date(end.getTime() + bufferAfterMinutes * 60 * 1000);

        if (start < from || end > to) continue;
        if (busyIntervals.some((busy) => overlaps(candidateStart, candidateEnd, busy.start, busy.end))) continue;

        slots.push(buildBookingSlot({
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          timezone: options.timezone,
          available: true
        }));
      }
    }

    currentDate = addDaysToDateValue(currentDate, 1);
  }

  return slots;
}

export async function getBookingSlots(
  profileSlug: string,
  meetingTypeSlug: string,
  from: Date,
  to: Date,
  timezone: string
) {
  const context = await getPublicBookingContext(profileSlug, meetingTypeSlug);
  if (!context) return null;

  const meetingType = mapMeetingType(context.meetingTypes[0]);
  const slots = await generateBookingSlots({
    ownerUserId: String(context.profile.user_id),
    meetingType: context.meetingTypes[0],
    from,
    to,
    timezone
  });

  return {
    profile: mapPublicProfile(context.profile),
    meetingType,
    slots
  };
}

export async function getProfilePlan(profileUserId: string): Promise<Plan> {
  const userResult = await pool.query(
    "SELECT organization_id, role, plan FROM users WHERE id = $1",
    [profileUserId]
  );
  const user = userResult.rows[0];
  if (!user) return "free";

  if (user.organization_id) {
    const orgResult = await pool.query("SELECT plan FROM organizations WHERE id = $1", [user.organization_id]);
    const orgPlan = orgResult.rows[0]?.plan;
    if (orgPlan && isValidPlan(orgPlan)) {
      return orgPlan as Plan;
    }
  }

  if (isValidPlan(user.plan)) {
    return user.plan as Plan;
  }

  return "free";
}

function isValidPlan(plan: string): boolean {
  return ["free", "pro_individual", "pro_business_starter", "pro_business_growth", "pro_business_enterprise"].includes(plan);
}

export async function getWeeklyBookingCount(profileId: string) {
  const now = new Date();
  const year = now.getFullYear();
  const week = getWeekNumber(now);

  const result = await pool.query(
    "SELECT count FROM usage_bookings WHERE profile_id = $1 AND year = $2 AND week = $3",
    [profileId, year, week]
  );

  return result.rows[0]?.count ?? 0;
}

export async function incrementWeeklyBookingCount(profileId: string) {
  const now = new Date();
  const year = now.getFullYear();
  const week = getWeekNumber(now);

  await pool.query(
    `INSERT INTO usage_bookings (profile_id, year, week, count)
     VALUES ($1, $2, $3, 1)
     ON CONFLICT (profile_id, year, week)
     DO UPDATE SET count = usage_bookings.count + 1`,
    [profileId, year, week]
  );
}

export class BookingError extends Error {
  constructor(
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "BookingError";
  }
}

export async function createPublicBooking(
  profileSlug: string,
  meetingTypeSlug: string,
  input: PublicBookingInput
): Promise<PublicBookingConfirmation> {
  const context = await getPublicBookingContext(profileSlug, meetingTypeSlug);
  if (!context) {
    throw new BookingError("Booking page not found.", 404);
  }

  const meetingType = context.meetingTypes[0];
  const requestedStart = new Date(input.startAt);
  if (Number.isNaN(requestedStart.getTime())) {
    throw new BookingError("Invalid booking start time.", 400);
  }

  const requestedEnd = new Date(requestedStart.getTime() + Number(meetingType.duration_minutes) * 60 * 1000);
  const ownerUserId = String(context.profile.user_id);
  const profileId = String(context.profile.id);

  const ownerResult = await pool.query(
    "SELECT organization_id FROM users WHERE id = $1",
    [ownerUserId]
  );
  const ownerOrganizationId = ownerResult.rows[0]?.organization_id ?? null;

  // Check weekly booking limit for free plan
  const plan = await getProfilePlan(ownerUserId);
  const limit = getPlanLimit(plan);
  if (limit.maxBookingsPerWeek !== null) {
    const currentCount = await getWeeklyBookingCount(profileId);
    if (currentCount >= limit.maxBookingsPerWeek) {
      throw new BookingError(
        `Free plan limit reached: ${limit.maxBookingsPerWeek} bookings per week. Upgrade to Pro for unlimited bookings.`,
        402
      );
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [ownerUserId]);

    const slots = await generateBookingSlots({
      ownerUserId,
      meetingType,
      from: new Date(requestedStart.getTime() - 24 * 60 * 60 * 1000),
      to: new Date(requestedEnd.getTime() + 24 * 60 * 60 * 1000),
      timezone: input.timezone
    });

    const matchingSlot = slots.find((slot) => slot.startAt === requestedStart.toISOString());
    if (!matchingSlot) {
      await client.query("ROLLBACK");
      throw new BookingError("This time is no longer available.", 409);
    }

    const guestResult = await client.query(
      "INSERT INTO booking_guests (name, email, company, message) VALUES ($1, $2, $3, $4) RETURNING *",
      [input.guestName, input.guestEmail, input.guestCompany ?? null, input.guestMessage ?? null]
    );

    const customerId = await upsertCustomerFromBooking(
      { userId: ownerUserId, organizationId: ownerOrganizationId },
      {
        fullName: input.guestName,
        email: input.guestEmail,
        company: input.guestCompany ?? null,
        source: "booking",
        sourceProfileId: profileId
      }
    );

    const status = meetingType.requires_approval === true ? "pending" : "confirmed";

    const bookingResult = await client.query(
      `INSERT INTO bookings (
        owner_user_id, meeting_type_id, guest_id, customer_id, source, status, start_at, end_at, timezone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [ownerUserId, meetingType.id, guestResult.rows[0].id, customerId, input.source ?? "profile", status, requestedStart.toISOString(), requestedEnd.toISOString(), input.timezone]
    );

    await client.query(
      "INSERT INTO booking_audit_events (booking_id, owner_user_id, event_type, metadata) VALUES ($1, $2, 'created', $3)",
      [bookingResult.rows[0].id, ownerUserId, JSON.stringify({ source: input.source ?? "profile" })]
    );

    const rescheduleToken = randomBytes(32).toString("hex");
    const cancelToken = randomBytes(32).toString("hex");
    const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await client.query(
      `INSERT INTO booking_guest_tokens (booking_id, token_hash, guest_email, type, expires_at)
       VALUES ($1, $2, $3, 'reschedule', $4), ($1, $5, $3, 'cancel', $4)`,
      [
        bookingResult.rows[0].id,
        hashGuestToken(rescheduleToken),
        input.guestEmail,
        tokenExpiresAt,
        hashGuestToken(cancelToken)
      ]
    );

    if (limit.maxBookingsPerWeek !== null) {
      await incrementWeeklyBookingCount(profileId);
    }

    await client.query("COMMIT");

    if (customerId && status === "confirmed") {
      await pool.query(
        "UPDATE customers SET source_booking_id = $1, source_user_id = $2 WHERE id = $3 AND source_booking_id IS NULL",
        [bookingResult.rows[0].id, ownerUserId, customerId]
      );
      await createBookingMeetingActivity(
        bookingResult.rows[0].id,
        customerId,
        ownerUserId,
        requestedStart.toISOString(),
        requestedEnd.toISOString()
      );
    }

    const publicProfile = mapPublicProfile(context.profile);

    const fullResult = await pool.query(
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
      WHERE b.id = $1`,
      [bookingResult.rows[0].id]
    );

    return {
      booking: mapBookingWithJoins(fullResult.rows[0]),
      profile: publicProfile,
      guestTokens: {
        reschedule: rescheduleToken,
        cancel: cancelToken
      }
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function hashGuestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
