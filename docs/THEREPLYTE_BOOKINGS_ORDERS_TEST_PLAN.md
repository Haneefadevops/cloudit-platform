# TheReplyte Bookings & Orders — Test Playbook

Test plan for the bookings & orders modules (Phases 1–4 of
`docs/THEREPLYTE_BOOKINGS_ORDERS_PLAN.md`). Run this after every deployment that
touches these modules, before enabling them for a real client.

Dashboard: `https://app.thereplyte.com` · API: `https://api.thereplyte.com`

## 0. Deployment verification

- `curl https://api.thereplyte.com/api/health` returns `{"status":"ok"}`.
  The container runs `prisma migrate deploy` before starting the app, so a
  healthy API also means all migrations applied cleanly. If the API is down or
  crash-looping, check the container logs for a migration error first.
- Dashboard loads and login works.

## 1. Enable modules

1. Dashboard → **Clients** → select the test client (e.g. CloudIT).
2. In the **Modules** section: enable **bookings** and **orders**.
   - Approval mode: ON (default, cautious).
   - Reminder hours: 24 (0/empty disables reminders).
   - Delivery + pickup: ON.
3. Confirm the **Services**, **Bookings**, **Catalog**, **Orders** links appear
   in the left nav.

## 2. Set up booking data

1. **Services** page → add a service:
   - Name `Consultation`, duration `30` minutes, any price.
   - Leave requires-confirmation OFF (approval mode already covers it).
2. Add staff: name `Test Staff`, weekly hours e.g. 09:00–17:00 for today and
   tomorrow.

## 3. Playground — bookings (critical test)

1. **Playground** → select the client → send:
   `Can I book a consultation tomorrow at 2pm?`
2. Expected: AI offers a real slot; the executed action JSON
   (`check_availability`) is visible below the reply.
3. Reply: `yes confirm`
   - Expected: `create_booking` action executes; because approval mode is ON,
     the AI says a team member will confirm (NOT "booked").
4. **Bookings** page → the booking appears as **pending** → click **Confirm**.
5. Expected: status flips to `confirmed`. (In a real WhatsApp conversation the
   customer would receive the confirmation message/template.)

Also verify in the playground that a second booking for the same slot is
refused and nearby free slots are offered instead (availability engine
subtracts existing bookings).

## 4. Playground — orders

1. **Catalog** page → add two products:
   - `Chicken Kottu` — Rs. 850
   - `Lime Juice` — Rs. 250
2. **Playground** → send: `I want 2 chicken kottu and a lime juice`
   - Expected: AI quotes **Rs. 1,950**. This total must come from backend math
     (visible in the action result), not from the AI guessing.
3. When asked, answer: `delivery, 45 Galle Road`
   - Expected: `set_order_details` action; order moves to pending.
4. Confirm the order.
   - Expected: staff notification (Chatwoot, when connected) and the order
     appears on the **Orders** page.
5. **Orders** page → advance the pipeline: confirmed → preparing →
   out_for_delivery → completed.
   - Optional: status changes can auto-message the customer on WhatsApp in real
     conversations.

## 5. Negative tests (must not hallucinate)

- Playground: `book tomorrow at 3am` → must refuse and offer real slots within
  staff hours (availability engine, not AI politeness).
- Playground: `order 5 beef lasagna` (not in catalog) → must say it is
  unavailable / offer alternatives; must NOT invent a price.
- Playground: mark `Lime Juice` as unavailable in Catalog, then order it →
  must be rejected with the real catalog fed back to the AI.

## 6. Reminders (optional, slower)

- Set the client's reminder hours to a small window (e.g. 1) and create a
  confirmed booking starting within that window.
- The reminder job runs every 15 minutes; the customer receives a WhatsApp
  reminder ("Reply R to reschedule or C to cancel") and the booking's
  `reminderSentAt` is stamped (reminds exactly once).

## 7. Real WhatsApp end-to-end (final gate)

Only after steps 1–5 pass. The playground deliberately skips the real Meta
send path and Chatwoot side effects, so this is the only full-stack test.

1. From your own phone, message the bot's WhatsApp number.
2. Run the booking flow: ask for a slot → confirm → receive the approval-mode
   reply.
3. In the dashboard, confirm the pending booking → the confirmation message
   must arrive on your phone.
4. Check Chatwoot: the handoff conversation exists with full history + staff
   notification.
5. Repeat a short order flow (2 items → address → confirm) and verify the
   staff notification arrives.

## Pass criteria

- All playground actions show real backend results (slots, totals, statuses).
- No invented prices, slots, or confirmations in any reply.
- Approval-mode bookings never auto-confirm.
- Real WhatsApp flow delivers messages both directions and creates the
  Chatwoot handoff.

## If something fails

- API down after deploy → container logs, migration error (offline-generated
  migrations are the prime suspect).
- AI answers but no action executes → check the module flags are ON for the
  selected client; the action whitelist is module-scoped.
- Action executes but reply ignores the result → prompt/contract issue in
  `ai.service.ts`; check the action result stored in the message's
  `kimiMetadata` (visible via the playground debug output).
- WhatsApp sends fail → check the client's Meta access token / phone number ID
  and the API logs for the sender service.
