# OrbitOne Scheduling Upgrade Plan v2

This is the upgraded plan for OrbitOne Scheduling, revised after the v2 Island Modern redesign to make the module feel native, networking-first, and mobile-friendly for the Sri Lankan market.

## Goal

Build proper appointment booking as a fully integrated OrbitOne module — not a Calendly clone. Scheduling must help users turn introductions into opportunities by making it easy to book, confirm, track, and follow up after meetings.

## Product name

- OrbitOne Scheduling

## Core principle

Scheduling is a **follow-up action**, not a standalone calendar tool. A booking should always start from a person, connection, or event — and it should feed directly into the OrbitOne network and light CRM.

## How this is different from Calendly

| Calendly | OrbitOne Scheduling |
|---|---|
| Generic booking link for anyone | Booking link tied to a digital business card |
| Cold scheduling | Follow-up after a profile view, event, or connection |
| No CRM context | Booking auto-logs as a CRM activity on the connection |
| No follow-up workflow | Post-meeting prompts and automatic follow-up reminders |
| Standalone product | Embedded in public profiles, connections, events, and dashboard |

## Scope

### Build

- Google Calendar integration first.
- Zoho Calendar integration for Zoho Mail business users.
- Microsoft Outlook/365 Calendar later.
- Calendar account connect/disconnect with multiple calendars per provider.
- Meeting types with active/inactive state, approval option, and location details.
- Weekly availability with timezone, buffers, minimum notice, and booking window.
- Availability exceptions.
- Slot generation from OrbitOne availability plus external busy times.
- Public booking page with calendar-style date picker.
- Booking confirmation with guest self-service reschedule/cancel.
- Host approval workflow for selected meeting types.
- Cancel and reschedule.
- Dashboard bookings with tabs and actions.
- Profile, connection, and event integration.
- CRM activity integration and post-meeting follow-up prompts.
- Email and WhatsApp confirmations/reminders.
- `.ics` calendar invites and “Add to calendar” links.
- Rate limiting and booking audit log.
- Sri Lankan market defaults: `Asia/Colombo` timezone, WhatsApp-first notifications, local phone format support.

### Do not build yet

- Payments or paid appointments.
- Team round-robin scheduling.
- Multi-host pooled availability.
- AI scheduling assistant.
- Full email campaign automation.
- n8n workflows inside OrbitOne infrastructure.

## Product Routes

### Dashboard

- `/dashboard/scheduling`
- `/dashboard/scheduling/calendar`
- `/dashboard/scheduling/meeting-types`
- `/dashboard/scheduling/availability`
- `/dashboard/scheduling/bookings`

### Public

- `/book/[slug]`
- `/book/[slug]/[meetingTypeSlug]`
- `/book/[slug]/[meetingTypeSlug]/reschedule?token=` (guest self-service)
- `/book/[slug]/[meetingTypeSlug]/cancel?token=` (guest self-service)

### Existing routes to update

- `/u/[slug]` adds a `Book a meeting` action.
- `/dashboard/connections/[id]` adds a `Book follow-up` action.
- `/dashboard/events/[id]` may link attendees to booking pages.

## User Experience Map

### 1. Host sets up scheduling

1. Connect Google Calendar (or Zoho).
2. Create meeting types: title, slug, duration, location, description.
3. Set weekly availability: days, times, timezone.
4. Configure buffers, minimum notice, booking window, and approval requirement.

### 2. Guest books a meeting

1. Lands on `/book/[slug]` from a profile, event, or connection.
2. Sees the host’s identity and context (e.g., *“You met at Startup Meetup Colombo”*).
3. Selects a meeting type.
4. Picks a date from a calendar and an available time slot.
5. Enters minimal details: name, email, optional message.
6. Submits. If approval is required, sees a pending state.
7. Receives confirmation email/WhatsApp with calendar invite and reschedule/cancel link.

### 3. After the meeting

1. OrbitOne prompts the host to confirm the meeting happened.
2. Host can update lifecycle stage, add notes, or create a follow-up.
3. Connection CRM timeline shows the booking and outcome.

## Codex Workstream

Codex owns backend, integrations, data model, security, and final integration.

### Codex Phase S1: Scheduling Foundation

Status: backend implemented.

Build:

- PostgreSQL schema for scheduling.
- Shared TypeScript contracts.
- Internal scheduling APIs.
- Availability rule validation.
- Meeting type CRUD.
- Booking state model.
- Rate limiting on public booking endpoints.
- Encrypted token storage for OAuth credentials.
- Booking audit event logging.

Tables:

- `calendar_accounts`
- `meeting_types`
- `availability_rules`
- `availability_exceptions`
- `bookings`
- `booking_guests`
- `booking_guest_tokens` (for reschedule/cancel)
- `booking_questions`
- `booking_audit_events`
- `booking_reminders`

Core fields:

- Calendar account provider: `google`, `zoho`, later `microsoft`.
- Meeting type: title, slug, duration, location type, location value, description, active state, `requiresApproval`.
- Availability: timezone, day of week, start time, end time.
- Booking status: `pending`, `confirmed`, `cancelled`, `rescheduled`.
- Booking source: `profile`, `connection`, `event`, `direct`.

APIs:

```http
GET    /api/v1/scheduling/calendar-accounts
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
POST   /api/v1/scheduling/bookings/:id/approve
POST   /api/v1/scheduling/bookings/:id/reject
```

### Codex Phase S2: Google Calendar Integration

Status: backend contract implemented. Live OAuth needs real Google credentials before full external testing.

Build:

- Google OAuth connect flow.
- Token storage with encryption.
- Refresh token handling.
- Select multiple calendars per account.
- Read busy times from Google Calendar.
- Create Google Calendar event on confirmed booking.
- Update/cancel external event on reschedule/cancel.
- Store external event ID.

APIs:

```http
GET    /api/v1/scheduling/calendar-accounts
POST   /api/v1/scheduling/google/connect
GET    /api/v1/scheduling/google/callback
DELETE /api/v1/scheduling/calendar-accounts/:id
```

Environment variables:

```env
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALENDAR_REDIRECT_URI=
CALENDAR_TOKEN_ENCRYPTION_KEY=
```

Security rules:

- OAuth tokens are backend-only.
- Never expose refresh tokens to frontend.
- Calendar account belongs to one OrbitOne user.
- Booking guests do not need an OrbitOne account.
- Public slot lookup must not leak private calendar details.

### Codex Phase S3: Slot Engine And Public Booking

Status: backend implemented for OrbitOne-owned calendar availability and public booking APIs.

Build:

- Slot generation.
- Timezone handling with IANA timezone input.
- External busy-time merge.
- Minimum notice, buffer before/after, max bookings per day/week/month.
- Booking confirmation and pending-approval state.
- Guest self-service reschedule/cancel tokens.
- Location normalization and validation.
- Booking conflict detection across multiple connected calendars.

Public APIs:

```http
GET  /api/v1/book/:profileSlug
GET  /api/v1/book/:profileSlug/:meetingTypeSlug/slots?from=&to=&timezone=
POST /api/v1/book/:profileSlug/:meetingTypeSlug/bookings

GET  /api/v1/book/:profileSlug/:meetingTypeSlug/reschedule?token=
POST /api/v1/book/:profileSlug/:meetingTypeSlug/reschedule?token=
GET  /api/v1/book/:profileSlug/:meetingTypeSlug/cancel?token=
POST /api/v1/book/:profileSlug/:meetingTypeSlug/cancel?token=
```

Booking form fields:

- Guest name.
- Guest email.
- Guest company (optional).
- Guest message (optional).
- Selected slot.
- Timezone.

### Codex Phase S4: OrbitOne Integration

Status: backend implemented.

Build:

- Link booking to profile owner.
- Optionally link booking to connection via `connectionId`.
- Create CRM activity after booking.
- Update lifecycle stage to `meeting` when appropriate.
- Post-meeting follow-up prompts and automatic reminder creation.
- Scheduling analytics events.

Integration points:

- Public profile `Book a meeting`.
- Connection detail `Book follow-up`.
- Event attendee `Book with attendee`.
- CRM activity timeline.

Analytics events:

- `booking_page_view`
- `booking_slot_selected`
- `booking_confirmed`
- `booking_cancelled`
- `booking_rescheduled`
- `booking_approved`
- `booking_rejected`

### Codex Phase S5: Notifications & Webhooks

New phase.

Build:

- Booking confirmation email to guest and host.
- Booking approval request email to host.
- Booking approval/rejection email to guest.
- Reminder emails before the meeting.
- WhatsApp confirmation/reminder messages using `https://wa.me/?text=...`.
- `.ics` calendar invite generation.
- “Add to calendar” links for Google, Outlook, Yahoo, Apple.
- Optional webhook for external systems (future-proofing).

Environment variables:

```env
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=
WHATSAPP_API_KEY=        # if using a provider, optional
PUBLIC_APP_URL=
```

### Codex Phase SZ1: Zoho Calendar Integration

Status: backend OAuth/account connection implemented.

Build:

- Zoho OAuth connect flow.
- Token storage with encryption.
- Select multiple Zoho calendars.
- Read busy times from Zoho Calendar.
- Create Zoho Calendar event on confirmed booking.
- Update/cancel external event on reschedule/cancel.

APIs:

```http
GET    /api/v1/scheduling/zoho/connect
POST   /api/v1/scheduling/zoho/connect
GET    /api/v1/scheduling/zoho/callback
```

Environment variables:

```env
ZOHO_CLIENT_ID=
ZOHO_CLIENT_SECRET=
ZOHO_CALENDAR_REDIRECT_URI=
ZOHO_ACCOUNTS_BASE_URL=
ZOHO_CALENDAR_SCOPES=
```

### Codex Phase S6: Microsoft Calendar Later

Build after Google and Zoho are stable:

- Microsoft OAuth.
- Microsoft Graph free/busy.
- Microsoft Graph event create/cancel/update.
- Shared provider interface.

Do not start Microsoft until Google booking works end to end.

## Kimi Workstream

Kimi owns user-facing UI, responsive states, and brand consistency.

### Kimi Phase S1: Scheduling Dashboard UI

Build:

- `/dashboard/scheduling` overview.
- Connected calendar status card with multiple calendars.
- Upcoming bookings list with tabs: **Upcoming**, **Pending approval**, **Past**, **Cancelled**.
- Scheduling quick actions.
- Empty/loading/error states.
- “Send reminder” and “Approve/Reject” actions for pending bookings.

Depends on Codex:

- Calendar account status contract.
- Bookings list contract.

### Kimi Phase S2: Meeting Types UI

Build:

- `/dashboard/scheduling/meeting-types`
- Meeting type list.
- Create/edit form.
- Duration selector.
- Location type selector with location value/link field.
- Active/inactive toggle.
- `Requires approval` toggle.
- Copy booking link.

Meeting type fields:

- Title.
- Slug.
- Description.
- Duration.
- Location type and value (URL, phone number, or address).
- Active state.
- Requires approval.

### Kimi Phase S3: Availability UI

Build:

- `/dashboard/scheduling/availability`
- Weekly schedule editor.
- Timezone selector defaulting to `Asia/Colombo`.
- Buffer settings.
- Minimum notice.
- Booking window.
- Availability exceptions.

UX requirements:

- Mobile-friendly time controls.
- Clear validation messages.
- No overlapping availability blocks.
- Show guest-facing explanation (e.g., *“Requires 4 hours notice”*).

### Kimi Phase S4: Public Booking UI

Build:

- `/book/[slug]`
- `/book/[slug]/[meetingTypeSlug]`
- Calendar-style date picker.
- Meeting type cards.
- Time slot picker grouped by date.
- Guest details form.
- Confirmation screen with next steps.
- Pending-approval state screen.
- Cancel/reschedule screens.

Public UX requirements:

- Fast, minimal, professional.
- Show host profile identity clearly.
- Show context if coming from connection or event.
- Show timezone clearly and convert to guest timezone.
- Handle no available slots with next-week suggestion and WhatsApp fallback.
- Handle disconnected calendar gracefully.
- Handle booking conflicts gracefully.
- Mobile-first layout with sticky CTA.
- Full dark mode support.
- Sinhala/Tamil labels (future i18n expansion).

### Kimi Phase S5: Existing UI Integration

Update:

- `/u/[slug]` with `Book a meeting`.
- `/dashboard/connections/[id]` with `Book follow-up`.
- `/dashboard/events/[id]` attendee cards with booking entry when available.
- Dashboard sidebar with Scheduling route.

### Kimi Phase S6: Notifications & Guest Self-Service UI

Build:

- Confirmation email/WhatsApp message templates.
- Reschedule/cancel landing pages for guests.
- “Add to calendar” buttons on confirmation screen.
- Host notification cards in dashboard.

## Shared Contracts

Codex defines shared types in `contracts/orbitone.ts` before Kimi builds UI.

Required types:

- `CalendarAccount`
- `MeetingType`
- `AvailabilityRule`
- `AvailabilityException`
- `Booking`
- `BookingGuest`
- `BookingGuestToken`
- `BookingSlot`
- `BookingStatus`
- `BookingSource`
- `BookingApprovalState`
- `MeetingLocationDetail`
- `SchedulingSettings`
- `BookingNotificationPreference`

## Security & Trust

- Encrypt OAuth tokens at rest with `CALENDAR_TOKEN_ENCRYPTION_KEY`.
- Never expose refresh tokens or encrypted values to the frontend.
- Rate limit public booking APIs per IP and per profile slug.
- Validate booking tokens for guest self-service actions.
- Audit log every create, approve, reject, reschedule, and cancel event.
- Treat booking guest data with the same care as OrbitOne user data.

## Sri Lankan Market Adaptations

- Default host timezone to `Asia/Colombo`.
- Support local phone numbers in `+94 77 123 4567` format.
- WhatsApp confirmation as a primary notification channel.
- Use Sinhala/Tamil labels on public booking pages when i18n expands.
- Optimize public booking pages for low-bandwidth mobile networks.

## Definition Of Done

Scheduling is done when:

- A user can connect Google Calendar and select calendars.
- A user can create meeting types with location details and approval settings.
- A user can set weekly availability with buffers, notice, and booking window.
- Public visitors see a calendar-style slot picker on mobile and desktop.
- Public visitors can book an appointment.
- Host can approve or reject pending bookings.
- The booking creates a Google Calendar event.
- Guest receives confirmation email/WhatsApp with `.ics`/calendar links.
- Guest can reschedule/cancel via a secure link.
- OrbitOne dashboard shows bookings with clear tabs and actions.
- Profile, connection, and CRM integrations work.
- Post-meeting follow-up prompts appear for the host.
- External calendar conflicts are respected.
- Rate limiting and audit logging are in place.
- Backend typecheck passes.
- Frontend lint/build pass.
- Docker local stack runs.
- Final browser QA passes on mobile and desktop, including dark mode.

## Build Order

Backend-first rule:

- Codex always starts each Scheduling phase.
- Kimi starts only after Codex marks the matching backend contract ready in `AGENTS.md`.
- The user will tell Kimi when to begin frontend work.

1. Codex S1: schema, contracts, internal scheduling APIs, rate limiting, audit log. Status: backend complete.
2. Kimi S1/S2 can start after Codex S1 contracts.
3. Codex S2: Google OAuth and calendar account connection. Status: backend contract implemented.
4. Kimi S3 can start after availability contract.
5. Codex S3: slot engine, public booking APIs, guest self-service tokens. Status: backend implemented.
6. Kimi S4 public booking UI.
7. Codex S4: OrbitOne integration and post-meeting workflow. Status: backend implemented.
8. Codex S5: notifications, email, WhatsApp, `.ics`. New phase.
9. Kimi S5 existing UI integration.
10. Kimi S6 notifications and guest self-service UI.
11. Codex SZ1: Zoho Calendar integration.
12. Codex S6: Microsoft Calendar integration.
13. Codex final integration, Docker checks, and test deployment readiness.
