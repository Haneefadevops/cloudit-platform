import bcrypt from "bcryptjs";
import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { env } from "../config/env.js";
import { pool } from "../db/postgres.js";

type AuthUser = {
  id: string;
  email: string;
  fullName: string;
};

type JwtPayload = {
  sub: string;
  email: string;
};

type GoogleOAuthState = {
  sub: string;
  purpose: "google_calendar_connect";
};

type ZohoOAuthState = {
  sub: string;
  purpose: "zoho_calendar_connect";
};

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfoResponse = {
  id?: string;
  email?: string;
  verified_email?: boolean;
};

type ZohoTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  api_domain?: string;
  error?: string;
};

type ZohoUserInfoResponse = {
  ZUID?: string;
  Email?: string;
  email?: string;
  Display_Name?: string;
};

const authCookieName = "orbitone_session";
let meetingTypesMaxBookingsColumnExists: boolean | null = null;

export const v1Router = Router();

const registerSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(128)
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128)
});

const profileInputSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/),
  fullName: z.string().trim().min(1).max(120),
  headline: z.string().trim().max(160).nullable().optional(),
  company: z.string().trim().max(120).nullable().optional(),
  location: z.string().trim().max(120).nullable().optional(),
  bio: z.string().trim().max(600).nullable().optional(),
  avatarUrl: z.string().trim().url().nullable().optional(),
  email: z.string().trim().email().nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  websiteUrl: z.string().trim().url().nullable().optional(),
  linkedinUrl: z.string().trim().url().nullable().optional(),
  xUrl: z.string().trim().url().nullable().optional(),
  isPublished: z.boolean().optional()
});

const connectionInputSchema = z.object({
  connectedProfileId: z.string().uuid(),
  source: z.enum(["public_profile", "qr_code"]).default("public_profile")
});

const relationshipStatusSchema = z.object({
  relationshipStatus: z.enum(["new", "active", "follow_up", "opportunity", "archived"])
});

const connectionNoteInputSchema = z.object({
  body: z.string().trim().min(1).max(2000)
});

const tagInputSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/).default("#2563EB")
});

const connectionTagsInputSchema = z.object({
  tagIds: z.array(z.string().uuid()).max(20)
});

const followUpInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  dueAt: z.string().datetime()
});

const followUpUpdateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  dueAt: z.string().datetime().optional(),
  completed: z.boolean().optional()
});

const crmInputSchema = z.object({
  lifecycleStage: z.enum(["new", "contacted", "meeting", "proposal", "won", "lost"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  nextStep: z.string().trim().max(240).nullable().optional(),
  lastContactedAt: z.string().datetime().nullable().optional()
}).refine((value) => Object.keys(value).length > 0, "At least one CRM field is required.");

const activityInputSchema = z.object({
  activityType: z.enum(["note", "call", "email", "meeting", "other"]),
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().max(2000).nullable().optional(),
  occurredAt: z.string().datetime().optional()
});

const analyticsInputSchema = z.object({
  profileId: z.string().uuid(),
  eventType: z.enum([
    "profile_view",
    "qr_scan",
    "vcard_download",
    "connection_added",
    "booking_page_view",
    "booking_slot_selected",
    "booking_confirmed",
    "booking_cancelled",
    "booking_rescheduled"
  ]),
  visitorId: z.string().max(200).optional(),
  referrer: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional()
});

const profileSearchSchema = z.object({
  query: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});

const eventSlugSchema = z.string().trim().regex(/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/);

const eventInputSchema = z.object({
  slug: eventSlugSchema.optional(),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).nullable().optional(),
  location: z.string().trim().max(160).nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().nullable().optional(),
  isPublished: z.boolean().optional()
});

const eventUpdateSchema = eventInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one event field is required."
);

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/);

const meetingTypeInputSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/).optional(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).nullable().optional(),
  durationMinutes: z.number().int().min(5).max(480),
  locationType: z.enum(["video", "phone", "in_person", "custom"]).default("video"),
  locationValue: z.string().trim().max(500).nullable().optional(),
  bufferBeforeMinutes: z.number().int().min(0).max(240).default(0),
  bufferAfterMinutes: z.number().int().min(0).max(240).default(0),
  minNoticeMinutes: z.number().int().min(0).max(43200).default(60),
  bookingWindowDays: z.number().int().min(1).max(365).default(30),
  maxBookingsPerDay: z.number().int().min(1).max(100).nullable().optional(),
  requiresApproval: z.boolean().default(false),
  isActive: z.boolean().default(true)
});

const meetingTypeUpdateSchema = meetingTypeInputSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one meeting type field is required."
);

const availabilityRuleInputSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: timeSchema,
  endTime: timeSchema,
  timezone: z.string().trim().min(1).max(80),
  isActive: z.boolean().default(true)
}).refine((value) => value.endTime > value.startTime, {
  message: "Availability end time must be after start time."
});

const availabilityExceptionInputSchema = z.object({
  exceptionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: timeSchema.nullable().optional(),
  endTime: timeSchema.nullable().optional(),
  timezone: z.string().trim().min(1).max(80),
  isAvailable: z.boolean().default(false),
  reason: z.string().trim().max(240).nullable().optional()
}).refine((value) => {
  if (!value.startTime || !value.endTime) return true;
  return value.endTime > value.startTime;
}, {
  message: "Availability exception end time must be after start time."
});

const availabilityInputSchema = z.object({
  rules: z.array(availabilityRuleInputSchema).max(42),
  exceptions: z.array(availabilityExceptionInputSchema).max(365).default([])
});

const bookingStatusUpdateSchema = z.object({
  reason: z.string().trim().max(500).optional()
});

const bookingRescheduleSchema = z.object({
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  timezone: z.string().trim().min(1).max(80)
}).refine((value) => new Date(value.endAt) > new Date(value.startAt), {
  message: "Booking end time must be after start time."
});

const guestCancelSchema = z.object({
  reason: z.string().trim().max(500).optional()
});

const publicBookingSlotsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  timezone: z.string().trim().min(1).max(80).optional()
});

const publicBookingInputSchema = z.object({
  guestName: z.string().trim().min(1).max(120),
  guestEmail: z.string().trim().email().max(254),
  guestCompany: z.string().trim().max(120).nullable().optional(),
  guestMessage: z.string().trim().max(1000).nullable().optional(),
  startAt: z.string().datetime(),
  timezone: z.string().trim().min(1).max(80),
  source: z.enum(["profile", "connection", "event", "direct"]).default("profile"),
  connectionId: z.string().uuid().nullable().optional(),
  eventId: z.string().uuid().nullable().optional()
});

function ok<T>(data: T) {
  return { ok: true, data };
}

function fail(error: string) {
  return { ok: false, error };
}

function getCookie(cookieHeader: string | undefined, name: string) {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((cookie) => cookie.trim());
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function signSession(user: AuthUser) {
  return jwt.sign({ sub: user.id, email: user.email }, env.JWT_SECRET, {
    expiresIn: "7d"
  });
}

function signGoogleOAuthState(user: AuthUser) {
  return jwt.sign(
    { sub: user.id, purpose: "google_calendar_connect" },
    env.JWT_SECRET,
    { expiresIn: "10m" }
  );
}

function verifyGoogleOAuthState(state: string) {
  try {
    const payload = jwt.verify(state, env.JWT_SECRET) as GoogleOAuthState;
    if (payload.purpose !== "google_calendar_connect" || !payload.sub) return null;
    return payload;
  } catch {
    return null;
  }
}

function signZohoOAuthState(user: AuthUser) {
  return jwt.sign(
    { sub: user.id, purpose: "zoho_calendar_connect" },
    env.JWT_SECRET,
    { expiresIn: "10m" }
  );
}

function verifyZohoOAuthState(state: string) {
  try {
    const payload = jwt.verify(state, env.JWT_SECRET) as ZohoOAuthState;
    if (payload.purpose !== "zoho_calendar_connect" || !payload.sub) return null;
    return payload;
  } catch {
    return null;
  }
}

function getGoogleCalendarConfig() {
  if (
    !env.GOOGLE_CLIENT_ID ||
    !env.GOOGLE_CLIENT_SECRET ||
    !env.GOOGLE_CALENDAR_REDIRECT_URI ||
    !env.CALENDAR_TOKEN_ENCRYPTION_KEY
  ) {
    return null;
  }

  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_CALENDAR_REDIRECT_URI,
    encryptionKey: env.CALENDAR_TOKEN_ENCRYPTION_KEY
  };
}

function getZohoCalendarConfig() {
  if (
    !env.ZOHO_CLIENT_ID ||
    !env.ZOHO_CLIENT_SECRET ||
    !env.ZOHO_CALENDAR_REDIRECT_URI ||
    !env.CALENDAR_TOKEN_ENCRYPTION_KEY
  ) {
    return null;
  }

  return {
    clientId: env.ZOHO_CLIENT_ID,
    clientSecret: env.ZOHO_CLIENT_SECRET,
    redirectUri: env.ZOHO_CALENDAR_REDIRECT_URI,
    accountsBaseUrl: env.ZOHO_ACCOUNTS_BASE_URL.replace(/\/$/, ""),
    scopes: env.ZOHO_CALENDAR_SCOPES,
    encryptionKey: env.CALENDAR_TOKEN_ENCRYPTION_KEY
  };
}

function buildGoogleAuthorizationUrl(user: AuthUser, config: NonNullable<ReturnType<typeof getGoogleCalendarConfig>>) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", signGoogleOAuthState(user));
  url.searchParams.set("scope", [
    "openid",
    "email",
    "https://www.googleapis.com/auth/calendar.freebusy",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.calendarlist.readonly"
  ].join(" "));
  return url.toString();
}

function buildZohoAuthorizationUrl(user: AuthUser, config: NonNullable<ReturnType<typeof getZohoCalendarConfig>>) {
  const url = new URL("/oauth/v2/auth", config.accountsBaseUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", config.scopes);
  url.searchParams.set("state", signZohoOAuthState(user));
  return url.toString();
}

function encryptCalendarToken(token: string, encryptionKey: string) {
  const key = createHash("sha256").update(encryptionKey).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url")
  ].join(":");
}

function redirectToCalendarSettings(res: Response, params: Record<string, string>) {
  const url = new URL("/dashboard/scheduling/calendar", env.FRONTEND_ORIGIN);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  res.redirect(url.toString());
}

function setSessionCookie(res: Response, token: string) {
  res.cookie(authCookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/"
  });
}

function clearSessionCookie(res: Response) {
  res.clearCookie(authCookieName, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/"
  });
}

async function getAuthUser(req: Request) {
  const token = getCookie(req.headers.cookie, authCookieName);
  if (!token) return null;

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    const result = await pool.query(
      "SELECT id, email, full_name FROM users WHERE id = $1",
      [payload.sub]
    );
    return result.rows[0] ? mapUser(result.rows[0]) : null;
  } catch {
    return null;
  }
}

function mapUser(row: { id: string; email: string; full_name: string }): AuthUser {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name
  };
}

function mapProfile(row: Record<string, unknown>) {
  return {
    id: row.id,
    userId: row.user_id,
    slug: row.slug,
    fullName: row.full_name,
    headline: row.headline,
    company: row.company,
    location: row.location,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    email: row.email,
    phone: row.phone,
    websiteUrl: row.website_url,
    linkedinUrl: row.linkedin_url,
    xUrl: row.x_url,
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPublicProfile(row: Record<string, unknown>) {
  const profile = mapProfile(row);
  const { userId: _userId, isPublished: _isPublished, updatedAt: _updatedAt, ...publicProfile } = profile;
  return publicProfile;
}

function mapConnection(row: Record<string, unknown>) {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    connectedProfileId: row.connected_profile_id,
    source: row.source,
    relationshipStatus: row.relationship_status ?? "new",
    lifecycleStage: row.lifecycle_stage ?? "new",
    priority: row.priority ?? "medium",
    nextStep: row.next_step ?? null,
    lastContactedAt: row.last_contacted_at ?? null,
    fullName: row.full_name,
    headline: row.headline,
    company: row.company,
    email: row.email,
    phone: row.phone,
    websiteUrl: row.website_url,
    linkedinUrl: row.linkedin_url,
    createdAt: row.created_at
  };
}

function mapConnectionNote(row: Record<string, unknown>) {
  return {
    id: row.id,
    connectionId: row.connection_id,
    ownerUserId: row.owner_user_id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapTag(row: Record<string, unknown>) {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at
  };
}

function mapFollowUp(row: Record<string, unknown>) {
  return {
    id: row.id,
    connectionId: row.connection_id,
    ownerUserId: row.owner_user_id,
    title: row.title,
    dueAt: row.due_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapConnectionActivity(row: Record<string, unknown>) {
  return {
    id: row.id,
    connectionId: row.connection_id,
    ownerUserId: row.owner_user_id,
    activityType: row.activity_type,
    title: row.title,
    body: row.body,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapNetworkProfile(row: Record<string, unknown>) {
  return {
    profile: mapPublicProfile(row),
    connectionStatus: row.connection_status,
    connectedAt: row.connected_at ?? null
  };
}

function mapEvent(row: Record<string, unknown>) {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    location: row.location,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isPublished: row.is_published,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapPublicEvent(row: Record<string, unknown>) {
  const event = mapEvent(row);
  const { ownerUserId: _ownerUserId, isPublished: _isPublished, updatedAt: _updatedAt, ...publicEvent } = event;
  return publicEvent;
}

function mapEventCheckIn(row: Record<string, unknown>) {
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    profileId: row.profile_id,
    checkedInAt: row.checked_in_at
  };
}

function mapEventAttendee(row: Record<string, unknown>) {
  return {
    userId: row.attendee_user_id,
    profile: mapPublicProfile(row),
    checkedInAt: row.checked_in_at,
    connectionStatus: row.connection_status,
    connectedAt: row.connected_at ?? null
  };
}

function mapCalendarAccount(row: Record<string, unknown>) {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    provider: row.provider,
    providerAccountId: row.provider_account_id,
    email: row.email,
    calendarId: row.calendar_id,
    isConnected: row.is_connected,
    tokenExpiresAt: row.token_expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapMeetingType(row: Record<string, unknown>) {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    durationMinutes: row.duration_minutes,
    locationType: row.location_type,
    locationValue: row.location_value,
    bufferBeforeMinutes: row.buffer_before_minutes,
    bufferAfterMinutes: row.buffer_after_minutes,
    minNoticeMinutes: row.min_notice_minutes,
    bookingWindowDays: row.booking_window_days,
    maxBookingsPerDay: row.max_bookings_per_day ?? null,
    requiresApproval: row.requires_approval ?? false,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAvailabilityRule(row: Record<string, unknown>) {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    dayOfWeek: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
    timezone: row.timezone,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAvailabilityException(row: Record<string, unknown>) {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    exceptionDate: row.exception_date,
    startTime: row.start_time,
    endTime: row.end_time,
    timezone: row.timezone,
    isAvailable: row.is_available,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapBookingGuest(row: Record<string, unknown>) {
  return {
    id: row.guest_id ?? row.id,
    name: row.guest_name ?? row.name,
    email: row.guest_email ?? row.email,
    company: row.guest_company ?? row.company,
    message: row.guest_message ?? row.message,
    createdAt: row.guest_created_at ?? row.created_at
  };
}

function mapBooking(row: Record<string, unknown>) {
  const booking = {
    id: row.id,
    ownerUserId: row.owner_user_id,
    meetingTypeId: row.meeting_type_id,
    guestId: row.guest_id,
    connectionId: row.connection_id,
    eventId: row.event_id,
    source: row.source,
    status: row.status,
    startAt: row.start_at,
    endAt: row.end_at,
    timezone: row.timezone,
    cancellationReason: row.cancellation_reason,
    rescheduledFromBookingId: row.rescheduled_from_booking_id,
    externalProvider: row.external_provider,
    externalEventId: row.external_event_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };

  return {
    ...booking,
    meetingType: row.meeting_type_slug ? {
      id: row.meeting_type_id,
      ownerUserId: row.owner_user_id,
      slug: row.meeting_type_slug,
      title: row.meeting_type_title,
      description: row.meeting_type_description,
      durationMinutes: row.meeting_type_duration_minutes,
      locationType: row.meeting_type_location_type,
      locationValue: row.meeting_type_location_value,
      bufferBeforeMinutes: row.meeting_type_buffer_before_minutes,
      bufferAfterMinutes: row.meeting_type_buffer_after_minutes,
      minNoticeMinutes: row.meeting_type_min_notice_minutes,
      bookingWindowDays: row.meeting_type_booking_window_days,
      maxBookingsPerDay: row.meeting_type_max_bookings_per_day ?? null,
      requiresApproval: row.meeting_type_requires_approval ?? false,
      isActive: row.meeting_type_is_active,
      createdAt: row.meeting_type_created_at,
      updatedAt: row.meeting_type_updated_at
    } : undefined,
    guest: row.guest_name ? mapBookingGuest(row) : undefined
  };
}

function mapPublicBookingProfile(profileRow: Record<string, unknown>, meetingTypeRows: Record<string, unknown>[]) {
  return {
    profile: mapPublicProfile(profileRow),
    meetingTypes: meetingTypeRows.map(mapMeetingType)
  };
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  return slug.length >= 3 ? slug : `user-${slug || "profile"}`;
}

async function makeUniqueSlug(baseValue: string) {
  const baseSlug = slugify(baseValue);

  for (let index = 0; index < 100; index += 1) {
    const slug = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
    const result = await pool.query("SELECT 1 FROM profiles WHERE slug = $1", [slug]);
    if (result.rowCount === 0) return slug;
  }

  return `${baseSlug}-${Date.now()}`;
}

async function makeUniqueEventSlug(baseValue: string) {
  const baseSlug = slugify(baseValue);

  for (let index = 0; index < 100; index += 1) {
    const slug = index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;
    const result = await pool.query("SELECT 1 FROM events WHERE slug = $1", [slug]);
    if (result.rowCount === 0) return slug;
  }

  return `${baseSlug}-${Date.now()}`;
}

async function requireUser(req: Request, res: Response) {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json(fail("Authentication required."));
    return null;
  }

  return user;
}

async function getOwnedConnection(connectionId: string, ownerUserId: string) {
  const result = await pool.query(
    "SELECT * FROM connections WHERE id = $1 AND owner_user_id = $2",
    [connectionId, ownerUserId]
  );

  return result.rows[0] ?? null;
}

async function insertAnalyticsEvent(
  profileId: string,
  eventType: z.infer<typeof analyticsInputSchema>["eventType"],
  req?: Request
) {
  try {
    await pool.query(
      "INSERT INTO analytics_events (profile_id, event_type, referrer, user_agent) VALUES ($1, $2, $3, $4)",
      [profileId, eventType, req?.get("referer") ?? null, req?.get("user-agent") ?? null]
    );
  } catch {
    return;
  }
}

async function createBookingConnectionActivity(options: {
  db?: { query: (text: string, values?: unknown[]) => Promise<unknown> };
  connectionId: string;
  ownerUserId: string;
  meetingTitle: string;
  guestName: string;
  guestEmail: string;
  startAt: string;
  timezone: string;
}) {
  const db = options.db ?? pool;
  await db.query(
    `INSERT INTO connection_activities (
      connection_id,
      owner_user_id,
      activity_type,
      title,
      body,
      occurred_at
    )
    VALUES ($1, $2, 'meeting', $3, $4, $5)`,
    [
      options.connectionId,
      options.ownerUserId,
      `Booked ${options.meetingTitle}`,
      `Guest: ${options.guestName} <${options.guestEmail}>. Timezone: ${options.timezone}.`,
      options.startAt
    ]
  );

  await db.query(
    `UPDATE connections
    SET
      lifecycle_stage = CASE
        WHEN lifecycle_stage IN ('new', 'contacted') THEN 'meeting'
        ELSE lifecycle_stage
      END,
      last_contacted_at = COALESCE(last_contacted_at, now())
    WHERE id = $1 AND owner_user_id = $2`,
    [options.connectionId, options.ownerUserId]
  );
}

async function hasMeetingTypesMaxBookingsColumn() {
  if (meetingTypesMaxBookingsColumnExists !== null) return meetingTypesMaxBookingsColumnExists;

  const result = await pool.query(
    `SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'meeting_types'
      AND column_name = 'max_bookings_per_day'
    LIMIT 1`
  );
  meetingTypesMaxBookingsColumnExists = (result.rowCount ?? 0) > 0;
  return meetingTypesMaxBookingsColumnExists;
}

function hashGuestToken(rawToken: string) {
  return createHash("sha256").update(rawToken).digest("hex");
}

async function validateGuestToken(
  token: string,
  type: "reschedule" | "cancel",
  profileSlug: string,
  meetingTypeSlug: string
) {
  const tokenHash = hashGuestToken(token);
  const result = await pool.query(
    `SELECT
      bgt.id AS token_id,
      bgt.used_at,
      bgt.expires_at,
      bgt.guest_email AS token_guest_email,
      b.id,
      b.status,
      b.owner_user_id,
      b.meeting_type_id,
      b.connection_id,
      b.event_id,
      b.source,
      b.start_at,
      b.end_at,
      b.timezone,
      b.cancellation_reason,
      b.rescheduled_from_booking_id,
      b.external_provider,
      b.external_event_id,
      b.created_at,
      b.updated_at,
      mt.slug AS meeting_type_slug,
      mt.title AS meeting_type_title,
      mt.description AS meeting_type_description,
      mt.duration_minutes AS meeting_type_duration_minutes,
      mt.location_type AS meeting_type_location_type,
      mt.location_value AS meeting_type_location_value,
      mt.buffer_before_minutes AS meeting_type_buffer_before_minutes,
      mt.buffer_after_minutes AS meeting_type_buffer_after_minutes,
      mt.min_notice_minutes AS meeting_type_min_notice_minutes,
      mt.booking_window_days AS meeting_type_booking_window_days,
      mt.max_bookings_per_day AS meeting_type_max_bookings_per_day,
      mt.is_active AS meeting_type_is_active,
      mt.requires_approval AS meeting_type_requires_approval,
      mt.created_at AS meeting_type_created_at,
      mt.updated_at AS meeting_type_updated_at,
      bg.id AS guest_id,
      bg.name AS guest_name,
      bg.email AS guest_email,
      bg.company AS guest_company,
      bg.message AS guest_message,
      bg.created_at AS guest_created_at
    FROM booking_guest_tokens bgt
    JOIN bookings b ON b.id = bgt.booking_id
    JOIN meeting_types mt ON mt.id = b.meeting_type_id
    JOIN profiles p ON p.user_id = b.owner_user_id
    JOIN booking_guests bg ON bg.id = b.guest_id
    WHERE bgt.token_hash = $1
      AND bgt.type = $2
      AND p.slug = $3
      AND mt.slug = $4
      AND bgt.expires_at > now()
      AND bgt.used_at IS NULL`,
    [tokenHash, type, profileSlug, meetingTypeSlug]
  );

  return result.rows[0] ?? null;
}

function parseTimeToMinutes(value: unknown) {
  const [hours, minutes] = String(value).split(":").map(Number);
  return hours * 60 + minutes;
}

function formatMinutesAsTime(minutes: number) {
  const hours = Math.floor(minutes / 60).toString().padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

function getDatePartsInTimeZone(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short"
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const weekdays: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    dayOfWeek: weekdays[parts.weekday] ?? 0
  };
}

function getTimeZoneOffsetMs(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(dateValue: string, timeValue: string, timezone: string) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hours, minutes] = timeValue.split(":").map(Number);
  let utcMs = Date.UTC(year, month - 1, day, hours, minutes, 0);

  for (let index = 0; index < 2; index += 1) {
    utcMs = Date.UTC(year, month - 1, day, hours, minutes, 0) - getTimeZoneOffsetMs(new Date(utcMs), timezone);
  }

  return new Date(utcMs);
}

function addDaysToDateValue(dateValue: string, days: number) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && endA > startB;
}

function subtractLocalInterval(
  intervals: Array<{ startMinutes: number; endMinutes: number }>,
  block: { startMinutes: number; endMinutes: number }
) {
  return intervals.flatMap((interval) => {
    if (block.endMinutes <= interval.startMinutes || block.startMinutes >= interval.endMinutes) return [interval];

    const remaining: Array<{ startMinutes: number; endMinutes: number }> = [];
    if (block.startMinutes > interval.startMinutes) {
      remaining.push({ startMinutes: interval.startMinutes, endMinutes: block.startMinutes });
    }
    if (block.endMinutes < interval.endMinutes) {
      remaining.push({ startMinutes: block.endMinutes, endMinutes: interval.endMinutes });
    }
    return remaining;
  });
}

async function getPublicBookingContext(profileSlug: string, meetingTypeSlug?: string) {
  const profileResult = await pool.query(
    "SELECT * FROM profiles WHERE slug = $1 AND is_published = true",
    [profileSlug]
  );

  if (profileResult.rowCount === 0) return null;

  const profile = profileResult.rows[0];
  const params = meetingTypeSlug ? [profile.user_id, meetingTypeSlug] : [profile.user_id];
  const meetingTypesResult = await pool.query(
    meetingTypeSlug
      ? "SELECT * FROM meeting_types WHERE owner_user_id = $1 AND slug = $2 AND is_active = true"
      : "SELECT * FROM meeting_types WHERE owner_user_id = $1 AND is_active = true ORDER BY created_at DESC",
    params
  );

  if (meetingTypeSlug && meetingTypesResult.rowCount === 0) return null;

  return {
    profile,
    meetingTypes: meetingTypesResult.rows
  };
}

async function generateBookingSlots(options: {
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
  const maxBookingsPerDay = options.meetingType.max_bookings_per_day === null ||
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

        slots.push({
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          timezone: options.timezone,
          available: true
        });
      }
    }

    currentDate = addDaysToDateValue(currentDate, 1);
  }

  return slots;
}

function generateVCard(profile: ReturnType<typeof mapPublicProfile>) {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${profile.fullName}`,
    profile.company ? `ORG:${profile.company}` : null,
    profile.headline ? `TITLE:${profile.headline}` : null,
    profile.email ? `EMAIL;TYPE=INTERNET:${profile.email}` : null,
    profile.phone ? `TEL;TYPE=CELL:${profile.phone}` : null,
    profile.websiteUrl ? `URL:${profile.websiteUrl}` : null,
    profile.linkedinUrl ? `X-SOCIALPROFILE;TYPE=linkedin:${profile.linkedinUrl}` : null,
    profile.xUrl ? `X-SOCIALPROFILE;TYPE=x:${profile.xUrl}` : null,
    "END:VCARD"
  ];

  return lines.filter(Boolean).join("\r\n");
}

v1Router.get("/", (_req, res) => {
  res.json(ok({ service: "OrbitOne API", version: "v1" }));
});

v1Router.post("/auth/register", async (req, res) => {
  const input = registerSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(fail("Invalid registration details."));
    return;
  }

  const passwordHash = await bcrypt.hash(input.data.password, 12);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const userResult = await client.query(
      "INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id, email, full_name",
      [input.data.email, passwordHash, input.data.fullName]
    );
    const user = mapUser(userResult.rows[0]);
    const slug = await makeUniqueSlug(input.data.fullName || input.data.email);

    await client.query(
      "INSERT INTO profiles (user_id, slug, full_name, email, is_published) VALUES ($1, $2, $3, $4, false)",
      [user.id, slug, user.fullName, user.email]
    );

    await client.query("COMMIT");
    setSessionCookie(res, signSession(user));
    res.status(201).json(ok(user));
  } catch (error) {
    await client.query("ROLLBACK");
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json(fail("An account with this email already exists."));
      return;
    }
    res.status(500).json(fail("Could not create account."));
  } finally {
    client.release();
  }
});

v1Router.post("/auth/login", async (req, res) => {
  const input = loginSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(fail("Invalid login details."));
    return;
  }

  const result = await pool.query(
    "SELECT id, email, full_name, password_hash FROM users WHERE email = $1",
    [input.data.email]
  );

  const row = result.rows[0];
  if (!row || !(await bcrypt.compare(input.data.password, row.password_hash))) {
    res.status(401).json(fail("Invalid email or password."));
    return;
  }

  const user = mapUser(row);
  setSessionCookie(res, signSession(user));
  res.json(ok(user));
});

v1Router.post("/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json(ok({ loggedOut: true }));
});

v1Router.get("/auth/me", async (req, res) => {
  const user = await getAuthUser(req);
  if (!user) {
    res.status(401).json(fail("Not authenticated."));
    return;
  }
  res.json(ok(user));
});

v1Router.get("/profiles/me", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const result = await pool.query("SELECT * FROM profiles WHERE user_id = $1", [user.id]);
  if (result.rowCount === 0) {
    res.status(404).json(fail("Profile not found."));
    return;
  }

  res.json(ok(mapProfile(result.rows[0])));
});

v1Router.get("/profiles", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const input = profileSearchSchema.safeParse(req.query);
  if (!input.success) {
    res.status(400).json(fail("Invalid profile search."));
    return;
  }

  const search = input.data.query ? `%${input.data.query}%` : null;
  const result = await pool.query(
    `WITH my_profile AS (
      SELECT id
      FROM profiles
      WHERE user_id = $1
    )
    SELECT
      p.*,
      CASE
        WHEN mine.id IS NOT NULL AND reciprocal.id IS NOT NULL THEN 'mutual'
        WHEN mine.id IS NOT NULL THEN 'saved'
        WHEN reciprocal.id IS NOT NULL THEN 'saved_me'
        ELSE 'none'
      END AS connection_status,
      mine.created_at AS connected_at
    FROM profiles p
    CROSS JOIN my_profile mp
    LEFT JOIN connections mine
      ON mine.owner_user_id = $1
      AND mine.connected_profile_id = p.id
    LEFT JOIN connections reciprocal
      ON reciprocal.owner_user_id = p.user_id
      AND reciprocal.connected_profile_id = mp.id
    WHERE p.is_published = true
      AND p.user_id <> $1
      AND (
        $2::text IS NULL
        OR p.full_name ILIKE $2
        OR p.headline ILIKE $2
        OR p.company ILIKE $2
        OR p.location ILIKE $2
      )
    ORDER BY
      CASE
        WHEN mine.id IS NOT NULL AND reciprocal.id IS NOT NULL THEN 1
        WHEN reciprocal.id IS NOT NULL THEN 2
        WHEN mine.id IS NOT NULL THEN 3
        ELSE 4
      END,
      p.full_name ASC
    LIMIT $3`,
    [user.id, search, input.data.limit]
  );

  res.json(ok(result.rows.map(mapNetworkProfile)));
});

v1Router.put("/profiles/me", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const input = profileInputSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(fail("Invalid profile details."));
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO profiles (
        user_id, slug, full_name, headline, company, location, bio, avatar_url,
        email, phone, website_url, linkedin_url, x_url, is_published
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      ON CONFLICT (user_id) DO UPDATE SET
        slug = EXCLUDED.slug,
        full_name = EXCLUDED.full_name,
        headline = EXCLUDED.headline,
        company = EXCLUDED.company,
        location = EXCLUDED.location,
        bio = EXCLUDED.bio,
        avatar_url = EXCLUDED.avatar_url,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone,
        website_url = EXCLUDED.website_url,
        linkedin_url = EXCLUDED.linkedin_url,
        x_url = EXCLUDED.x_url,
        is_published = EXCLUDED.is_published
      RETURNING *`,
      [
        user.id,
        input.data.slug,
        input.data.fullName,
        input.data.headline ?? null,
        input.data.company ?? null,
        input.data.location ?? null,
        input.data.bio ?? null,
        input.data.avatarUrl ?? null,
        input.data.email ?? null,
        input.data.phone ?? null,
        input.data.websiteUrl ?? null,
        input.data.linkedinUrl ?? null,
        input.data.xUrl ?? null,
        input.data.isPublished ?? false
      ]
    );

    res.json(ok(mapProfile(result.rows[0])));
  } catch (error) {
    if ((error as { code?: string; constraint?: string }).code === "23505") {
      res.status(409).json(fail("This profile slug is already taken."));
      return;
    }
    res.status(500).json(fail("Could not save profile."));
  }
});

v1Router.get("/profiles/:slug", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM profiles WHERE slug = $1 AND is_published = true",
    [req.params.slug]
  );

  if (result.rowCount === 0) {
    res.status(404).json(fail("Profile not found."));
    return;
  }

  const profile = mapPublicProfile(result.rows[0]);

  await pool.query(
    "INSERT INTO analytics_events (profile_id, event_type, referrer, user_agent) VALUES ($1, 'profile_view', $2, $3)",
    [profile.id, req.get("referer") ?? null, req.get("user-agent") ?? null]
  );

  res.json(ok(profile));
});

v1Router.get("/profiles/:slug/vcard", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM profiles WHERE slug = $1 AND is_published = true",
    [req.params.slug]
  );

  if (result.rowCount === 0) {
    res.status(404).json(fail("Profile not found."));
    return;
  }

  const profile = mapPublicProfile(result.rows[0]);
  await pool.query(
    "INSERT INTO analytics_events (profile_id, event_type, referrer, user_agent) VALUES ($1, 'vcard_download', $2, $3)",
    [profile.id, req.get("referer") ?? null, req.get("user-agent") ?? null]
  );

  res
    .setHeader("Content-Type", "text/vcard; charset=utf-8")
    .setHeader("Content-Disposition", `attachment; filename="${profile.slug}.vcf"`)
    .send(generateVCard(profile));
});

v1Router.get("/connections", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const result = await pool.query(
    "SELECT * FROM connections WHERE owner_user_id = $1 ORDER BY created_at DESC",
    [user.id]
  );

  res.json(ok(result.rows.map(mapConnection)));
});

v1Router.post("/connections", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const input = connectionInputSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(fail("Invalid connection details."));
    return;
  }

  const profileResult = await pool.query(
    "SELECT * FROM profiles WHERE id = $1 AND is_published = true",
    [input.data.connectedProfileId]
  );

  const profile = profileResult.rows[0];
  if (!profile) {
    res.status(404).json(fail("Profile not found."));
    return;
  }

  if (profile.user_id === user.id) {
    res.status(400).json(fail("You cannot add your own profile to your network."));
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO connections (
        owner_user_id, connected_profile_id, source, full_name, headline,
        company, email, phone, website_url, linkedin_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        user.id,
        profile.id,
        input.data.source,
        profile.full_name,
        profile.headline,
        profile.company,
        profile.email,
        profile.phone,
        profile.website_url,
        profile.linkedin_url
      ]
    );

    await pool.query(
      "INSERT INTO analytics_events (profile_id, event_type) VALUES ($1, 'connection_added')",
      [profile.id]
    );

    res.status(201).json(ok(mapConnection(result.rows[0])));
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json(fail("This profile is already in your network."));
      return;
    }
    res.status(500).json(fail("Could not add connection."));
  }
});

v1Router.delete("/connections/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const result = await pool.query(
    "DELETE FROM connections WHERE id = $1 AND owner_user_id = $2 RETURNING id",
    [req.params.id, user.id]
  );

  if (result.rowCount === 0) {
    res.status(404).json(fail("Connection not found."));
    return;
  }

  res.json(ok({ id: result.rows[0].id }));
});

v1Router.get("/connections/:id/relationship", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const connection = await getOwnedConnection(req.params.id, user.id);
  if (!connection) {
    res.status(404).json(fail("Connection not found."));
    return;
  }

  const [notesResult, tagsResult, followUpsResult] = await Promise.all([
    pool.query(
      "SELECT * FROM connection_notes WHERE connection_id = $1 AND owner_user_id = $2 ORDER BY created_at DESC",
      [req.params.id, user.id]
    ),
    pool.query(
      `SELECT t.*
      FROM tags t
      JOIN connection_tags ct ON ct.tag_id = t.id
      WHERE ct.connection_id = $1 AND ct.owner_user_id = $2
      ORDER BY t.name ASC`,
      [req.params.id, user.id]
    ),
    pool.query(
      "SELECT * FROM follow_ups WHERE connection_id = $1 AND owner_user_id = $2 ORDER BY completed_at NULLS FIRST, due_at ASC",
      [req.params.id, user.id]
    )
  ]);

  res.json(
    ok({
      connection: mapConnection(connection),
      notes: notesResult.rows.map(mapConnectionNote),
      tags: tagsResult.rows.map(mapTag),
      followUps: followUpsResult.rows.map(mapFollowUp)
    })
  );
});

v1Router.put("/connections/:id/relationship", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const input = relationshipStatusSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(fail("Invalid relationship status."));
    return;
  }

  const result = await pool.query(
    "UPDATE connections SET relationship_status = $1 WHERE id = $2 AND owner_user_id = $3 RETURNING *",
    [input.data.relationshipStatus, req.params.id, user.id]
  );

  if (result.rowCount === 0) {
    res.status(404).json(fail("Connection not found."));
    return;
  }

  res.json(ok(mapConnection(result.rows[0])));
});

v1Router.get("/connections/:id/notes", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const connection = await getOwnedConnection(req.params.id, user.id);
  if (!connection) {
    res.status(404).json(fail("Connection not found."));
    return;
  }

  const result = await pool.query(
    "SELECT * FROM connection_notes WHERE connection_id = $1 AND owner_user_id = $2 ORDER BY created_at DESC",
    [req.params.id, user.id]
  );

  res.json(ok(result.rows.map(mapConnectionNote)));
});

v1Router.post("/connections/:id/notes", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const input = connectionNoteInputSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(fail("Invalid note."));
    return;
  }

  const connection = await getOwnedConnection(req.params.id, user.id);
  if (!connection) {
    res.status(404).json(fail("Connection not found."));
    return;
  }

  const result = await pool.query(
    "INSERT INTO connection_notes (connection_id, owner_user_id, body) VALUES ($1, $2, $3) RETURNING *",
    [req.params.id, user.id, input.data.body]
  );

  res.status(201).json(ok(mapConnectionNote(result.rows[0])));
});

v1Router.delete("/connections/:id/notes/:noteId", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const result = await pool.query(
    `DELETE FROM connection_notes
    WHERE id = $1 AND connection_id = $2 AND owner_user_id = $3
    RETURNING id`,
    [req.params.noteId, req.params.id, user.id]
  );

  if (result.rowCount === 0) {
    res.status(404).json(fail("Note not found."));
    return;
  }

  res.json(ok({ id: result.rows[0].id }));
});

v1Router.get("/tags", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const result = await pool.query(
    "SELECT * FROM tags WHERE owner_user_id = $1 ORDER BY name ASC",
    [user.id]
  );

  res.json(ok(result.rows.map(mapTag)));
});

v1Router.post("/tags", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const input = tagInputSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(fail("Invalid tag."));
    return;
  }

  try {
    const result = await pool.query(
      "INSERT INTO tags (owner_user_id, name, color) VALUES ($1, $2, $3) RETURNING *",
      [user.id, input.data.name, input.data.color]
    );

    res.status(201).json(ok(mapTag(result.rows[0])));
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json(fail("A tag with this name already exists."));
      return;
    }
    res.status(500).json(fail("Could not create tag."));
  }
});

v1Router.delete("/tags/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const result = await pool.query(
    "DELETE FROM tags WHERE id = $1 AND owner_user_id = $2 RETURNING id",
    [req.params.id, user.id]
  );

  if (result.rowCount === 0) {
    res.status(404).json(fail("Tag not found."));
    return;
  }

  res.json(ok({ id: result.rows[0].id }));
});

v1Router.put("/connections/:id/tags", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const input = connectionTagsInputSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(fail("Invalid tag list."));
    return;
  }

  const connection = await getOwnedConnection(req.params.id, user.id);
  if (!connection) {
    res.status(404).json(fail("Connection not found."));
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      "DELETE FROM connection_tags WHERE connection_id = $1 AND owner_user_id = $2",
      [req.params.id, user.id]
    );

    if (input.data.tagIds.length > 0) {
      const ownedTags = await client.query(
        "SELECT id FROM tags WHERE owner_user_id = $1 AND id = ANY($2::uuid[])",
        [user.id, input.data.tagIds]
      );

      if (ownedTags.rowCount !== input.data.tagIds.length) {
        await client.query("ROLLBACK");
        res.status(400).json(fail("One or more tags were not found."));
        return;
      }

      for (const tagId of input.data.tagIds) {
        await client.query(
          "INSERT INTO connection_tags (connection_id, tag_id, owner_user_id) VALUES ($1, $2, $3)",
          [req.params.id, tagId, user.id]
        );
      }
    }

    const result = await client.query(
      `SELECT t.*
      FROM tags t
      JOIN connection_tags ct ON ct.tag_id = t.id
      WHERE ct.connection_id = $1 AND ct.owner_user_id = $2
      ORDER BY t.name ASC`,
      [req.params.id, user.id]
    );

    await client.query("COMMIT");
    res.json(ok(result.rows.map(mapTag)));
  } catch {
    await client.query("ROLLBACK");
    res.status(500).json(fail("Could not update connection tags."));
  } finally {
    client.release();
  }
});

v1Router.get("/connections/:id/follow-ups", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const connection = await getOwnedConnection(req.params.id, user.id);
  if (!connection) {
    res.status(404).json(fail("Connection not found."));
    return;
  }

  const result = await pool.query(
    "SELECT * FROM follow_ups WHERE connection_id = $1 AND owner_user_id = $2 ORDER BY completed_at NULLS FIRST, due_at ASC",
    [req.params.id, user.id]
  );

  res.json(ok(result.rows.map(mapFollowUp)));
});

v1Router.post("/connections/:id/follow-ups", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const input = followUpInputSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(fail("Invalid follow-up."));
    return;
  }

  const connection = await getOwnedConnection(req.params.id, user.id);
  if (!connection) {
    res.status(404).json(fail("Connection not found."));
    return;
  }

  const result = await pool.query(
    "INSERT INTO follow_ups (connection_id, owner_user_id, title, due_at) VALUES ($1, $2, $3, $4) RETURNING *",
    [req.params.id, user.id, input.data.title, input.data.dueAt]
  );

  res.status(201).json(ok(mapFollowUp(result.rows[0])));
});

v1Router.patch("/connections/:id/follow-ups/:followUpId", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const input = followUpUpdateSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(fail("Invalid follow-up update."));
    return;
  }

  const result = await pool.query(
    `UPDATE follow_ups
    SET
      title = COALESCE($1, title),
      due_at = COALESCE($2, due_at),
      completed_at = CASE
        WHEN $3::boolean IS TRUE THEN now()
        WHEN $3::boolean IS FALSE THEN NULL
        ELSE completed_at
      END
    WHERE id = $4 AND connection_id = $5 AND owner_user_id = $6
    RETURNING *`,
    [
      input.data.title ?? null,
      input.data.dueAt ?? null,
      input.data.completed ?? null,
      req.params.followUpId,
      req.params.id,
      user.id
    ]
  );

  if (result.rowCount === 0) {
    res.status(404).json(fail("Follow-up not found."));
    return;
  }

  res.json(ok(mapFollowUp(result.rows[0])));
});

v1Router.delete("/connections/:id/follow-ups/:followUpId", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const result = await pool.query(
    `DELETE FROM follow_ups
    WHERE id = $1 AND connection_id = $2 AND owner_user_id = $3
    RETURNING id`,
    [req.params.followUpId, req.params.id, user.id]
  );

  if (result.rowCount === 0) {
    res.status(404).json(fail("Follow-up not found."));
    return;
  }

  res.json(ok({ id: result.rows[0].id }));
});

v1Router.get("/network/summary", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const result = await pool.query(
    `WITH my_profile AS (
      SELECT id
      FROM profiles
      WHERE user_id = $1
    ),
    saved_by_me AS (
      SELECT count(*)::int AS count
      FROM connections
      WHERE owner_user_id = $1
    ),
    saved_me AS (
      SELECT count(*)::int AS count
      FROM connections c
      JOIN my_profile mp ON mp.id = c.connected_profile_id
    ),
    mutual AS (
      SELECT count(*)::int AS count
      FROM connections mine
      JOIN profiles target ON target.id = mine.connected_profile_id
      JOIN my_profile mp ON true
      JOIN connections reciprocal
        ON reciprocal.owner_user_id = target.user_id
        AND reciprocal.connected_profile_id = mp.id
      WHERE mine.owner_user_id = $1
    ),
    discoverable AS (
      SELECT count(*)::int AS count
      FROM profiles
      WHERE is_published = true
        AND user_id <> $1
    )
    SELECT
      (SELECT count FROM saved_by_me) AS saved_by_me,
      (SELECT count FROM saved_me) AS saved_me,
      (SELECT count FROM mutual) AS mutual_connections,
      (SELECT count FROM discoverable) AS discoverable_profiles`,
    [user.id]
  );

  const row = result.rows[0];
  res.json(
    ok({
      savedByMe: row.saved_by_me,
      savedMe: row.saved_me,
      mutualConnections: row.mutual_connections,
      discoverableProfiles: row.discoverable_profiles
    })
  );
});

v1Router.get("/network/inbound", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const result = await pool.query(
    `WITH my_profile AS (
      SELECT id
      FROM profiles
      WHERE user_id = $1
    )
    SELECT
      saver.*,
      CASE
        WHEN mine.id IS NOT NULL THEN 'mutual'
        ELSE 'saved_me'
      END AS connection_status,
      inbound.created_at AS connected_at
    FROM connections inbound
    JOIN my_profile mp ON mp.id = inbound.connected_profile_id
    JOIN profiles saver ON saver.user_id = inbound.owner_user_id
    LEFT JOIN connections mine
      ON mine.owner_user_id = $1
      AND mine.connected_profile_id = saver.id
    WHERE saver.is_published = true
    ORDER BY inbound.created_at DESC`,
    [user.id]
  );

  res.json(ok(result.rows.map(mapNetworkProfile)));
});

v1Router.get("/network/mutual", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const result = await pool.query(
    `WITH my_profile AS (
      SELECT id
      FROM profiles
      WHERE user_id = $1
    )
    SELECT
      target.*,
      'mutual' AS connection_status,
      mine.created_at AS connected_at
    FROM connections mine
    JOIN profiles target ON target.id = mine.connected_profile_id
    JOIN my_profile mp ON true
    JOIN connections reciprocal
      ON reciprocal.owner_user_id = target.user_id
      AND reciprocal.connected_profile_id = mp.id
    WHERE mine.owner_user_id = $1
      AND target.is_published = true
    ORDER BY mine.created_at DESC`,
    [user.id]
  );

  res.json(ok(result.rows.map(mapNetworkProfile)));
});

v1Router.get("/crm/summary", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const [lifecycleResult, followUpsResult] = await Promise.all([
    pool.query(
      `SELECT lifecycle_stage, count(*)::int AS count
      FROM connections
      WHERE owner_user_id = $1
      GROUP BY lifecycle_stage`,
      [user.id]
    ),
    pool.query(
      `SELECT
        count(*) FILTER (WHERE completed_at IS NULL)::int AS open_follow_ups,
        count(*) FILTER (WHERE completed_at IS NULL AND due_at < now())::int AS overdue_follow_ups
      FROM follow_ups
      WHERE owner_user_id = $1`,
      [user.id]
    )
  ]);

  const lifecycle = {
    new: 0,
    contacted: 0,
    meeting: 0,
    proposal: 0,
    won: 0,
    lost: 0
  };

  for (const row of lifecycleResult.rows) {
    lifecycle[row.lifecycle_stage as keyof typeof lifecycle] = row.count;
  }

  const highPriority = lifecycleResult.rows.reduce((count, _row) => count, 0);
  const priorityResult = await pool.query(
    "SELECT count(*)::int AS count FROM connections WHERE owner_user_id = $1 AND priority = 'high'",
    [user.id]
  );

  res.json(ok({
    lifecycle,
    highPriority: priorityResult.rows[0]?.count ?? highPriority,
    openFollowUps: followUpsResult.rows[0]?.open_follow_ups ?? 0,
    overdueFollowUps: followUpsResult.rows[0]?.overdue_follow_ups ?? 0
  }));
});

v1Router.get("/connections/:id/crm", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const connection = await getOwnedConnection(req.params.id, user.id);
  if (!connection) {
    res.status(404).json(fail("Connection not found."));
    return;
  }

  const activitiesResult = await pool.query(
    "SELECT * FROM connection_activities WHERE connection_id = $1 AND owner_user_id = $2 ORDER BY occurred_at DESC, created_at DESC",
    [req.params.id, user.id]
  );

  res.json(ok({
    connection: mapConnection(connection),
    activities: activitiesResult.rows.map(mapConnectionActivity)
  }));
});

v1Router.put("/connections/:id/crm", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const input = crmInputSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(fail("Invalid CRM details."));
    return;
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  const addField = (column: string, value: unknown) => {
    values.push(value);
    fields.push(`${column} = $${values.length}`);
  };

  if (input.data.lifecycleStage !== undefined) addField("lifecycle_stage", input.data.lifecycleStage);
  if (input.data.priority !== undefined) addField("priority", input.data.priority);
  if (input.data.nextStep !== undefined) addField("next_step", input.data.nextStep);
  if (input.data.lastContactedAt !== undefined) addField("last_contacted_at", input.data.lastContactedAt);

  values.push(req.params.id, user.id);
  const result = await pool.query(
    `UPDATE connections
    SET ${fields.join(", ")}
    WHERE id = $${values.length - 1} AND owner_user_id = $${values.length}
    RETURNING *`,
    values
  );

  if (result.rowCount === 0) {
    res.status(404).json(fail("Connection not found."));
    return;
  }

  res.json(ok(mapConnection(result.rows[0])));
});

v1Router.get("/connections/:id/activities", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const connection = await getOwnedConnection(req.params.id, user.id);
  if (!connection) {
    res.status(404).json(fail("Connection not found."));
    return;
  }

  const result = await pool.query(
    "SELECT * FROM connection_activities WHERE connection_id = $1 AND owner_user_id = $2 ORDER BY occurred_at DESC, created_at DESC",
    [req.params.id, user.id]
  );

  res.json(ok(result.rows.map(mapConnectionActivity)));
});

v1Router.post("/connections/:id/activities", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const input = activityInputSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(fail("Invalid activity details."));
    return;
  }

  const connection = await getOwnedConnection(req.params.id, user.id);
  if (!connection) {
    res.status(404).json(fail("Connection not found."));
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO connection_activities (
        connection_id,
        owner_user_id,
        activity_type,
        title,
        body,
        occurred_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        req.params.id,
        user.id,
        input.data.activityType,
        input.data.title,
        input.data.body ?? null,
        input.data.occurredAt ?? new Date().toISOString()
      ]
    );

    if (["call", "email", "meeting"].includes(input.data.activityType)) {
      await client.query(
        "UPDATE connections SET last_contacted_at = $1 WHERE id = $2 AND owner_user_id = $3",
        [input.data.occurredAt ?? new Date().toISOString(), req.params.id, user.id]
      );
    }

    await client.query("COMMIT");
    res.status(201).json(ok(mapConnectionActivity(result.rows[0])));
  } catch {
    await client.query("ROLLBACK");
    res.status(500).json(fail("Could not create activity."));
  } finally {
    client.release();
  }
});

v1Router.delete("/connections/:id/activities/:activityId", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const result = await pool.query(
    `DELETE FROM connection_activities
    WHERE id = $1 AND connection_id = $2 AND owner_user_id = $3
    RETURNING id`,
    [req.params.activityId, req.params.id, user.id]
  );

  if (result.rowCount === 0) {
    res.status(404).json(fail("Activity not found."));
    return;
  }

  res.json(ok({ deleted: true }));
});

v1Router.get("/scheduling/google/connect", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const config = getGoogleCalendarConfig();
  if (!config) {
    res.status(503).json(fail("Google Calendar integration is not configured."));
    return;
  }

  res.redirect(buildGoogleAuthorizationUrl(user, config));
});

v1Router.post("/scheduling/google/connect", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const config = getGoogleCalendarConfig();
  if (!config) {
    res.status(503).json(fail("Google Calendar integration is not configured."));
    return;
  }

  res.json(ok({ authorizationUrl: buildGoogleAuthorizationUrl(user, config) }));
});

v1Router.get("/scheduling/google/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;
  const oauthError = typeof req.query.error === "string" ? req.query.error : null;

  if (oauthError) {
    redirectToCalendarSettings(res, { error: "google_oauth_denied" });
    return;
  }

  const config = getGoogleCalendarConfig();
  if (!config || !code || !state) {
    redirectToCalendarSettings(res, { error: "google_oauth_invalid_request" });
    return;
  }

  const oauthState = verifyGoogleOAuthState(state);
  if (!oauthState) {
    redirectToCalendarSettings(res, { error: "google_oauth_invalid_state" });
    return;
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: config.redirectUri
      })
    });
    const tokenJson = await tokenResponse.json() as GoogleTokenResponse;

    if (!tokenResponse.ok || !tokenJson.access_token) {
      redirectToCalendarSettings(res, { error: "google_token_exchange_failed" });
      return;
    }

    const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` }
    });
    const userInfo = await userInfoResponse.json() as GoogleUserInfoResponse;

    if (!userInfoResponse.ok || !userInfo.email) {
      redirectToCalendarSettings(res, { error: "google_account_lookup_failed" });
      return;
    }

    const existingResult = await pool.query(
      "SELECT refresh_token_encrypted FROM calendar_accounts WHERE owner_user_id = $1 AND provider = 'google' LIMIT 1",
      [oauthState.sub]
    );
    const existingRefreshToken = existingResult.rows[0]?.refresh_token_encrypted ?? null;
    const encryptedAccessToken = encryptCalendarToken(tokenJson.access_token, config.encryptionKey);
    const encryptedRefreshToken = tokenJson.refresh_token
      ? encryptCalendarToken(tokenJson.refresh_token, config.encryptionKey)
      : existingRefreshToken;
    const tokenExpiresAt = tokenJson.expires_in
      ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
      : null;

    await pool.query(
      `INSERT INTO calendar_accounts (
        owner_user_id,
        provider,
        provider_account_id,
        email,
        calendar_id,
        access_token_encrypted,
        refresh_token_encrypted,
        token_expires_at,
        scopes,
        is_connected
      )
      VALUES ($1, 'google', $2, $3, 'primary', $4, $5, $6, $7, true)
      ON CONFLICT (owner_user_id, provider)
      DO UPDATE SET
        provider_account_id = EXCLUDED.provider_account_id,
        email = EXCLUDED.email,
        calendar_id = EXCLUDED.calendar_id,
        access_token_encrypted = EXCLUDED.access_token_encrypted,
        refresh_token_encrypted = COALESCE(EXCLUDED.refresh_token_encrypted, calendar_accounts.refresh_token_encrypted),
        token_expires_at = EXCLUDED.token_expires_at,
        scopes = EXCLUDED.scopes,
        is_connected = true
      RETURNING *`,
      [
        oauthState.sub,
        userInfo.id ?? userInfo.email,
        userInfo.email,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt,
        tokenJson.scope ?? null
      ]
    );

    redirectToCalendarSettings(res, { connected: "google" });
  } catch {
    redirectToCalendarSettings(res, { error: "google_oauth_failed" });
  }
});

v1Router.get("/scheduling/zoho/connect", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const config = getZohoCalendarConfig();
  if (!config) {
    res.status(503).json(fail("Zoho Calendar integration is not configured."));
    return;
  }

  res.redirect(buildZohoAuthorizationUrl(user, config));
});

v1Router.post("/scheduling/zoho/connect", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const config = getZohoCalendarConfig();
  if (!config) {
    res.status(503).json(fail("Zoho Calendar integration is not configured."));
    return;
  }

  res.json(ok({ authorizationUrl: buildZohoAuthorizationUrl(user, config) }));
});

v1Router.get("/scheduling/zoho/callback", async (req, res) => {
  const code = typeof req.query.code === "string" ? req.query.code : null;
  const state = typeof req.query.state === "string" ? req.query.state : null;
  const oauthError = typeof req.query.error === "string" ? req.query.error : null;

  if (oauthError) {
    redirectToCalendarSettings(res, { error: "zoho_oauth_denied" });
    return;
  }

  const config = getZohoCalendarConfig();
  if (!config || !code || !state) {
    redirectToCalendarSettings(res, { error: "zoho_oauth_invalid_request" });
    return;
  }

  const oauthState = verifyZohoOAuthState(state);
  if (!oauthState) {
    redirectToCalendarSettings(res, { error: "zoho_oauth_invalid_state" });
    return;
  }

  try {
    const tokenResponse = await fetch(new URL("/oauth/v2/token", config.accountsBaseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: config.redirectUri
      })
    });
    const tokenJson = await tokenResponse.json() as ZohoTokenResponse;

    if (!tokenResponse.ok || !tokenJson.access_token) {
      redirectToCalendarSettings(res, { error: "zoho_token_exchange_failed" });
      return;
    }

    const userInfoResponse = await fetch(new URL("/oauth/user/info", config.accountsBaseUrl), {
      headers: { Authorization: `Zoho-oauthtoken ${tokenJson.access_token}` }
    });
    const userInfo = await userInfoResponse.json() as ZohoUserInfoResponse;
    const email = userInfo.Email ?? userInfo.email ?? null;

    if (!userInfoResponse.ok || !email) {
      redirectToCalendarSettings(res, { error: "zoho_account_lookup_failed" });
      return;
    }

    const existingResult = await pool.query(
      "SELECT refresh_token_encrypted FROM calendar_accounts WHERE owner_user_id = $1 AND provider = 'zoho' LIMIT 1",
      [oauthState.sub]
    );
    const existingRefreshToken = existingResult.rows[0]?.refresh_token_encrypted ?? null;
    const encryptedAccessToken = encryptCalendarToken(tokenJson.access_token, config.encryptionKey);
    const encryptedRefreshToken = tokenJson.refresh_token
      ? encryptCalendarToken(tokenJson.refresh_token, config.encryptionKey)
      : existingRefreshToken;
    const tokenExpiresAt = tokenJson.expires_in
      ? new Date(Date.now() + tokenJson.expires_in * 1000).toISOString()
      : null;

    await pool.query(
      `INSERT INTO calendar_accounts (
        owner_user_id,
        provider,
        provider_account_id,
        email,
        calendar_id,
        access_token_encrypted,
        refresh_token_encrypted,
        token_expires_at,
        scopes,
        is_connected
      )
      VALUES ($1, 'zoho', $2, $3, 'primary', $4, $5, $6, $7, true)
      ON CONFLICT (owner_user_id, provider)
      DO UPDATE SET
        provider_account_id = EXCLUDED.provider_account_id,
        email = EXCLUDED.email,
        calendar_id = EXCLUDED.calendar_id,
        access_token_encrypted = EXCLUDED.access_token_encrypted,
        refresh_token_encrypted = COALESCE(EXCLUDED.refresh_token_encrypted, calendar_accounts.refresh_token_encrypted),
        token_expires_at = EXCLUDED.token_expires_at,
        scopes = EXCLUDED.scopes,
        is_connected = true
      RETURNING *`,
      [
        oauthState.sub,
        userInfo.ZUID ?? email,
        email,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt,
        tokenJson.scope ?? config.scopes
      ]
    );

    redirectToCalendarSettings(res, { connected: "zoho" });
  } catch {
    redirectToCalendarSettings(res, { error: "zoho_oauth_failed" });
  }
});

v1Router.get("/scheduling/calendar-accounts", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const result = await pool.query(
    "SELECT * FROM calendar_accounts WHERE owner_user_id = $1 ORDER BY created_at DESC",
    [user.id]
  );

  res.json(ok(result.rows.map(mapCalendarAccount)));
});

v1Router.delete("/scheduling/calendar-accounts/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const result = await pool.query(
    `UPDATE calendar_accounts
    SET
      access_token_encrypted = NULL,
      refresh_token_encrypted = NULL,
      token_expires_at = NULL,
      is_connected = false
    WHERE id = $1 AND owner_user_id = $2
    RETURNING *`,
    [req.params.id, user.id]
  );

  if (result.rowCount === 0) {
    res.status(404).json(fail("Calendar account not found."));
    return;
  }

  res.json(ok(mapCalendarAccount(result.rows[0])));
});

v1Router.get("/scheduling/meeting-types", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const result = await pool.query(
    "SELECT * FROM meeting_types WHERE owner_user_id = $1 ORDER BY created_at DESC",
    [user.id]
  );

  res.json(ok(result.rows.map(mapMeetingType)));
});

v1Router.post("/scheduling/meeting-types", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const input = meetingTypeInputSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(fail("Invalid meeting type details."));
    return;
  }

  const slug = input.data.slug ?? slugify(input.data.title);

  try {
    let result = await pool.query(
      `INSERT INTO meeting_types (
        owner_user_id,
        slug,
        title,
        description,
        duration_minutes,
        location_type,
        location_value,
        buffer_before_minutes,
        buffer_after_minutes,
        min_notice_minutes,
        booking_window_days,
        requires_approval,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        user.id,
        slug,
        input.data.title,
        input.data.description ?? null,
        input.data.durationMinutes,
        input.data.locationType,
        input.data.locationValue ?? null,
        input.data.bufferBeforeMinutes,
        input.data.bufferAfterMinutes,
        input.data.minNoticeMinutes,
        input.data.bookingWindowDays,
        input.data.requiresApproval,
        input.data.isActive
      ]
    );

    if (input.data.maxBookingsPerDay !== undefined && await hasMeetingTypesMaxBookingsColumn()) {
      result = await pool.query(
        "UPDATE meeting_types SET max_bookings_per_day = $1 WHERE id = $2 AND owner_user_id = $3 RETURNING *",
        [input.data.maxBookingsPerDay, result.rows[0].id, user.id]
      );
    }

    res.status(201).json(ok(mapMeetingType(result.rows[0])));
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json(fail("A meeting type with this slug already exists."));
      return;
    }
    res.status(500).json(fail("Could not create meeting type."));
  }
});

v1Router.put("/scheduling/meeting-types/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const input = meetingTypeUpdateSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(fail("Invalid meeting type details."));
    return;
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  const addField = (column: string, value: unknown) => {
    values.push(value);
    fields.push(`${column} = $${values.length}`);
  };

  if (input.data.slug !== undefined) addField("slug", input.data.slug);
  if (input.data.title !== undefined) addField("title", input.data.title);
  if (input.data.description !== undefined) addField("description", input.data.description);
  if (input.data.durationMinutes !== undefined) addField("duration_minutes", input.data.durationMinutes);
  if (input.data.locationType !== undefined) addField("location_type", input.data.locationType);
  if (input.data.locationValue !== undefined) addField("location_value", input.data.locationValue);
  if (input.data.bufferBeforeMinutes !== undefined) addField("buffer_before_minutes", input.data.bufferBeforeMinutes);
  if (input.data.bufferAfterMinutes !== undefined) addField("buffer_after_minutes", input.data.bufferAfterMinutes);
  if (input.data.minNoticeMinutes !== undefined) addField("min_notice_minutes", input.data.minNoticeMinutes);
  if (input.data.bookingWindowDays !== undefined) addField("booking_window_days", input.data.bookingWindowDays);
  if (input.data.maxBookingsPerDay !== undefined && await hasMeetingTypesMaxBookingsColumn()) {
    addField("max_bookings_per_day", input.data.maxBookingsPerDay);
  }
  if (input.data.requiresApproval !== undefined) addField("requires_approval", input.data.requiresApproval);
  if (input.data.isActive !== undefined) addField("is_active", input.data.isActive);

  if (fields.length === 0) {
    const result = await pool.query(
      "SELECT * FROM meeting_types WHERE id = $1 AND owner_user_id = $2",
      [req.params.id, user.id]
    );
    if (result.rowCount === 0) {
      res.status(404).json(fail("Meeting type not found."));
      return;
    }
    res.json(ok(mapMeetingType(result.rows[0])));
    return;
  }

  values.push(req.params.id, user.id);

  try {
    const result = await pool.query(
      `UPDATE meeting_types
      SET ${fields.join(", ")}
      WHERE id = $${values.length - 1} AND owner_user_id = $${values.length}
      RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      res.status(404).json(fail("Meeting type not found."));
      return;
    }

    res.json(ok(mapMeetingType(result.rows[0])));
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json(fail("A meeting type with this slug already exists."));
      return;
    }
    res.status(500).json(fail("Could not update meeting type."));
  }
});

v1Router.delete("/scheduling/meeting-types/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const result = await pool.query(
    "DELETE FROM meeting_types WHERE id = $1 AND owner_user_id = $2 RETURNING id",
    [req.params.id, user.id]
  );

  if (result.rowCount === 0) {
    res.status(404).json(fail("Meeting type not found."));
    return;
  }

  res.json(ok({ deleted: true }));
});

v1Router.get("/scheduling/availability", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const [rulesResult, exceptionsResult] = await Promise.all([
    pool.query(
      "SELECT * FROM availability_rules WHERE owner_user_id = $1 ORDER BY day_of_week ASC, start_time ASC",
      [user.id]
    ),
    pool.query(
      "SELECT * FROM availability_exceptions WHERE owner_user_id = $1 ORDER BY exception_date ASC, start_time ASC",
      [user.id]
    )
  ]);

  res.json(ok({
    rules: rulesResult.rows.map(mapAvailabilityRule),
    exceptions: exceptionsResult.rows.map(mapAvailabilityException)
  }));
});

v1Router.put("/scheduling/availability", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const input = availabilityInputSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(fail("Invalid availability details."));
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM availability_rules WHERE owner_user_id = $1", [user.id]);
    await client.query("DELETE FROM availability_exceptions WHERE owner_user_id = $1", [user.id]);

    for (const rule of input.data.rules) {
      await client.query(
        `INSERT INTO availability_rules (
          owner_user_id,
          day_of_week,
          start_time,
          end_time,
          timezone,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6)`,
        [user.id, rule.dayOfWeek, rule.startTime, rule.endTime, rule.timezone, rule.isActive]
      );
    }

    for (const exception of input.data.exceptions) {
      await client.query(
        `INSERT INTO availability_exceptions (
          owner_user_id,
          exception_date,
          start_time,
          end_time,
          timezone,
          is_available,
          reason
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          user.id,
          exception.exceptionDate,
          exception.startTime ?? null,
          exception.endTime ?? null,
          exception.timezone,
          exception.isAvailable,
          exception.reason ?? null
        ]
      );
    }

    const [rulesResult, exceptionsResult] = await Promise.all([
      client.query(
        "SELECT * FROM availability_rules WHERE owner_user_id = $1 ORDER BY day_of_week ASC, start_time ASC",
        [user.id]
      ),
      client.query(
        "SELECT * FROM availability_exceptions WHERE owner_user_id = $1 ORDER BY exception_date ASC, start_time ASC",
        [user.id]
      )
    ]);

    await client.query("COMMIT");
    res.json(ok({
      rules: rulesResult.rows.map(mapAvailabilityRule),
      exceptions: exceptionsResult.rows.map(mapAvailabilityException)
    }));
  } catch {
    await client.query("ROLLBACK");
    res.status(500).json(fail("Could not update availability."));
  } finally {
    client.release();
  }
});

v1Router.get("/scheduling/bookings", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const result = await pool.query(
    `SELECT
      b.*,
      mt.slug AS meeting_type_slug,
      mt.title AS meeting_type_title,
      mt.description AS meeting_type_description,
      mt.duration_minutes AS meeting_type_duration_minutes,
      mt.location_type AS meeting_type_location_type,
      mt.location_value AS meeting_type_location_value,
      mt.buffer_before_minutes AS meeting_type_buffer_before_minutes,
      mt.buffer_after_minutes AS meeting_type_buffer_after_minutes,
      mt.min_notice_minutes AS meeting_type_min_notice_minutes,
      mt.booking_window_days AS meeting_type_booking_window_days,
      mt.is_active AS meeting_type_is_active,
      mt.requires_approval AS meeting_type_requires_approval,
      mt.created_at AS meeting_type_created_at,
      mt.updated_at AS meeting_type_updated_at,
      bg.id AS guest_id,
      bg.name AS guest_name,
      bg.email AS guest_email,
      bg.company AS guest_company,
      bg.message AS guest_message,
      bg.created_at AS guest_created_at
    FROM bookings b
    JOIN meeting_types mt ON mt.id = b.meeting_type_id
    JOIN booking_guests bg ON bg.id = b.guest_id
    WHERE b.owner_user_id = $1
    ORDER BY b.start_at DESC`,
    [user.id]
  );

  res.json(ok(result.rows.map(mapBooking)));
});

v1Router.get("/scheduling/bookings/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const result = await pool.query(
    `SELECT
      b.*,
      mt.slug AS meeting_type_slug,
      mt.title AS meeting_type_title,
      mt.description AS meeting_type_description,
      mt.duration_minutes AS meeting_type_duration_minutes,
      mt.location_type AS meeting_type_location_type,
      mt.location_value AS meeting_type_location_value,
      mt.buffer_before_minutes AS meeting_type_buffer_before_minutes,
      mt.buffer_after_minutes AS meeting_type_buffer_after_minutes,
      mt.min_notice_minutes AS meeting_type_min_notice_minutes,
      mt.booking_window_days AS meeting_type_booking_window_days,
      mt.is_active AS meeting_type_is_active,
      mt.requires_approval AS meeting_type_requires_approval,
      mt.created_at AS meeting_type_created_at,
      mt.updated_at AS meeting_type_updated_at,
      bg.id AS guest_id,
      bg.name AS guest_name,
      bg.email AS guest_email,
      bg.company AS guest_company,
      bg.message AS guest_message,
      bg.created_at AS guest_created_at
    FROM bookings b
    JOIN meeting_types mt ON mt.id = b.meeting_type_id
    JOIN booking_guests bg ON bg.id = b.guest_id
    WHERE b.id = $1 AND b.owner_user_id = $2`,
    [req.params.id, user.id]
  );

  if (result.rowCount === 0) {
    res.status(404).json(fail("Booking not found."));
    return;
  }

  res.json(ok(mapBooking(result.rows[0])));
});

v1Router.post("/scheduling/bookings/:id/cancel", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const input = bookingStatusUpdateSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(fail("Invalid cancellation details."));
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE bookings
      SET status = 'cancelled', cancellation_reason = $1
      WHERE id = $2 AND owner_user_id = $3
      RETURNING *`,
      [input.data.reason ?? null, req.params.id, user.id]
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      res.status(404).json(fail("Booking not found."));
      return;
    }

    await client.query(
      "INSERT INTO booking_audit_events (booking_id, owner_user_id, event_type, metadata) VALUES ($1, $2, 'cancelled', $3)",
      [req.params.id, user.id, JSON.stringify({ reason: input.data.reason ?? null })]
    );
    await client.query("COMMIT");
    const profileResult = await pool.query("SELECT id FROM profiles WHERE user_id = $1", [user.id]);
    if (profileResult.rows[0]?.id) {
      await insertAnalyticsEvent(profileResult.rows[0].id, "booking_cancelled", req);
    }
    res.json(ok(mapBooking(result.rows[0])));
  } catch {
    await client.query("ROLLBACK");
    res.status(500).json(fail("Could not cancel booking."));
  } finally {
    client.release();
  }
});

v1Router.post("/scheduling/bookings/:id/reschedule", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const input = bookingRescheduleSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(fail("Invalid reschedule details."));
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const currentResult = await client.query(
      "SELECT * FROM bookings WHERE id = $1 AND owner_user_id = $2",
      [req.params.id, user.id]
    );

    if (currentResult.rowCount === 0) {
      await client.query("ROLLBACK");
      res.status(404).json(fail("Booking not found."));
      return;
    }

    const current = currentResult.rows[0];
    await client.query(
      "UPDATE bookings SET status = 'rescheduled' WHERE id = $1 AND owner_user_id = $2",
      [req.params.id, user.id]
    );

    const newResult = await client.query(
      `INSERT INTO bookings (
        owner_user_id,
        meeting_type_id,
        guest_id,
        connection_id,
        event_id,
        source,
        status,
        start_at,
        end_at,
        timezone,
        rescheduled_from_booking_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', $7, $8, $9, $10)
      RETURNING *`,
      [
        user.id,
        current.meeting_type_id,
        current.guest_id,
        current.connection_id,
        current.event_id,
        current.source,
        input.data.startAt,
        input.data.endAt,
        input.data.timezone,
        current.id
      ]
    );

    await client.query(
      "INSERT INTO booking_audit_events (booking_id, owner_user_id, event_type, metadata) VALUES ($1, $2, 'rescheduled', $3)",
      [newResult.rows[0].id, user.id, JSON.stringify({ fromBookingId: current.id })]
    );
    await client.query("COMMIT");
    const profileResult = await pool.query("SELECT id FROM profiles WHERE user_id = $1", [user.id]);
    if (profileResult.rows[0]?.id) {
      await insertAnalyticsEvent(profileResult.rows[0].id, "booking_rescheduled", req);
    }
    res.status(201).json(ok(mapBooking(newResult.rows[0])));
  } catch {
    await client.query("ROLLBACK");
    res.status(500).json(fail("Could not reschedule booking."));
  } finally {
    client.release();
  }
});

v1Router.get("/book/:profileSlug", async (req, res) => {
  const context = await getPublicBookingContext(req.params.profileSlug);
  if (!context) {
    res.status(404).json(fail("Booking profile not found."));
    return;
  }

  await insertAnalyticsEvent(context.profile.id, "booking_page_view", req);
  res.json(ok(mapPublicBookingProfile(context.profile, context.meetingTypes)));
});

v1Router.get("/book/:profileSlug/:meetingTypeSlug/slots", async (req, res) => {
  const query = publicBookingSlotsQuerySchema.safeParse(req.query);
  if (!query.success) {
    res.status(400).json(fail("Invalid slot lookup details."));
    return;
  }

  const context = await getPublicBookingContext(req.params.profileSlug, req.params.meetingTypeSlug);
  if (!context) {
    res.status(404).json(fail("Booking page not found."));
    return;
  }

  const meetingType = context.meetingTypes[0];
  const timezone = query.data.timezone ?? "UTC";
  const from = query.data.from ? new Date(query.data.from) : new Date();
  const defaultTo = new Date(from.getTime() + Number(meetingType.booking_window_days) * 24 * 60 * 60 * 1000);
  const to = query.data.to ? new Date(query.data.to) : defaultTo;

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from) {
    res.status(400).json(fail("Invalid slot date range."));
    return;
  }

  if (to.getTime() - from.getTime() > 60 * 24 * 60 * 60 * 1000) {
    res.status(400).json(fail("Slot range cannot exceed 60 days."));
    return;
  }

  try {
    const slots = await generateBookingSlots({
      ownerUserId: String(context.profile.user_id),
      meetingType,
      from,
      to,
      timezone
    });

    res.json(ok({
      profile: mapPublicProfile(context.profile),
      meetingType: mapMeetingType(meetingType),
      slots
    }));
  } catch {
    res.status(500).json(fail("Could not load booking slots."));
  }
});

v1Router.post("/book/:profileSlug/:meetingTypeSlug/bookings", async (req, res) => {
  const input = publicBookingInputSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(fail("Invalid booking details."));
    return;
  }

  const context = await getPublicBookingContext(req.params.profileSlug, req.params.meetingTypeSlug);
  if (!context) {
    res.status(404).json(fail("Booking page not found."));
    return;
  }

  const meetingType = context.meetingTypes[0];
  const requestedStart = new Date(input.data.startAt);
  if (Number.isNaN(requestedStart.getTime())) {
    res.status(400).json(fail("Invalid booking start time."));
    return;
  }

  const requestedEnd = new Date(requestedStart.getTime() + Number(meetingType.duration_minutes) * 60 * 1000);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [String(context.profile.user_id)]);

    let linkedConnectionId = input.data.connectionId ?? null;
    let linkedEventId = input.data.eventId ?? null;
    let bookingSource = input.data.source;

    if (linkedConnectionId) {
      const connectionResult = await client.query(
        "SELECT id FROM connections WHERE id = $1 AND owner_user_id = $2",
        [linkedConnectionId, context.profile.user_id]
      );
      if (connectionResult.rowCount === 0) {
        await client.query("ROLLBACK");
        res.status(400).json(fail("Invalid booking connection context."));
        return;
      }
      bookingSource = "connection";
    }

    if (linkedEventId) {
      const eventResult = await client.query(
        `SELECT e.id
        FROM events e
        LEFT JOIN event_check_ins eci
          ON eci.event_id = e.id
          AND eci.profile_id = $3
        WHERE e.id = $1
          AND (
            e.owner_user_id = $2
            OR e.is_published = true
            OR eci.id IS NOT NULL
          )`,
        [linkedEventId, context.profile.user_id, context.profile.id]
      );
      if (eventResult.rowCount === 0) {
        await client.query("ROLLBACK");
        res.status(400).json(fail("Invalid booking event context."));
        return;
      }
      bookingSource = "event";
    }

    const slots = await generateBookingSlots({
      ownerUserId: String(context.profile.user_id),
      meetingType,
      from: new Date(requestedStart.getTime() - 24 * 60 * 60 * 1000),
      to: new Date(requestedEnd.getTime() + 24 * 60 * 60 * 1000),
      timezone: input.data.timezone
    });
    const matchingSlot = slots.find((slot) => slot.startAt === requestedStart.toISOString());

    if (!matchingSlot) {
      await client.query("ROLLBACK");
      res.status(409).json(fail("This time is no longer available."));
      return;
    }

    const guestResult = await client.query(
      `INSERT INTO booking_guests (name, email, company, message)
      VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [
        input.data.guestName,
        input.data.guestEmail,
        input.data.guestCompany ?? null,
        input.data.guestMessage ?? null
      ]
    );

    const bookingStatus = meetingType.requires_approval === true ? "pending" : "confirmed";

    const bookingResult = await client.query(
      `INSERT INTO bookings (
        owner_user_id,
        meeting_type_id,
        guest_id,
        connection_id,
        event_id,
        source,
        status,
        start_at,
        end_at,
        timezone
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        context.profile.user_id,
        meetingType.id,
        guestResult.rows[0].id,
        linkedConnectionId,
        linkedEventId,
        bookingSource,
        bookingStatus,
        requestedStart.toISOString(),
        requestedEnd.toISOString(),
        input.data.timezone
      ]
    );

    await client.query(
      "INSERT INTO booking_audit_events (booking_id, owner_user_id, event_type, metadata) VALUES ($1, $2, 'created', $3)",
      [
        bookingResult.rows[0].id,
        context.profile.user_id,
        JSON.stringify({
          source: bookingSource,
          publicProfileSlug: req.params.profileSlug,
          connectionId: linkedConnectionId,
          eventId: linkedEventId
        })
      ]
    );

    if (linkedConnectionId) {
      await createBookingConnectionActivity({
        db: client,
        connectionId: linkedConnectionId,
        ownerUserId: String(context.profile.user_id),
        meetingTitle: String(meetingType.title),
        guestName: input.data.guestName,
        guestEmail: input.data.guestEmail,
        startAt: requestedStart.toISOString(),
        timezone: input.data.timezone
      });
    }

    const fullBookingResult = await client.query(
      `SELECT
        b.*,
        mt.slug AS meeting_type_slug,
        mt.title AS meeting_type_title,
        mt.description AS meeting_type_description,
        mt.duration_minutes AS meeting_type_duration_minutes,
        mt.location_type AS meeting_type_location_type,
        mt.location_value AS meeting_type_location_value,
        mt.buffer_before_minutes AS meeting_type_buffer_before_minutes,
        mt.buffer_after_minutes AS meeting_type_buffer_after_minutes,
        mt.min_notice_minutes AS meeting_type_min_notice_minutes,
        mt.booking_window_days AS meeting_type_booking_window_days,
        mt.is_active AS meeting_type_is_active,
        mt.requires_approval AS meeting_type_requires_approval,
        mt.created_at AS meeting_type_created_at,
        mt.updated_at AS meeting_type_updated_at,
        bg.id AS guest_id,
        bg.name AS guest_name,
        bg.email AS guest_email,
        bg.company AS guest_company,
        bg.message AS guest_message,
        bg.created_at AS guest_created_at
      FROM bookings b
      JOIN meeting_types mt ON mt.id = b.meeting_type_id
      JOIN booking_guests bg ON bg.id = b.guest_id
      WHERE b.id = $1`,
      [bookingResult.rows[0].id]
    );

    const rescheduleToken = randomBytes(32).toString("hex");
    const cancelToken = randomBytes(32).toString("hex");
    const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await client.query(
      `INSERT INTO booking_guest_tokens (booking_id, token_hash, guest_email, type, expires_at)
      VALUES ($1, $2, $3, 'reschedule', $4),
             ($1, $5, $3, 'cancel', $4)`,
      [
        bookingResult.rows[0].id,
        hashGuestToken(rescheduleToken),
        input.data.guestEmail,
        tokenExpiresAt,
        hashGuestToken(cancelToken)
      ]
    );

    await client.query("COMMIT");
    await insertAnalyticsEvent(context.profile.id, "booking_confirmed", req);
    res.status(201).json(ok({
      booking: mapBooking(fullBookingResult.rows[0]),
      profile: mapPublicProfile(context.profile),
      guestTokens: {
        reschedule: rescheduleToken,
        cancel: cancelToken
      }
    }));
  } catch {
    await client.query("ROLLBACK");
    res.status(500).json(fail("Could not create booking."));
  } finally {
    client.release();
  }
});

v1Router.get("/book/:profileSlug/:meetingTypeSlug/reschedule", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : null;
  if (!token) {
    res.status(400).json(fail("Reschedule token is required."));
    return;
  }

  const row = await validateGuestToken(
    token,
    "reschedule",
    req.params.profileSlug,
    req.params.meetingTypeSlug
  );

  if (!row) {
    res.status(404).json(fail("Invalid or expired reschedule token."));
    return;
  }

  if (row.status !== "pending" && row.status !== "confirmed") {
    res.status(409).json(fail("This booking can no longer be rescheduled."));
    return;
  }

  const meetingTypeForSlots = {
    duration_minutes: row.meeting_type_duration_minutes,
    buffer_before_minutes: row.meeting_type_buffer_before_minutes,
    buffer_after_minutes: row.meeting_type_buffer_after_minutes,
    min_notice_minutes: row.meeting_type_min_notice_minutes,
    booking_window_days: row.meeting_type_booking_window_days,
    max_bookings_per_day: row.meeting_type_max_bookings_per_day
  };

  const meetingType = mapMeetingType({
    id: row.meeting_type_id,
    owner_user_id: row.owner_user_id,
    slug: row.meeting_type_slug,
    title: row.meeting_type_title,
    description: row.meeting_type_description,
    duration_minutes: row.meeting_type_duration_minutes,
    location_type: row.meeting_type_location_type,
    location_value: row.meeting_type_location_value,
    buffer_before_minutes: row.meeting_type_buffer_before_minutes,
    buffer_after_minutes: row.meeting_type_buffer_after_minutes,
    min_notice_minutes: row.meeting_type_min_notice_minutes,
    booking_window_days: row.meeting_type_booking_window_days,
    max_bookings_per_day: row.meeting_type_max_bookings_per_day,
    requires_approval: row.meeting_type_requires_approval,
    is_active: row.meeting_type_is_active,
    created_at: row.meeting_type_created_at,
    updated_at: row.meeting_type_updated_at
  });

  const profileResult = await pool.query(
    "SELECT * FROM profiles WHERE slug = $1 AND is_published = true",
    [req.params.profileSlug]
  );
  if (profileResult.rowCount === 0) {
    res.status(404).json(fail("Booking profile not found."));
    return;
  }

  const timezone = String(row.timezone);
  const from = new Date();
  const to = new Date(from.getTime() + Number(meetingTypeForSlots.booking_window_days) * 24 * 60 * 60 * 1000);

  try {
    const slots = await generateBookingSlots({
      ownerUserId: String(row.owner_user_id),
      meetingType: meetingTypeForSlots,
      from,
      to,
      timezone
    });

    res.json(ok({
      booking: mapBooking(row),
      profile: mapPublicProfile(profileResult.rows[0]),
      meetingType,
      slots
    }));
  } catch {
    res.status(500).json(fail("Could not load reschedule slots."));
  }
});

v1Router.post("/book/:profileSlug/:meetingTypeSlug/reschedule", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : null;
  if (!token) {
    res.status(400).json(fail("Reschedule token is required."));
    return;
  }

  const input = bookingRescheduleSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(fail("Invalid reschedule details."));
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const row = await validateGuestToken(
      token,
      "reschedule",
      req.params.profileSlug,
      req.params.meetingTypeSlug
    );

    if (!row) {
      await client.query("ROLLBACK");
      res.status(404).json(fail("Invalid or expired reschedule token."));
      return;
    }

    if (row.status !== "pending" && row.status !== "confirmed") {
      await client.query("ROLLBACK");
      res.status(409).json(fail("This booking can no longer be rescheduled."));
      return;
    }

    const requestedStart = new Date(input.data.startAt);
    const requestedEnd = new Date(input.data.endAt);
    const meetingType = {
      duration_minutes: row.meeting_type_duration_minutes,
      buffer_before_minutes: row.meeting_type_buffer_before_minutes,
      buffer_after_minutes: row.meeting_type_buffer_after_minutes,
      min_notice_minutes: row.meeting_type_min_notice_minutes,
      booking_window_days: row.meeting_type_booking_window_days,
      max_bookings_per_day: row.meeting_type_max_bookings_per_day
    };

    const slots = await generateBookingSlots({
      ownerUserId: String(row.owner_user_id),
      meetingType,
      from: new Date(requestedStart.getTime() - 24 * 60 * 60 * 1000),
      to: new Date(requestedEnd.getTime() + 24 * 60 * 60 * 1000),
      timezone: input.data.timezone
    });

    const matchingSlot = slots.find((slot) => slot.startAt === requestedStart.toISOString());
    if (!matchingSlot) {
      await client.query("ROLLBACK");
      res.status(409).json(fail("This time is no longer available."));
      return;
    }

    await client.query(
      "UPDATE bookings SET status = 'rescheduled' WHERE id = $1",
      [row.id]
    );

    const newStatus = row.status;
    const newBookingResult = await client.query(
      `INSERT INTO bookings (
        owner_user_id,
        meeting_type_id,
        guest_id,
        connection_id,
        event_id,
        source,
        status,
        start_at,
        end_at,
        timezone,
        rescheduled_from_booking_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        row.owner_user_id,
        row.meeting_type_id,
        row.guest_id,
        row.connection_id,
        row.event_id,
        row.source,
        newStatus,
        requestedStart.toISOString(),
        requestedEnd.toISOString(),
        input.data.timezone,
        row.id
      ]
    );

    await client.query(
      "UPDATE booking_guest_tokens SET used_at = now() WHERE id = $1",
      [row.token_id]
    );

    await client.query(
      "INSERT INTO booking_audit_events (booking_id, owner_user_id, event_type, metadata) VALUES ($1, $2, 'guest_rescheduled', $3)",
      [newBookingResult.rows[0].id, row.owner_user_id, JSON.stringify({ fromBookingId: row.id })]
    );

    const fullBookingResult = await client.query(
      `SELECT
        b.*,
        mt.slug AS meeting_type_slug,
        mt.title AS meeting_type_title,
        mt.description AS meeting_type_description,
        mt.duration_minutes AS meeting_type_duration_minutes,
        mt.location_type AS meeting_type_location_type,
        mt.location_value AS meeting_type_location_value,
        mt.buffer_before_minutes AS meeting_type_buffer_before_minutes,
        mt.buffer_after_minutes AS meeting_type_buffer_after_minutes,
        mt.min_notice_minutes AS meeting_type_min_notice_minutes,
        mt.booking_window_days AS meeting_type_booking_window_days,
        mt.max_bookings_per_day AS meeting_type_max_bookings_per_day,
        mt.is_active AS meeting_type_is_active,
        mt.requires_approval AS meeting_type_requires_approval,
        mt.created_at AS meeting_type_created_at,
        mt.updated_at AS meeting_type_updated_at,
        bg.id AS guest_id,
        bg.name AS guest_name,
        bg.email AS guest_email,
        bg.company AS guest_company,
        bg.message AS guest_message,
        bg.created_at AS guest_created_at
      FROM bookings b
      JOIN meeting_types mt ON mt.id = b.meeting_type_id
      JOIN booking_guests bg ON bg.id = b.guest_id
      WHERE b.id = $1`,
      [newBookingResult.rows[0].id]
    );

    await client.query("COMMIT");
    res.status(201).json(ok(mapBooking(fullBookingResult.rows[0])));
  } catch {
    await client.query("ROLLBACK");
    res.status(500).json(fail("Could not reschedule booking."));
  } finally {
    client.release();
  }
});

v1Router.get("/book/:profileSlug/:meetingTypeSlug/cancel", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : null;
  if (!token) {
    res.status(400).json(fail("Cancel token is required."));
    return;
  }

  const row = await validateGuestToken(
    token,
    "cancel",
    req.params.profileSlug,
    req.params.meetingTypeSlug
  );

  if (!row) {
    res.status(404).json(fail("Invalid or expired cancel token."));
    return;
  }

  const profileResult = await pool.query(
    "SELECT * FROM profiles WHERE slug = $1 AND is_published = true",
    [req.params.profileSlug]
  );
  if (profileResult.rowCount === 0) {
    res.status(404).json(fail("Booking profile not found."));
    return;
  }

  res.json(ok({
    booking: mapBooking(row),
    profile: mapPublicProfile(profileResult.rows[0])
  }));
});

v1Router.post("/book/:profileSlug/:meetingTypeSlug/cancel", async (req, res) => {
  const token = typeof req.query.token === "string" ? req.query.token : null;
  if (!token) {
    res.status(400).json(fail("Cancel token is required."));
    return;
  }

  const input = guestCancelSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(fail("Invalid cancellation details."));
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const row = await validateGuestToken(
      token,
      "cancel",
      req.params.profileSlug,
      req.params.meetingTypeSlug
    );

    if (!row) {
      await client.query("ROLLBACK");
      res.status(404).json(fail("Invalid or expired cancel token."));
      return;
    }

    if (row.status !== "pending" && row.status !== "confirmed") {
      await client.query("ROLLBACK");
      res.status(409).json(fail("This booking is already cancelled or rescheduled."));
      return;
    }

    const result = await client.query(
      `UPDATE bookings
      SET status = 'cancelled', cancellation_reason = $1
      WHERE id = $2
      RETURNING *`,
      [input.data.reason ?? null, row.id]
    );

    await client.query(
      "UPDATE booking_guest_tokens SET used_at = now() WHERE id = $1",
      [row.token_id]
    );

    await client.query(
      "INSERT INTO booking_audit_events (booking_id, owner_user_id, event_type, metadata) VALUES ($1, $2, 'guest_cancelled', $3)",
      [row.id, row.owner_user_id, JSON.stringify({ reason: input.data.reason ?? null })]
    );

    await client.query("COMMIT");
    res.json(ok(mapBooking(result.rows[0])));
  } catch {
    await client.query("ROLLBACK");
    res.status(500).json(fail("Could not cancel booking."));
  } finally {
    client.release();
  }
});

v1Router.post("/scheduling/bookings/:id/approve", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const currentResult = await client.query(
      "SELECT * FROM bookings WHERE id = $1 AND owner_user_id = $2",
      [req.params.id, user.id]
    );

    if (currentResult.rowCount === 0) {
      await client.query("ROLLBACK");
      res.status(404).json(fail("Booking not found."));
      return;
    }

    const current = currentResult.rows[0];
    if (current.status !== "pending") {
      await client.query("ROLLBACK");
      res.status(409).json(fail("Only pending bookings can be approved."));
      return;
    }

    const result = await client.query(
      `UPDATE bookings
      SET status = 'confirmed'
      WHERE id = $1 AND owner_user_id = $2
      RETURNING *`,
      [req.params.id, user.id]
    );

    await client.query(
      "INSERT INTO booking_audit_events (booking_id, owner_user_id, event_type, metadata) VALUES ($1, $2, 'approved', $3)",
      [req.params.id, user.id, JSON.stringify({ previousStatus: current.status })]
    );

    const fullBookingResult = await client.query(
      `SELECT
        b.*,
        mt.slug AS meeting_type_slug,
        mt.title AS meeting_type_title,
        mt.description AS meeting_type_description,
        mt.duration_minutes AS meeting_type_duration_minutes,
        mt.location_type AS meeting_type_location_type,
        mt.location_value AS meeting_type_location_value,
        mt.buffer_before_minutes AS meeting_type_buffer_before_minutes,
        mt.buffer_after_minutes AS meeting_type_buffer_after_minutes,
        mt.min_notice_minutes AS meeting_type_min_notice_minutes,
        mt.booking_window_days AS meeting_type_booking_window_days,
        mt.max_bookings_per_day AS meeting_type_max_bookings_per_day,
        mt.is_active AS meeting_type_is_active,
        mt.requires_approval AS meeting_type_requires_approval,
        mt.created_at AS meeting_type_created_at,
        mt.updated_at AS meeting_type_updated_at,
        bg.id AS guest_id,
        bg.name AS guest_name,
        bg.email AS guest_email,
        bg.company AS guest_company,
        bg.message AS guest_message,
        bg.created_at AS guest_created_at
      FROM bookings b
      JOIN meeting_types mt ON mt.id = b.meeting_type_id
      JOIN booking_guests bg ON bg.id = b.guest_id
      WHERE b.id = $1`,
      [req.params.id]
    );

    await client.query("COMMIT");
    res.json(ok(mapBooking(fullBookingResult.rows[0])));
  } catch {
    await client.query("ROLLBACK");
    res.status(500).json(fail("Could not approve booking."));
  } finally {
    client.release();
  }
});

v1Router.post("/scheduling/bookings/:id/reject", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const input = guestCancelSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(fail("Invalid rejection details."));
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const currentResult = await client.query(
      "SELECT * FROM bookings WHERE id = $1 AND owner_user_id = $2",
      [req.params.id, user.id]
    );

    if (currentResult.rowCount === 0) {
      await client.query("ROLLBACK");
      res.status(404).json(fail("Booking not found."));
      return;
    }

    const current = currentResult.rows[0];
    if (current.status !== "pending") {
      await client.query("ROLLBACK");
      res.status(409).json(fail("Only pending bookings can be rejected."));
      return;
    }

    const result = await client.query(
      `UPDATE bookings
      SET status = 'cancelled', cancellation_reason = $1
      WHERE id = $2 AND owner_user_id = $3
      RETURNING *`,
      [input.data.reason ?? null, req.params.id, user.id]
    );

    await client.query(
      "INSERT INTO booking_audit_events (booking_id, owner_user_id, event_type, metadata) VALUES ($1, $2, 'rejected', $3)",
      [req.params.id, user.id, JSON.stringify({ reason: input.data.reason ?? null })]
    );

    const fullBookingResult = await client.query(
      `SELECT
        b.*,
        mt.slug AS meeting_type_slug,
        mt.title AS meeting_type_title,
        mt.description AS meeting_type_description,
        mt.duration_minutes AS meeting_type_duration_minutes,
        mt.location_type AS meeting_type_location_type,
        mt.location_value AS meeting_type_location_value,
        mt.buffer_before_minutes AS meeting_type_buffer_before_minutes,
        mt.buffer_after_minutes AS meeting_type_buffer_after_minutes,
        mt.min_notice_minutes AS meeting_type_min_notice_minutes,
        mt.booking_window_days AS meeting_type_booking_window_days,
        mt.max_bookings_per_day AS meeting_type_max_bookings_per_day,
        mt.is_active AS meeting_type_is_active,
        mt.requires_approval AS meeting_type_requires_approval,
        mt.created_at AS meeting_type_created_at,
        mt.updated_at AS meeting_type_updated_at,
        bg.id AS guest_id,
        bg.name AS guest_name,
        bg.email AS guest_email,
        bg.company AS guest_company,
        bg.message AS guest_message,
        bg.created_at AS guest_created_at
      FROM bookings b
      JOIN meeting_types mt ON mt.id = b.meeting_type_id
      JOIN booking_guests bg ON bg.id = b.guest_id
      WHERE b.id = $1`,
      [req.params.id]
    );

    await client.query("COMMIT");
    res.json(ok(mapBooking(fullBookingResult.rows[0])));
  } catch {
    await client.query("ROLLBACK");
    res.status(500).json(fail("Could not reject booking."));
  } finally {
    client.release();
  }
});

v1Router.get("/events/me", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const result = await pool.query(
    "SELECT * FROM events WHERE owner_user_id = $1 ORDER BY starts_at DESC",
    [user.id]
  );

  res.json(ok(result.rows.map(mapEvent)));
});

v1Router.post("/events", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const input = eventInputSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(fail("Invalid event details."));
    return;
  }

  const startsAt = new Date(input.data.startsAt);
  const endsAt = input.data.endsAt ? new Date(input.data.endsAt) : null;
  if (endsAt && endsAt <= startsAt) {
    res.status(400).json(fail("Event end time must be after start time."));
    return;
  }

  const slug = input.data.slug ?? (await makeUniqueEventSlug(input.data.name));

  try {
    const result = await pool.query(
      `INSERT INTO events (
        owner_user_id,
        slug,
        name,
        description,
        location,
        starts_at,
        ends_at,
        is_published
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        user.id,
        slug,
        input.data.name,
        input.data.description ?? null,
        input.data.location ?? null,
        input.data.startsAt,
        input.data.endsAt ?? null,
        input.data.isPublished ?? false
      ]
    );

    res.status(201).json(ok(mapEvent(result.rows[0])));
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json(fail("An event with this slug already exists."));
      return;
    }
    res.status(500).json(fail("Could not create event."));
  }
});

v1Router.put("/events/:id", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const input = eventUpdateSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(fail("Invalid event details."));
    return;
  }

  const currentResult = await pool.query(
    "SELECT * FROM events WHERE id = $1 AND owner_user_id = $2",
    [req.params.id, user.id]
  );
  if (currentResult.rowCount === 0) {
    res.status(404).json(fail("Event not found."));
    return;
  }

  const current = currentResult.rows[0];
  const nextStartsAt = input.data.startsAt ?? current.starts_at;
  const nextEndsAt = input.data.endsAt !== undefined ? input.data.endsAt : current.ends_at;
  if (nextEndsAt && new Date(nextEndsAt) <= new Date(nextStartsAt)) {
    res.status(400).json(fail("Event end time must be after start time."));
    return;
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  const addField = (column: string, value: unknown) => {
    values.push(value);
    fields.push(`${column} = $${values.length}`);
  };

  if (input.data.slug !== undefined) addField("slug", input.data.slug);
  if (input.data.name !== undefined) addField("name", input.data.name);
  if (input.data.description !== undefined) addField("description", input.data.description);
  if (input.data.location !== undefined) addField("location", input.data.location);
  if (input.data.startsAt !== undefined) addField("starts_at", input.data.startsAt);
  if (input.data.endsAt !== undefined) addField("ends_at", input.data.endsAt);
  if (input.data.isPublished !== undefined) addField("is_published", input.data.isPublished);

  values.push(req.params.id, user.id);

  try {
    const result = await pool.query(
      `UPDATE events
      SET ${fields.join(", ")}
      WHERE id = $${values.length - 1} AND owner_user_id = $${values.length}
      RETURNING *`,
      values
    );

    res.json(ok(mapEvent(result.rows[0])));
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      res.status(409).json(fail("An event with this slug already exists."));
      return;
    }
    res.status(500).json(fail("Could not update event."));
  }
});

v1Router.get("/events/:slug", async (req, res) => {
  const user = await getAuthUser(req);
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.params.slug);

  if (isUuid && user) {
    const ownedResult = await pool.query(
      "SELECT * FROM events WHERE id = $1 AND owner_user_id = $2",
      [req.params.slug, user.id]
    );

    if ((ownedResult.rowCount ?? 0) > 0) {
      res.json(ok(mapEvent(ownedResult.rows[0])));
      return;
    }
  }

  const publicResult = await pool.query(
    "SELECT * FROM events WHERE slug = $1 AND is_published = true",
    [req.params.slug]
  );

  if (publicResult.rowCount === 0) {
    res.status(404).json(fail("Event not found."));
    return;
  }

  res.json(ok(mapPublicEvent(publicResult.rows[0])));
});

v1Router.post("/events/:slug/check-ins", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const eventResult = await pool.query(
    "SELECT * FROM events WHERE slug = $1 AND is_published = true",
    [req.params.slug]
  );
  if (eventResult.rowCount === 0) {
    res.status(404).json(fail("Event not found."));
    return;
  }

  const profileResult = await pool.query(
    "SELECT * FROM profiles WHERE user_id = $1 AND is_published = true",
    [user.id]
  );
  if (profileResult.rowCount === 0) {
    res.status(400).json(fail("Publish your profile before checking in."));
    return;
  }

  const result = await pool.query(
    `INSERT INTO event_check_ins (event_id, user_id, profile_id)
    VALUES ($1, $2, $3)
    ON CONFLICT (event_id, user_id)
    DO UPDATE SET profile_id = EXCLUDED.profile_id, checked_in_at = now()
    RETURNING *`,
    [eventResult.rows[0].id, user.id, profileResult.rows[0].id]
  );

  res.status(201).json(ok(mapEventCheckIn(result.rows[0])));
});

v1Router.get("/events/:id/check-ins", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const accessResult = await pool.query(
    `SELECT e.id
    FROM events e
    LEFT JOIN event_check_ins eci
      ON eci.event_id = e.id
      AND eci.user_id = $2
    WHERE e.id = $1
      AND (e.owner_user_id = $2 OR eci.id IS NOT NULL)`,
    [req.params.id, user.id]
  );
  if (accessResult.rowCount === 0) {
    res.status(404).json(fail("Event not found."));
    return;
  }

  const result = await pool.query(
    `WITH my_profile AS (
      SELECT id
      FROM profiles
      WHERE user_id = $2
    )
    SELECT
      p.*,
      eci.user_id AS attendee_user_id,
      eci.checked_in_at,
      CASE
        WHEN p.user_id = $2 THEN 'none'
        WHEN mine.id IS NOT NULL AND reciprocal.id IS NOT NULL THEN 'mutual'
        WHEN mine.id IS NOT NULL THEN 'saved'
        WHEN reciprocal.id IS NOT NULL THEN 'saved_me'
        ELSE 'none'
      END AS connection_status,
      mine.created_at AS connected_at
    FROM event_check_ins eci
    JOIN profiles p ON p.id = eci.profile_id
    LEFT JOIN my_profile mp ON true
    LEFT JOIN connections mine
      ON mine.owner_user_id = $2
      AND mine.connected_profile_id = p.id
    LEFT JOIN connections reciprocal
      ON reciprocal.owner_user_id = p.user_id
      AND reciprocal.connected_profile_id = mp.id
    WHERE eci.event_id = $1
    ORDER BY eci.checked_in_at DESC`,
    [req.params.id, user.id]
  );

  res.json(ok(result.rows.map(mapEventAttendee)));
});

v1Router.post("/analytics/events", async (req, res) => {
  const input = analyticsInputSchema.safeParse(req.body);
  if (!input.success) {
    res.status(400).json(fail("Invalid analytics event."));
    return;
  }

  const profileResult = await pool.query(
    "SELECT id FROM profiles WHERE id = $1 AND is_published = true",
    [input.data.profileId]
  );

  if (profileResult.rowCount === 0) {
    res.status(404).json(fail("Profile not found."));
    return;
  }

  try {
    const result = await pool.query(
      `INSERT INTO analytics_events (
        profile_id, event_type, visitor_id, referrer, user_agent
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id`,
      [
        input.data.profileId,
        input.data.eventType,
        input.data.visitorId ?? null,
        input.data.referrer ?? null,
        input.data.userAgent ?? req.get("user-agent") ?? null
      ]
    );

    res.status(201).json(ok({ id: result.rows[0].id }));
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "22P02") {
      res.status(202).json(ok({ id: null }));
      return;
    }
    res.status(500).json(fail("Could not track analytics event."));
  }
});

v1Router.get("/analytics/me", async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;

  const result = await pool.query(
    `SELECT
      COALESCE(pm.profile_views, 0)::int AS profile_views,
      COALESCE(pm.qr_scans, 0)::int AS qr_scans,
      COALESCE(pm.vcard_downloads, 0)::int AS vcard_downloads,
      COALESCE(pm.connections_added, 0)::int AS connections_added
    FROM profiles p
    LEFT JOIN profile_metrics pm ON pm.profile_id = p.id
    WHERE p.user_id = $1`,
    [user.id]
  );

  const row = result.rows[0];
  res.json(
    ok({
      profileViews: row?.profile_views ?? 0,
      qrScans: row?.qr_scans ?? 0,
      vcardDownloads: row?.vcard_downloads ?? 0,
      connectionsAdded: row?.connections_added ?? 0
    })
  );
});
