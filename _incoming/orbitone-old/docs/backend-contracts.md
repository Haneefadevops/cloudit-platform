# OrbitOne V1 Backend Contracts

This contract follows `OrbitOne_ARCHITECTURE_v3_OFFICIAL.md`.

OrbitOne is a separate SaaS product with its own backend, PostgreSQL database, Redis instance, Docker Compose files, and Traefik routing. It must not run on the CloudIT/n8n automation server.

## API Base URLs

- Local: `http://localhost:8000/api/v1`
- Test: `https://to1.cloudit.lk/api/v1`
- Production: `https://po1.cloudit.lk/api/v1`

## Scope

Backend supports the Phase 1 digital business card product:

- Authentication backend.
- One public digital card profile per user.
- Public profile lookup by `slug` when `is_published = true`.
- QR/share support through stable public profile URLs.
- vCard generation from public profile fields.
- Add To Network from another user's published OrbitOne profile.
- Connections list backend data.
- Basic analytics events and profile metrics.

Backend does not support CRM notes, tags, follow-ups, event workflows, AI, payments, or n8n workflows in Phase 1.

Phase 2 professional networking adds discovery and relationship context without CRM workflows:

- Discover published OrbitOne profiles.
- See whether a profile is not saved, saved by me, saved me, or mutual.
- See people who saved my profile.
- See mutual connections.
- Read a networking summary for dashboard widgets.

Phase 3 relationship management adds lightweight tools on saved connections:

- Relationship status per saved connection.
- Private notes per saved connection.
- Private tags per user and connection.
- Follow-ups per saved connection.

Phase 3 still does not include full CRM pipelines, AI, payments, or event workflows.

Phase 4 event networking adds lightweight event-specific profile sharing:

- Event hosts can create and publish simple networking events.
- Attendees can check in with their published OrbitOne profile.
- Hosts and checked-in attendees can see event attendees with connection status.

Phase 4 still does not include ticketing, payments, event agendas, event CRM, AI, or n8n workflows.

Phase 5 light CRM adds connection-centered follow-through:

- Lightweight lifecycle stage per saved connection.
- Priority and next-step fields.
- Simple activity timeline per saved connection.
- CRM summary counts for dashboard widgets.

Phase 5 still does not include full CRM pipelines, deal objects, forecasts, payments, AI, or automations.

Scheduling S1 adds internal scheduling foundations before external calendar OAuth:

- Calendar account status model.
- Meeting type CRUD.
- Weekly availability and exceptions.
- Booking list/detail.
- Cancel and reschedule APIs.

Scheduling S1 does not yet create Google Calendar events or read external busy times. Google Calendar integration starts in Scheduling S2.

## Response Shape

```ts
type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
```

Frontend-facing response fields use `camelCase`. Database columns use `snake_case`.

## Database Tables

### `users`

Backend-owned auth identity table.

- `id: uuid`
- `email: citext`
- `password_hash: text`
- `full_name: text`
- `created_at: timestamptz`
- `updated_at: timestamptz`

### `profiles`

One digital card profile per user.

- `id: uuid`
- `user_id: uuid`
- `slug: text`
- `full_name: text`
- `headline: text | null`
- `company: text | null`
- `location: text | null`
- `bio: text | null`
- `avatar_url: text | null`
- `email: citext | null`
- `phone: text | null`
- `website_url: text | null`
- `linkedin_url: text | null`
- `x_url: text | null`
- `is_published: boolean`
- `created_at: timestamptz`
- `updated_at: timestamptz`

Rules:

- One profile per user.
- Anyone can read published profiles through the public API.
- Owners can manage only their own profile through authenticated APIs.
- `slug` must be lowercase letters, numbers, and hyphens, 3-40 characters, and unique.

### `connections`

Saved network contacts created from published OrbitOne profiles.

- `id: uuid`
- `owner_user_id: uuid`
- `connected_profile_id: uuid | null`
- `source: "public_profile" | "qr_code"`
- `full_name: text`
- `headline: text | null`
- `company: text | null`
- `email: citext | null`
- `phone: text | null`
- `website_url: text | null`
- `linkedin_url: text | null`
- `created_at: timestamptz`

Rules:

- A user can list and delete only their own connections.
- New connections must reference another user's published OrbitOne profile.
- A user cannot save the same OrbitOne profile twice.
- `connected_profile_id` can become `null` only if the original profile is deleted.
- Snapshot fields are copied at connection time.
- Phase 5 adds `lifecycle_stage`, `priority`, `next_step`, and `last_contacted_at`.

### `connection_activities`

Simple activity timeline for saved connections.

- `id: uuid`
- `connection_id: uuid`
- `owner_user_id: uuid`
- `activity_type: "note" | "call" | "email" | "meeting" | "other"`
- `title: text`
- `body: text | null`
- `occurred_at: timestamptz`
- `created_at: timestamptz`
- `updated_at: timestamptz`

Rules:

- A user can manage activities only for their own saved connections.
- Activity history is private to the connection owner.
- Creating `call`, `email`, or `meeting` activity updates `last_contacted_at`.

### `analytics_events`

Allowed event types:

- `profile_view`
- `qr_scan`
- `vcard_download`
- `connection_added`

Dashboard metrics come from the `profile_metrics` database view.

### `events`

Lightweight networking events hosted by OrbitOne users.

- `id: uuid`
- `owner_user_id: uuid`
- `slug: text`
- `name: text`
- `description: text | null`
- `location: text | null`
- `starts_at: timestamptz`
- `ends_at: timestamptz | null`
- `is_published: boolean`
- `created_at: timestamptz`
- `updated_at: timestamptz`

Rules:

- Owners can create, list, and update only their own events.
- Public event lookup requires `is_published = true`.
- Slugs are unique and use lowercase letters, numbers, and hyphens.

### `event_check_ins`

Attendee check-ins using published OrbitOne profiles.

- `id: uuid`
- `event_id: uuid`
- `user_id: uuid`
- `profile_id: uuid`
- `checked_in_at: timestamptz`

Rules:

- A user must have a published profile before checking in.
- A user can check in once per event; repeated check-in refreshes `checked_in_at`.
- Event attendee lists are visible to the event owner and checked-in attendees.

### `calendar_accounts`

Calendar provider connection status.

- `id: uuid`
- `owner_user_id: uuid`
- `provider: "google" | "microsoft" | "zoho"`
- `provider_account_id: text | null`
- `email: citext | null`
- `calendar_id: text | null`
- `is_connected: boolean`
- `token_expires_at: timestamptz | null`
- `created_at: timestamptz`
- `updated_at: timestamptz`

Rules:

- OAuth tokens are backend-only.
- One account per provider per user.
- S1 exposes status only; S2 implements Google connect/callback.

### `meeting_types`

Bookable appointment templates.

- `id: uuid`
- `owner_user_id: uuid`
- `slug: text`
- `title: text`
- `description: text | null`
- `duration_minutes: integer`
- `location_type: "video" | "phone" | "in_person" | "custom"`
- `location_value: text | null`
- `buffer_before_minutes: integer`
- `buffer_after_minutes: integer`
- `min_notice_minutes: integer`
- `booking_window_days: integer`
- `is_active: boolean`
- `created_at: timestamptz`
- `updated_at: timestamptz`

Rules:

- Meeting type slugs are unique per owner.
- Public booking pages use meeting type slugs later.

### `availability_rules`

Weekly availability blocks.

- `id: uuid`
- `owner_user_id: uuid`
- `day_of_week: integer`
- `start_time: time`
- `end_time: time`
- `timezone: text`
- `is_active: boolean`
- `created_at: timestamptz`
- `updated_at: timestamptz`

### `availability_exceptions`

Date-level overrides or blocked days.

- `id: uuid`
- `owner_user_id: uuid`
- `exception_date: date`
- `start_time: time | null`
- `end_time: time | null`
- `timezone: text`
- `is_available: boolean`
- `reason: text | null`
- `created_at: timestamptz`
- `updated_at: timestamptz`

### `bookings`

Scheduled appointments.

- `id: uuid`
- `owner_user_id: uuid`
- `meeting_type_id: uuid`
- `guest_id: uuid`
- `connection_id: uuid | null`
- `event_id: uuid | null`
- `source: "profile" | "connection" | "event" | "direct"`
- `status: "pending" | "confirmed" | "cancelled" | "rescheduled"`
- `start_at: timestamptz`
- `end_at: timestamptz`
- `timezone: text`
- `cancellation_reason: text | null`
- `rescheduled_from_booking_id: uuid | null`
- `external_provider: "google" | "microsoft" | "zoho" | null`
- `external_event_id: text | null`
- `created_at: timestamptz`
- `updated_at: timestamptz`

Rules:

- Users can manage only their own bookings.
- S1 supports internal cancel/reschedule state.
- S2 will create/cancel external calendar events.

## Frontend Routes

Kimi can build against:

- `/` landing page.
- `/login` authentication entry.
- `/dashboard` dashboard overview.
- `/dashboard/profile` profile builder.
- `/dashboard/connections` connections list.
- `/dashboard/settings` account/profile settings.
- `/u/[slug]` public profile.

## Backend Endpoints

These are the implemented Phase 1 API contracts.

Auth:

```http
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

Profiles:

```http
GET  /api/v1/profiles/me
PUT  /api/v1/profiles/me
GET  /api/v1/profiles?query=&limit=
GET  /api/v1/profiles/:slug
GET  /api/v1/profiles/:slug/vcard
```

Connections:

```http
GET    /api/v1/connections
POST   /api/v1/connections
DELETE /api/v1/connections/:id
```

Professional networking:

```http
GET /api/v1/network/summary
GET /api/v1/network/inbound
GET /api/v1/network/mutual
```

Relationship management:

```http
GET    /api/v1/connections/:id/relationship
PUT    /api/v1/connections/:id/relationship
GET    /api/v1/connections/:id/notes
POST   /api/v1/connections/:id/notes
DELETE /api/v1/connections/:id/notes/:noteId
GET    /api/v1/tags
POST   /api/v1/tags
DELETE /api/v1/tags/:id
PUT    /api/v1/connections/:id/tags
GET    /api/v1/connections/:id/follow-ups
POST   /api/v1/connections/:id/follow-ups
PATCH  /api/v1/connections/:id/follow-ups/:followUpId
DELETE /api/v1/connections/:id/follow-ups/:followUpId
```

Event networking:

```http
GET  /api/v1/events/me
POST /api/v1/events
PUT  /api/v1/events/:id
GET  /api/v1/events/:slug
POST /api/v1/events/:slug/check-ins
GET  /api/v1/events/:id/check-ins
```

Light CRM:

```http
GET    /api/v1/crm/summary
GET    /api/v1/connections/:id/crm
PUT    /api/v1/connections/:id/crm
GET    /api/v1/connections/:id/activities
POST   /api/v1/connections/:id/activities
DELETE /api/v1/connections/:id/activities/:activityId
```

Scheduling foundation:

```http
GET    /api/v1/scheduling/calendar-accounts
GET    /api/v1/scheduling/google/connect
POST   /api/v1/scheduling/google/connect
GET    /api/v1/scheduling/google/callback
GET    /api/v1/scheduling/zoho/connect
POST   /api/v1/scheduling/zoho/connect
GET    /api/v1/scheduling/zoho/callback
DELETE /api/v1/scheduling/calendar-accounts/:id
GET    /api/v1/scheduling/meeting-types
POST   /api/v1/scheduling/meeting-types
PUT    /api/v1/scheduling/meeting-types/:id
DELETE /api/v1/scheduling/meeting-types/:id
GET    /api/v1/scheduling/availability
PUT    /api/v1/scheduling/availability
GET    /api/v1/scheduling/bookings
GET    /api/v1/scheduling/bookings/:id
POST   /api/v1/scheduling/bookings/:id/cancel
POST   /api/v1/scheduling/bookings/:id/reschedule
```

Public scheduling:

```http
GET  /api/v1/book/:profileSlug
GET  /api/v1/book/:profileSlug/:meetingTypeSlug/slots?from=&to=&timezone=
POST /api/v1/book/:profileSlug/:meetingTypeSlug/bookings
```

`GET /api/v1/book/:profileSlug` returns the published profile and active meeting types:

```ts
type PublicBookingProfile = {
  profile: PublicProfile;
  meetingTypes: MeetingType[];
};
```

`GET /api/v1/book/:profileSlug/:meetingTypeSlug/slots` returns available slots only. Query range must be valid ISO datetimes and cannot exceed 60 days:

```ts
type PublicBookingSlots = {
  profile: PublicProfile;
  meetingType: MeetingType;
  slots: BookingSlot[];
};
```

`POST /api/v1/book/:profileSlug/:meetingTypeSlug/bookings` creates a confirmed OrbitOne booking after re-checking slot availability:

```ts
type PublicBookingInput = {
  guestName: string;
  guestEmail: string;
  guestCompany?: string | null;
  guestMessage?: string | null;
  startAt: string;
  timezone: string;
  source?: BookingSource;
  connectionId?: string | null;
  eventId?: string | null;
};

type PublicBookingConfirmation = {
  booking: Booking;
  profile: PublicProfile;
};
```

Slot rules:

- Published profiles only.
- Active meeting types only.
- Existing OrbitOne `pending` and `confirmed` bookings block slots.
- Meeting type duration, buffer, minimum notice, and booking window are enforced.
- Meeting type max bookings per day is enforced when configured.
- Weekly availability and availability exceptions are enforced.
- Public responses do not expose calendar tokens or private calendar details.

OrbitOne scheduling integration:

- `connectionId` is optional and must belong to the booking profile owner.
- When `connectionId` is valid, the booking is stored with `source: "connection"` and `connectionId`.
- Connection-linked bookings create a `meeting` CRM activity on the connection timeline.
- Connection lifecycle moves from `new` or `contacted` to `meeting` after a linked booking is confirmed.
- `eventId` is optional and must either belong to the booking profile owner or reference a published event.
- When `eventId` is valid, the booking is stored with `source: "event"` and `eventId`.
- Scheduling analytics event types are supported:
  - `booking_page_view`
  - `booking_slot_selected`
  - `booking_confirmed`
  - `booking_cancelled`
  - `booking_rescheduled`

Google Calendar integration:

- `GET /api/v1/scheduling/google/connect` requires an authenticated OrbitOne session and redirects directly to Google OAuth.
- `POST /api/v1/scheduling/google/connect` requires an authenticated OrbitOne session and returns:

```ts
type CalendarConnectResult = {
  authorizationUrl: string;
};
```

- `GET /api/v1/scheduling/google/callback` is the Google OAuth redirect target. It stores encrypted backend-only tokens, marks the user's Google calendar account connected, and redirects to `/dashboard/scheduling/calendar?connected=google`.
- `DELETE /api/v1/scheduling/calendar-accounts/:id` disconnects a calendar account owned by the current user by clearing stored tokens and setting `isConnected` to `false`.
- Missing Google OAuth configuration returns `503` from the connect endpoints.
- Required deployment environment variables:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALENDAR_REDIRECT_URI=
CALENDAR_TOKEN_ENCRYPTION_KEY=
```

Zoho Calendar integration:

- `GET /api/v1/scheduling/zoho/connect` requires an authenticated OrbitOne session and redirects directly to Zoho OAuth.
- `POST /api/v1/scheduling/zoho/connect` requires an authenticated OrbitOne session and returns:

```ts
type CalendarConnectResult = {
  authorizationUrl: string;
};
```

- `GET /api/v1/scheduling/zoho/callback` is the Zoho OAuth redirect target. It stores encrypted backend-only tokens, marks the user's Zoho calendar account connected, and redirects to `/dashboard/scheduling/calendar?connected=zoho`.
- Missing Zoho OAuth configuration returns `503` from the connect endpoints.
- Required deployment environment variables:

```env
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_CALENDAR_REDIRECT_URI=
ZOHO_ACCOUNTS_BASE_URL=https://accounts.zoho.com
ZOHO_CALENDAR_SCOPES=ZohoCalendar.calendar.ALL,ZohoCalendar.event.ALL
CALENDAR_TOKEN_ENCRYPTION_KEY=
```

Relationship status:

```ts
type RelationshipStatus =
  | "new"
  | "active"
  | "follow_up"
  | "opportunity"
  | "archived";
```

Network profile response:

```ts
type NetworkConnectionStatus = "none" | "saved" | "saved_me" | "mutual";

type NetworkProfile = {
  profile: PublicProfile;
  connectionStatus: NetworkConnectionStatus;
  connectedAt: string | null;
};

type NetworkSummary = {
  savedByMe: number;
  savedMe: number;
  mutualConnections: number;
  discoverableProfiles: number;
};
```

Event networking response:

```ts
type Event = {
  id: string;
  ownerUserId: string;
  slug: string;
  name: string;
  description: string | null;
  location: string | null;
  startsAt: string;
  endsAt: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

type PublicEvent = Omit<Event, "ownerUserId" | "isPublished" | "updatedAt">;

type EventCheckIn = {
  id: string;
  eventId: string;
  userId: string;
  profileId: string;
  checkedInAt: string;
};

type EventAttendee = {
  userId: string;
  profile: PublicProfile;
  checkedInAt: string;
  connectionStatus: NetworkConnectionStatus;
  connectedAt: string | null;
};
```

Light CRM response:

```ts
type LifecycleStage =
  | "new"
  | "contacted"
  | "meeting"
  | "proposal"
  | "won"
  | "lost";

type ConnectionPriority = "low" | "medium" | "high";

type ConnectionActivityType = "note" | "call" | "email" | "meeting" | "other";

type ConnectionActivity = {
  id: string;
  connectionId: string;
  ownerUserId: string;
  activityType: ConnectionActivityType;
  title: string;
  body: string | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
};

type ConnectionCRM = {
  connection: Connection;
  activities: ConnectionActivity[];
};

type CRMSummary = {
  lifecycle: Record<LifecycleStage, number>;
  highPriority: number;
  openFollowUps: number;
  overdueFollowUps: number;
};
```

Analytics:

```http
POST /api/v1/analytics/events
GET  /api/v1/analytics/me
```

Health:

```http
GET /health
```

## Frontend States To Handle

Auth:

- Signed out.
- Signed in with no profile yet.
- Signed in with unpublished draft profile.
- Signed in with published profile.

Public profile:

- Published profile found.
- Profile not found or unpublished.
- Add to network requires sign-in.
- Already added to network.

Dashboard:

- No analytics yet.
- Metrics loaded.
- Connections empty.
- Connections loaded.

## Handoff

Owner: Codex
Area: Backend architecture v3 alignment
Files changed:

- `backend/`
- `backend/migrations/0001_orbitone_v1_schema.sql`
- `contracts/orbitone.ts`
- `docs/backend-contracts.md`
- `frontend/Dockerfile`
- `frontend/.dockerignore`
- `docker-compose.local.yml`
- `docker-compose.test.yml`
- `docker-compose.prod.yml`
- `.env.example`
- `.gitignore`
- `frontend/README.md`
- `infra/traefik/README.md`

What changed:

- Replaced Supabase assumptions with a standalone Dockerized frontend, backend API, PostgreSQL schema, Redis dependency, and Traefik-ready Compose files.

Contract needed:

- Kimi can use the route list, API base URLs, endpoint paths, and shared TypeScript types above.

Open questions:

- Confirm whether Phase 1 public profile URLs should stay `/u/[slug]`.
- Confirm whether auth starts with email/password only.

Verification:

- Backend typecheck and build pass.
- Frontend lint and build pass.
- Local Compose is wired to run frontend, backend, PostgreSQL, and Redis together.
- Full runtime flow still needs local Docker services running with `.env.local`.
