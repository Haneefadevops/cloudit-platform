# OrbitOne Interactive Calendar Upgrade Plan

Goal:

Build an OrbitOne-owned interactive calendar that lets users manage availability, internal bookings, blocked time, and external calendar sync from one place.

OrbitOne Calendar must be the primary source of truth. Google Calendar, Microsoft Outlook, and Zoho Calendar are optional sync providers.

## Product Principle

OrbitOne Calendar should help users turn introductions into booked meetings, follow-ups, and opportunities.

The customer booking experience must only show real available slots. If a user is unavailable at 2 PM, the customer must not be able to book 2 PM.

## Core Booking Logic

A slot is available only when all conditions are true:

- The slot is inside the user's OrbitOne weekly availability.
- The slot is not inside an OrbitOne availability exception.
- The slot is not blocked by an OrbitOne calendar event.
- The slot is not already booked in OrbitOne.
- The slot is not busy in connected Google Calendar.
- The slot is not busy in connected Microsoft Outlook Calendar.
- The slot is not busy in connected Zoho Calendar.
- The slot respects meeting duration.
- The slot respects buffer before and after.
- The slot respects minimum notice.
- The slot respects booking window.
- The slot respects max bookings per day.
- The slot is shown in the customer selected timezone.

## Recommended Sync Strategy

Use a hybrid strategy:

1. Store OrbitOne calendar events and busy blocks locally.
2. Background sync external busy times into OrbitOne.
3. Do a final real-time provider check before confirming a booking.

This keeps booking pages fast while reducing double-booking risk.

## Calendar Providers

Supported provider model:

```ts
type CalendarProvider = "orbitone" | "google" | "microsoft" | "zoho";
```

Each external provider should support:

- Connect account.
- Refresh token.
- Read busy times.
- Create external event.
- Update external event.
- Cancel external event.
- Disconnect account.
- Store sync status and errors.

## User Dashboard Calendar

Build an interactive calendar inside OrbitOne:

- Month view.
- Week view.
- Day view.
- Agenda/list view.
- Bookings displayed on calendar.
- Manual internal events.
- Unavailable blocks.
- Holidays/time off.
- Drag to reschedule booking later.
- Click a slot to add block/event.
- Color-coded event types.
- Sync status indicators.

## Customer Booking Experience

Public booking flow:

1. Customer opens `/book/[slug]`.
2. Customer selects a meeting type.
3. Customer selects a date.
4. OrbitOne shows only available slots.
5. Busy/unavailable slots are hidden or disabled.
6. Customer selects a slot.
7. OrbitOne performs a final conflict check.
8. Customer enters details.
9. OrbitOne confirms booking.
10. OrbitOne creates an internal calendar event.
11. OrbitOne syncs the event to connected external calendar providers.

## Data Model Additions

Add tables:

- `calendar_events`
- `calendar_event_attendees`
- `calendar_busy_blocks`
- `calendar_blocks`
- `calendar_sync_logs`
- `calendar_sync_cursors`
- `calendar_provider_events`
- `calendar_settings`

Recommended event types:

- `booking`
- `manual_event`
- `busy_block`
- `time_off`
- `external_busy`

Recommended event fields:

- Owner user ID.
- Title.
- Description.
- Start time.
- End time.
- Timezone.
- Event type.
- Source provider.
- Linked booking ID.
- Linked connection ID.
- Linked event ID.
- External provider event ID.
- Visibility.
- Status.

## Backend Build Phases

### Phase C1: Internal Calendar Foundation

Build:

- Calendar event schema.
- Busy block schema.
- Calendar settings.
- Internal calendar APIs.
- Conflict detection against OrbitOne events and bookings.
- Shared TypeScript contracts.

APIs:

```http
GET    /api/v1/calendar/events?from=&to=
POST   /api/v1/calendar/events
PUT    /api/v1/calendar/events/:id
DELETE /api/v1/calendar/events/:id

GET    /api/v1/calendar/blocks?from=&to=
POST   /api/v1/calendar/blocks
DELETE /api/v1/calendar/blocks/:id

GET    /api/v1/calendar/settings
PUT    /api/v1/calendar/settings
```

### Phase C2: Interactive Calendar Frontend

Build:

- Dashboard calendar route.
- Month/week/day views.
- Calendar event cards.
- Create manual event modal.
- Create busy block modal.
- View booking details from calendar.
- Empty/loading/error states.
- Mobile-friendly agenda view.

Route:

```http
/dashboard/calendar
```

### Phase C3: External Busy-Time Sync

Build:

- Shared provider interface.
- Google free/busy provider.
- Zoho busy-time provider.
- Microsoft busy-time provider later.
- Background sync job structure.
- Sync logs.
- Sync error handling.

Provider functions:

```ts
getBusyTimes(userId, from, to)
refreshToken(account)
syncBusyTimes(account, from, to)
```

### Phase C4: Slot Engine Upgrade

Upgrade public booking slot engine to merge:

- Weekly availability.
- Availability exceptions.
- OrbitOne calendar events.
- OrbitOne busy blocks.
- Existing OrbitOne bookings.
- Synced external busy blocks.
- Final real-time external provider check.

### Phase C5: External Event Sync

Build:

- Create external event after booking confirmation.
- Update external event after reschedule.
- Cancel external event after cancellation.
- Store external provider event IDs.
- Retry failed syncs.

### Phase C6: Notifications And Reminders

Build:

- Booking confirmation email.
- Booking cancellation email.
- Booking reminder email.
- Host notification.
- Guest notification.
- In-app notification center later.

### Phase C7: Team Calendar Later

Build later:

- Team availability.
- Round-robin booking.
- Collective meetings.
- Shared company calendar.
- Admin calendar visibility.

## Frontend UX Options

Recommended calendar UI options:

- Calendar grid for desktop.
- Agenda view for mobile.
- Provider filter.
- Event type filter.
- Color chips for event types.
- Quick actions:
  - Add event.
  - Block time.
  - Set availability.
  - Connect calendar.
- Calendar sync health banner.

## Advanced Options Later

Future enhancements:

- Approval-required bookings.
- Meeting polls.
- Custom booking questions.
- No-show tracking.
- Meeting outcome notes.
- Auto-create CRM follow-up after meeting.
- Paid appointments.
- WhatsApp reminders.
- Team round-robin.
- AI follow-up suggestions.

## Definition Of Done

Interactive Calendar is done when:

- User can view OrbitOne bookings on a calendar.
- User can create and remove internal busy blocks.
- User can create internal calendar events.
- Customer booking pages show only available slots.
- OrbitOne bookings block future slots.
- External busy times block booking slots when provider is connected.
- Booking confirmation creates an OrbitOne calendar event.
- Booking confirmation syncs to connected external calendar.
- Cancellation removes or cancels synced external event.
- Reschedule updates synced external event.
- Dashboard calendar works on desktop and mobile.
- Backend typecheck passes.
- Frontend lint/build passes.
- Docker stack runs.
- Final end-to-end booking QA passes.

