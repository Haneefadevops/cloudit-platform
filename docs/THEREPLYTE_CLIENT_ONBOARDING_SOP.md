# TheReplyte — Client Onboarding SOP (A to Z)

The complete procedure for onboarding a new client onto TheReplyte, from
collecting their details to a trained, live client. Follow the stages in
order; check off each step. Typical total time: 2–4 hours of work spread
over 1–3 days (some steps wait on the client or Meta).

**Roles:** CloudIT staff = you/your team. Client = the business being onboarded.

**Related docs:**
- `docs/THEREPLYTE_CHATWOOT_USER_MANUAL.md` (Part B = the client training handout)
- `docs/THEREPLYTE_BOOKINGS_ORDERS_TEST_PLAN.md` (testing details)
- `docs/THEREPLYTE_MESSENGER_INSTAGRAM_SETUP.md` (Messenger & Instagram platform setup and Chatwoot inboxes)

---

## STAGE 0 — Before you start (collect from the client)

Get everything in this list BEFORE touching any system. A WhatsApp message
or simple form to the client works.

- [ ] Business name (exactly as customers know it)
- [ ] Industry/type (clinic, salon, restaurant, shop, education, real estate, other)
- [ ] Website URL (used for the AI knowledge base crawl)
- [ ] Timezone and business hours (open/close times + closed days)
- [ ] Preferred language(s) of their customers
- [ ] Owner's email (becomes the Chatwoot + portal admin login)
- [ ] Owner's phone number
- [ ] **Channels to enable** — WhatsApp, Messenger, Instagram, or any combination
  - WhatsApp: see the WhatsApp number details below.
  - Messenger: the client's **Facebook Page name** and **Page ID** (or Page URL).
  - Instagram: the client's **Instagram account handle** and **Account ID** (must be a professional/creator account linked to the Facebook Page above).
- [ ] The WhatsApp number for the bot (if WhatsApp is enabled):
  - **Option A — their existing WhatsApp Business app number** (migrates to
    the Cloud API; the app on their phone stops working for that number —
    explain this clearly and get explicit approval), or
  - **Option B — a new number** (their app stays untouched; recommended for
    hesitant clients / trials)
- [ ] Decision: which modules — **bookings**, **orders**, or both
- [ ] Decision: plan — Starter (500 conversations/mo) or Business (1,500/mo)
- [ ] Their services + prices + staff names (bookings) OR product catalog
    with prices (orders) — whatever format they have; you'll enter it later
- [ ] 5–10 real FAQs customers ask them (for the knowledge base)
- [ ] Signed agreement / payment for setup fee + first month

**Explain to the client at this stage (set expectations):**
- Same WhatsApp number, customers notice nothing.
- The phone app is replaced by a team inbox (Chatwoot) where the AI and
  their staff work together.
- Their old chat history stays backed up on their phone, restorable anytime.
- Messenger and Instagram conversations live in the same Chatwoot inbox as
  WhatsApp; staff reply from one place.
- A customer who contacts them through multiple channels is treated as
  separate customers per channel for now.

---

## STAGE 1 — Meta setup

Done by CloudIT staff, with the client where noted. Everything happens in
two Meta websites: **business.facebook.com** (business management) and
**developers.facebook.com** (the API app). Work inside the CLIENT's Meta
Business Portfolio — if they don't have one, create it with them in step
1.1 (needs their Facebook login).

Skip the sub-sections below for any channel the client is not using.

### 1.1 Create/confirm the Meta Business Portfolio

1. Go to `business.facebook.com` → log in with the client's Facebook
   account (or yours, if CloudIT manages their Meta assets).
2. If no business exists: **Create account** → enter the business name
   (must match their real branding), your name, and the business email →
   confirm the email verification Meta sends.
3. You now have a "Business Portfolio" — the container that will hold the
   WhatsApp account, phone number, and (optionally) the Facebook page.

### 1.2 Create the Meta Developer account + app

1. Go to `developers.facebook.com` → log in with the same Facebook account
   → accept the developer terms if prompted ("Get Started").
2. **My Apps → Create App**.
3. Use case: choose **"Other"** → app type: **"Business"**.
4. Name it (e.g. "CloudIT WhatsApp" or the client's name), set the contact
   email, and **link the Business Portfolio** from 1.1 → Create app.

### 1A — WhatsApp setup

Do this only if WhatsApp is enabled in Stage 0.

### 1.3 Add the WhatsApp product

1. Inside the app dashboard, find **WhatsApp** in the product list →
   **Set up**.
2. Meta asks which Business Portfolio to use → pick the one from 1.1.
   Meta creates a **WhatsApp Business Account (WABA)** automatically.
3. You land on **WhatsApp → API Setup**. Meta gives you a free **test
   number** — ignore it for production (it only messages 5 recipients);
   we add the real number next.

### 1.4 Add the client's phone number

1. On the API Setup page → **Add phone number** (under "Step 1: Select
   phone numbers" or the "Add number" area).
2. Enter the **display name** — this is what customers see in the profile.
   Rules: must clearly relate to the business, match public branding
   (Facebook page / website / shop signage), no generic terms. Meta
   reviews it.
3. Enter the phone number with country code (e.g. +9477XXXXXXX).
4. Verify ownership: Meta sends an **OTP via SMS or voice call** to that
   number → enter the code.
   - **Existing WhatsApp Business app number:** entering it here MIGRATES
     it to the Cloud API — the app on the client's phone logs out
     permanently (history stays in their phone backup). Confirm the client
     understood this in Stage 0 before pressing verify.
   - **New number:** needs a live SIM/eSIM able to receive the OTP.
5. Back on API Setup, note the two IDs shown under the number:
   - **Phone Number ID** (long numeric ID — this is what TheReplyte needs)
   - **WhatsApp Business Account ID** (WABA ID — for reference)

### 1.5 Generate the permanent access token

The token shown on API Setup expires in 24 hours — never use it. Create a
permanent one:

1. Go to `business.facebook.com/settings` (Business Settings of the
   portfolio).
2. **Users → System Users → Add** → name it (e.g. "thereplyte-api") →
   role: **Admin** → Create.
3. Select the system user → **Add Assets → Apps** → select the app from
   1.2 → enable **Full control** → Save.
4. Click **Generate New Token** → select the app → in permissions, tick
   **whatsapp_business_messaging** and **whatsapp_business_management** →
   Generate.
5. **Copy the token immediately** — Meta shows it once. Store it in your
   password manager; it goes into TheReplyte in Stage 2.

### 1.6 Set the WhatsApp profile

1. Open WhatsApp Manager: `business.facebook.com/wa/manage/home/`.
2. Select the phone number → **gear icon → Profile**.
3. Upload the profile photo (client logo, square, min 192×192), fill About,
   description, address, email, website, category → Save. This is what
   customers see when they tap the business profile.

### 1.7 The webhook comes LATER (Stage 2.5)

The webhook needs the verify token from TheReplyte, which exists only
after the client is created in the dashboard. Do it in Stage 2.5 — then
return to **App dashboard → WhatsApp → Configuration** to set it.

### 1.8 (Optional, later) Business verification

Needed for: business name showing in the chat header (instead of the raw
number), more than 250 business-initiated messages/day, more than 2
numbers, green-badge eligibility. NOT needed to go live.

- Path: Business Settings → **Security Centre → Business verification →
  Start** → legal business details + documents (business registration,
  bank statement or utility bill showing the business name and phone
  number, dated within 3 months). Name on documents must EXACTLY match
  the business details entered.
- Clients without registration: home businesses can run unverified
  indefinitely (name shows in the profile view), register a simple sole
  proprietorship, or use paid Meta Verified (verifies owner ID + brand
  presence, no company papers).

### 1.9 Message templates in the CLIENT's WABA (required for reminders)

Message templates belong to each WABA — templates created in CloudIT's
account do NOT work for client numbers. For clients using bookings/orders
notifications (reminders, status updates outside the 24-hour window),
recreate the 4 utility templates in the client's WABA
(WhatsApp Manager → Account tools → Message templates → Create → Utility):

- `booking_reminder` — "Reminder from {{1}}: your {{2}} is scheduled for
  {{3}}. Reply R to reschedule or C to cancel."
- `booking_confirmed` — "Confirmed: your {{1}} on {{2}}. We look forward
  to seeing you!"
- `order_update` — "Update on your order {{1}}: {{2}}. Thank you for
  shopping with us."
- `general_followup` — "Hello {{1}}, this is {{2}}. Update on your recent
  request: {{3}}. If you have any questions, just reply to this message
  and our team will help you."

Meta category rules: Utility must reference an existing order or account —
generic "we're here to help" bodies get forced to Marketing (wrong tool:
higher cost, opt-out rules). Also keep bodies a full sentence or two with
several variables, and never end the body with a variable.

Use the client's business name in the samples. Identical utility templates
usually approve quickly. Skip this step for clients who don't need
out-of-window notifications yet.

**Checkpoint:** you hold three values — **Phone Number ID**, **permanent
access token**, **the WhatsApp number itself** — plus the profile is set.

### 1B — Messenger & Instagram platform setup

Do this only if Messenger or Instagram is enabled in Stage 0. The platform-level
Meta app configuration is the same for every client; per-client Page/account
connection happens later in Chatwoot (Stage 2.4).

1. In the same Meta Developer app from 1.2, add the **Messenger** and
   **Instagram** products if they are not already present.
2. Request the permissions `pages_messaging`, `pages_manage_metadata`, and
   `instagram_manage_messages`.
3. Confirm the client's Instagram account is a professional/creator account
   linked to the Facebook Page collected in Stage 0.
4. For production use with business accounts, Meta App Review approval is
   required for the messaging permissions.

For the full platform-level steps, webhook URLs, and environment variables,
see `docs/THEREPLYTE_MESSENGER_INSTAGRAM_SETUP.md`.

**Checkpoint:** Messenger and Instagram products are added to the Meta app and
permission requests are submitted.

---

## STAGE 2 — TheReplyte onboarding (app.thereplyte.com)

This is the staff-driven setup: YOUR team does everything in the dashboard;
the client never touches any of it. They receive logins and training at the
end (Stage 7). Below is the exact click-by-click procedure.

### 2.1 Log in and open the client form

1. Go to `https://app.thereplyte.com` → log in with your staff admin account.
2. Left nav → **Clients** → click **Add Client** (top right).
3. The onboarding form has numbered sections — fill them in order:

**Section 1 — Business Information**
- **Company / brand name** — exactly as customers know it (becomes the
  Chatwoot account name and the AI's identity)
- **Industry / business type** — clinic, salon, restaurant, shop, etc.
  (drives tone and defaults)
- **Website** — full URL; used for the knowledge-base crawl in Stage 3
- **Timezone** — e.g. `Asia/Colombo`; drives operating hours and reminders
- **Default language** — the business's main language (the AI still
  auto-detects and replies in the customer's language)

**Section 2 — Contact & Access**
- **Primary admin email** — the owner's email. IMPORTANT: this becomes
  their Chatwoot admin login AND their portal login later, so use the
  owner's real email, not a generic one
- **Primary admin phone** — owner's mobile (recovery and alerts)

**Section 3 — Channels**

Select the channels the client wants. Each channel exposes its own fields below.
- **WhatsApp enabled**
- **Messenger enabled**
- **Instagram enabled**

**Section 4 — WhatsApp Configuration** (only when WhatsApp is enabled)
- **WhatsApp Business number** — with country code, e.g. +9477XXXXXXX
- **WhatsApp Phone Number ID** — the long numeric ID from Meta API Setup
  (NOT the phone number)
- **Meta access token** — the PERMANENT system-user token from Stage 1A
  (never the 24-hour temporary token)

**Section 5 — Messenger & Instagram Configuration** (only when Messenger or
Instagram is enabled)
- **Facebook Page ID** — numeric ID of the Facebook Page (for Messenger)
- **Facebook Page access token** — page-scoped token if available; optional
  for the dashboard, required only if the API posts back to the Page
- **Instagram Account ID** — numeric ID of the Instagram professional account
  (for Instagram)

Leave these blank if the client is WhatsApp-only.

**Section 6 — AI Behavior** (defaults are safe; refined in Stage 3)
- **Business description** — 2–3 lines about the business
- **Welcome message** — first message to new customers
- **Fallback message** — sent when the AI can't answer / hands off
- **Handoff keywords** — comma-separated triggers for human transfer
  (add industry words: "refund, complaint" for shops; "emergency, pain"
  for clinics)
- **Operating hours** — open/close times + closed days (drives the
  after-hours message and handoff)

**Section 7 — Modules**
- **Bookings enabled** — on for appointments businesses (clinics, salons,
  consultants). When on, also set:
  - **Approval mode** — keep ON (every booking waits for staff confirm;
    flip to auto later once the client trusts the AI)
  - **Reminder hours** — 24 for clinics, 2 for salons, 0 to disable
  - **Booking confirmation template** — optional custom wording
- **Orders enabled** — on for shops/restaurants. When on, also set:
  - **Delivery / pickup toggles** — match what the business offers
  - **Payment instructions** — e.g. "cash on delivery" or bank details
  - **Order confirmation template** — optional custom wording
- **Plan allowance** — conversations per month: **500** (Starter) or
  **1500** (Business)
- **Usage period start** — leave as default (today) unless aligning to a
  specific billing date

4. Click **Save / Create Client**. The client card appears on the Clients page.

### 2.2 Run Chatwoot Setup (the automatic wiring)

1. On the new client card, click the **Chatwoot Setup** action.
2. Wait for it to finish. It automatically:
   - Creates the client's **Chatwoot account** (named after the business)
   - Creates the **WhatsApp inbox** inside it
   - Registers the **webhook** back to TheReplyte (agent replies reach
     WhatsApp automatically)
   - Seeds default labels (`ai-handoff`, `urgent`, `complaint`)
   - Creates the **client admin user** (the Section 2 email) and
     auto-confirms it — no email verification needed
3. Verify the card now shows **"Chatwoot connected • Account # (name)"**.
   If it errors, check the server logs before retrying.

### 2.3 Connect the Meta webhook (WhatsApp only)

Skip this if the client is not using WhatsApp.

1. On the client card, click **Meta Setup** — it shows two values:
   the **Callback URL** (`https://api.thereplyte.com/api/webhooks/whatsapp`)
   and this client's **Verify token**.
2. In the Meta Developer app (from Stage 1): **WhatsApp → Configuration →
   Webhook → Edit** → paste the callback URL and verify token →
   **Verify and save**.
3. In the same Configuration page → **Webhook fields** → subscribe to
   **messages** (this is the step everyone forgets — without it Meta never
   sends anything).
4. Test: send any WhatsApp message from your phone to the client's number.
   Back on the client card, click **Refresh Status** — the Meta status
   should show active with a recent "last webhook" time.

### 2.4 Add Messenger & Instagram inboxes (Messenger/Instagram only)

Skip this if the client is not using Messenger or Instagram.

1. Open the client's Chatwoot account at `https://inbox.thereplyte.com`.
2. Go to **Settings → Inboxes → Add Inbox**.
3. Select **Facebook** to connect the client's Facebook Page (Messenger) or
   **Instagram** to connect the professional Instagram account.
4. Complete the OAuth flow and confirm the inbox is connected.
5. Repeat for each enabled channel.
6. Copy the connected **Facebook Page ID** and/or **Instagram Account ID**
   back into the client card in the dashboard if they were not entered earlier.

For the full runbook, see `docs/THEREPLYTE_MESSENGER_INSTAGRAM_SETUP.md`.

**Checkpoint:** a message on each enabled channel reaches TheReplyte
(customer + conversation created, AI replies on that channel).

---

## STAGE 3 — AI configuration (make it sound like the client's business)

Dashboard → **AI Settings** (select the client):

- [ ] **3.1 System prompt** — write/paste the client's persona: who the
      business is, what it does, how to talk, what to never invent, when to
      hand off. (Use the CloudIT/Nova prompt in `docs` as the reference
      style: identity → role → HOW TO TALK rules → what to do.)
      Always include the standard "handoff offer" block so the AI opens a
      support ticket instead of improvising on problems it can't fix:

      ```
      If a customer reports a problem you cannot resolve directly (damaged
      item, wrong order, billing dispute, complaint), do not try to fix it
      yourself. Offer to connect them with our team, e.g. "Shall I get our
      team to look into this for you?" — and if they agree, hand off to a
      human.
      ```

      When a handoff happens, the customer automatically receives a ticket
      reference (TK-XXXXX) on the channel they are using, and the resolved
      ticket is stored under Dashboard → **Support** (Support History).
- [ ] **3.2 Temperature** — 0.3–0.5 for most businesses (consistent, not
      creative).
- [ ] **3.3 Messages** — welcome message, fallback message, outside-hours
      message, handoff keywords (add industry words: "refund, complaint"
      for shops; "emergency, pain" for clinics).
- [ ] **3.4 Operating hours + closed days + timezone** — drives after-hours
      handoffs.
- [ ] **3.5 CSAT** — enable; adjust the rating message wording if wanted.

Dashboard → **Knowledge Base** (select the client):

- [ ] **3.6 Crawl the client's website** (Crawl Website tool).
- [ ] **3.7 Upload documents** — price lists, menus, policies (PDF/DOCX/TXT).
- [ ] **3.8 Add the FAQs** from Stage 0 as text entries (question + answer).

Dashboard → **Canned Responses**:

- [ ] **3.9 Create 5–8 templates** their agents will need: greeting,
      business hours, location/directions, payment/bank details, delivery
      info, booking confirmation, closing. Use the `{{customer_name}}`
      variables.

**If bookings enabled** — Dashboard → **Services**:
- [ ] **3.10 Add each service** (name, duration, price, intake questions
      like "party size?" or "first visit?").
- [ ] **3.11 Add staff** and set real weekly working hours. No staff hours
      = the AI can never offer a slot.

**If orders enabled** — Dashboard → **Catalog**:
- [ ] **3.12 Add products** with prices, categories, options (size/flavor
      with price differences), and mark out-of-stock items unavailable.

---

## STAGE 4 — Chatwoot & team setup (inbox.thereplyte.com)

- [ ] **4.1 Client admin password** — the owner goes to inbox.thereplyte.com
      → Forgot password → sets it via the Zoho-delivered email. (The
      account itself was auto-created in 2.4.)
- [ ] **4.2 Auto-assignment** — Settings → Inboxes → the WhatsApp inbox →
      enable **Auto Assignment** (new handoffs round-robin to online agents).
- [ ] **4.3 Agents** — Settings → Agents → add the client's staff (role:
      Agent; Administrator only for owner/manager). Invitation emails now
      work via Zoho SMTP.
- [ ] **4.4 Availability training note** — every agent must set themselves
      Online/Offline from the profile menu; auto-assignment only targets
      online agents.
- [ ] **4.5 Notifications** — have each agent enable browser notifications
      in Profile Settings; suggest the Chatwoot mobile app.

---

## STAGE 5 — Testing (never skip)

Follow `docs/THEREPLYTE_BOOKINGS_ORDERS_TEST_PLAN.md`. Minimum:

- [ ] **5.1 Playground Q&A** — ask 5 real customer questions; answers must
      come from the knowledge base, in the right language, short and natural.
- [ ] **5.2 Playground bookings** (if enabled) — "book tomorrow 2pm" → real
      slot offered → confirm → appears as pending in **Bookings** → approve
      it. Try a taken/closed slot → AI must offer alternatives, never invent.
- [ ] **5.3 Playground orders** (if enabled) — order 2 items → backend total
      (check the math!) → address → confirm → appears in **Orders** →
      advance the pipeline.
- [ ] **5.4 Real WhatsApp** (if enabled) — from your own phone: greeting →
      question → booking or order → ask for a human → verify the handoff lands
      in Chatwoot with summary + labels → agent replies from Chatwoot →
      customer receives it → Resolve → CSAT request arrives once.
- [ ] **5.5 Real Messenger** (if enabled) — from a test Facebook account:
      message the client's Page → greeting → question → ask for a human →
      handoff lands in the Facebook inbox in Chatwoot → agent reply reaches
      the test user.
- [ ] **5.6 Real Instagram** (if enabled) — from a test Instagram account:
      direct-message the client's professional account → greeting → question →
      ask for a human → handoff lands in the Instagram inbox in Chatwoot →
      agent reply reaches the test user.
- [ ] **5.7 Wallet** — confirm the plan allowance shows on the client card
      and the portal usage card matches.

---

## STAGE 6 — Client portal & wallet

- [ ] **6.1 Portal login** — Clients page → Portal access → create the
      owner's login (email + temp password). Send it securely.
- [ ] **6.2 Walk the owner through the portal**: Bookings (calendar),
      Orders (pipeline), Analytics (date filters, AI resolution rate),
      Usage card (conversations left), top-up request flow.
- [ ] **6.3 Bank details** — confirm TOPUP_BANK_DETAILS on the server is
      correct before the client ever needs a top-up.

---

## STAGE 7 — Client training (45–60 min call or visit)

Give them Part B of `docs/THEREPLYTE_CHATWOOT_USER_MANUAL.md` as the
handout. Cover live:

- [ ] **7.1 The daily routine** — log in, set Online, check Mine, reply,
      Resolve. Resolve = customer gets the rating request.
- [ ] **7.2 Handoffs** — what `ai-handoff`, `urgent`, `after-hours` labels
      mean and who takes which.
- [ ] **7.3 Canned responses** — type `/` for templates.
- [ ] **7.4 Bookings/orders management** — approving pending bookings,
      advancing order statuses (each advance messages the customer).
- [ ] **7.5 The portal** — calendar, analytics, usage, top-ups.
- [ ] **7.6 What to tell CloudIT** — wrong AI answers (send us the example;
      we fix the knowledge base), new services/products, staff changes.
- [ ] **7.7 House rules** — never promise what the business can't deliver;
      the AI only knows what's in the knowledge base — keep it updated via
      CloudIT.

---

## STAGE 8 — Go-live checklist & handover

- [ ] Meta webhook active (Meta Setup shows recent activity)
- [ ] AI answering real customers end-to-end
- [ ] Handoffs reaching the right agents (auto-assignment works)
- [ ] Bookings/orders tested with a real transaction and approved
- [ ] Portal login working for the owner
- [ ] Agents trained, statuses Online, notifications on
- [ ] Business verification with Meta scheduled (if client wants the name
      in chat headers / higher limits)
- [ ] First-week check-in booked (day 3 and day 7): review analytics
      together — conversations, AI resolution rate, CSAT, any fallbacks to
      add to the knowledge base
- [ ] Invoice: setup fee + monthly plan noted; renewal date recorded

**Onboarding complete.** Ongoing: weekly analytics check for the first
month, knowledge base updates on request, top-up approvals as they come in.

---

## Common onboarding problems (quick answers)

| Problem | Cause | Fix |
|---|---|---|
| Webhook not receiving | Wrong callback URL/verify token in Meta, or messages field not subscribed | Redo step 2.5 exactly |
| Client admin can't log in | Password never set | Forgot password on the login page (Zoho email) |
| Agent invite not arriving | Spam folder, or SMTP issue | Check spam; verify Zoho SMTP logs |
| AI says "no slots available" for everything | No staff hours set | Stage 3.11 — set real weekly hours |
| AI invents answers | Missing knowledge base content | Add the topic to Knowledge Base; lower temperature |
| Handoffs sit unanswered | No agents Online, or auto-assignment off | Stage 4.2 + 4.4 |
| Migration panic from client | Existing app number logged out | Expected — Stage 0 explained this; chats now live in Chatwoot |
