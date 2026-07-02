# Hospitality OS — Product Plan for Sri Lanka

> Status: **PLANNING** — implementation not started.  
> Last updated: 2026-06-29

---

## 1. What is Hospitality OS?

**Hospitality OS** is a cloud-based hotel management system (also called a Property Management System, or PMS).

It helps small and medium hotels, guesthouses, villas, and homestays in Sri Lanka manage their daily operations from one dashboard.

Think of it like this:

- Instead of using Excel, WhatsApp, and a paper diary, a hotel owner or receptionist can log into a website and manage everything digitally.
- Guests can be checked in and checked out.
- Rooms and prices can be updated.
- Invoices can be printed or emailed with correct Sri Lankan taxes.
- Owners can see how much money the hotel made today, this week, or this month.

### Simple example workflow

1. A guest calls and asks for a room on 15 July.
2. The receptionist opens Hospitality OS, sees which rooms are free, and creates a reservation.
3. On 15 July, the guest arrives. The receptionist clicks **Check-in**.
4. During the stay, extra charges (laundry, food, spa) are added to the guest bill.
5. On 17 July, the guest checks out. The system creates an invoice with taxes and service charges.
6. The owner opens the reports page and sees the revenue.

---

## 2. Why Sri Lanka?

Sri Lanka has a large tourism and hospitality industry:

- Hotels, boutique villas, guesthouses, homestays, and eco-lodges across the country.
- Many small properties still use manual booking diaries or simple spreadsheets.
- International PMS tools (like Cloudbeds or Hotelogix) are often too expensive or complex for small Sri Lankan properties.
- Local tax rules are specific: Service Charge, TDL, SSCL, VAT.

This means there is space for a **simple, affordable, Sri Lanka-focused Hospitality OS**.

### Target customers

| Customer type | Typical size | Needs |
|---|---|---|
| Boutique villas | 5–20 rooms | Reservations, invoices, guest history, reports |
| Guest houses | 5–15 rooms | Simple booking diary, check-in/out, billing |
| Homestays | 2–10 rooms | Easy calendar, WhatsApp/SMS alerts, basic reports |
| Small hotels | 10–50 rooms | Full PMS: rooms, rates, housekeeping, taxes, reports |
| Medium hotels | 50+ rooms | Multi-user roles, channel manager, POS integration |

---

## 3. Core Modules

These are the main features of Hospitality OS.

| Module | What it does | Why it matters |
|---|---|---|
| **Properties** | Add one or more hotel properties | Some owners run multiple villas |
| **Room Types** | Define categories: Deluxe, Suite, Standard, Family | Set prices and descriptions by category |
| **Rooms** | Manage individual rooms, status, cleaning | Know which room is free, occupied, or dirty |
| **Guests** | Store guest details, contact, NIC/passport | Required for government reporting and marketing |
| **Reservations** | Book, modify, cancel reservations | The heart of the PMS |
| **Check-in / Check-out** | Convert reservation to stay, close bill | Daily front-desk work |
| **Invoices** | Create bills with items, taxes, discounts | Get paid and keep records |
| **Taxes** | Auto-apply Service Charge, TDL, SSCL, VAT | Stay compliant with Sri Lankan tax rules |
| **Reports** | Occupancy, revenue, tax, guest reports | Help owners make decisions |
| **Housekeeping** | Track room cleaning status | Coordinate cleaning staff |
| **Users & Roles** | Owner, manager, receptionist, housekeeping | Control who can do what |
| **Settings** | Currency, tax rules, business info, receipts | Customize per property |

---

## 4. Sri Lanka–Specific Requirements

### 4.1 Currency

- Default currency: **Sri Lankan Rupee (LKR / Rs.)**
- Format: `Rs. 10,000.00`
- Multi-currency support can be added later for properties that bill foreign guests in USD/EUR.

### 4.2 Taxes and charges

A typical Sri Lankan hotel bill has these layers:

| Charge | Rate | Notes |
|---|---|---|
| **Service Charge (SC)** | 10% | Added to guest bill, must be distributed to staff under labour rules. Not hotel revenue. |
| **Tourism Development Levy (TDL)** | 0.5% or 1% | 0.5% if quarterly turnover is below LKR 3 million; 1% if above. |
| **Social Security Contribution Levy (SSCL)** | 2.5% | Only if quarterly turnover is above LKR 60 million. |
| **Value Added Tax (VAT)** | 18% | Standard rate since 1 January 2024. Applied on subtotal + SC + TDL + SSCL. |

The system should allow the hotel to configure which taxes apply, because not every property pays all of them.

### 4.3 Local identification

- Capture guest **NIC** (National Identity Card) or **passport number**.
- Optional foreign guest flag.
- Store emergency contact number (common in Sri Lankan properties).

### 4.4 Mobile-first design

- Many small hotels in Sri Lanka use phones or tablets at the front desk.
- The web app must work well on mobile screens.
- Long-term: a Progressive Web App (PWA) or mobile app for receptionists and housekeeping.

### 4.5 Communication

- **SMS** alerts for bookings and reminders (using a local provider like Twilio, Dialog, or Mobitel API).
- **WhatsApp** messages for confirmations and invoices (using WhatsApp Business API or Meta Cloud API).
- **Email** receipts and reports.

### 4.6 Languages

- Phase 1: English
- Phase 2: Sinhala
- Phase 3: Tamil

### 4.7 Payment methods

- Cash
- Bank transfer
- Card payments via local gateway (e.g. **PayHere**)
- International cards via Stripe (optional)
- Pay-later / credit for corporate guests

---

## 5. How it fits into cloudit-platform

Hospitality OS is one product inside the bigger `cloudit-platform` multi-tenant SaaS platform.

### Architecture

| Layer | Technology | Location in repo |
|---|---|---|
| Web dashboard | Next.js | `apps/hospitality-web` |
| API backend | NestJS + Prisma | `apps/hospitality-api` |
| Database | PostgreSQL | Shared platform Postgres |
| Cache / sessions | Redis | Shared platform Redis |
| Reverse proxy / SSL | Traefik | `infra/traefik` |
| Module gating | Platform API | `apps/platform-api` |

### URLs

| Service | URL |
|---|---|
| Hospitality Web | `https://hospitality.cloudit.lk` |
| Hospitality API | `https://api-hospitality.cloudit.lk` |

Later, if you buy a separate domain, this can become:

| Service | URL |
|---|---|
| Hospitality Web | `https://hospitalityos.com` |
| Hospitality API | `https://api.hospitalityos.com` |

### Multi-tenancy

Each hotel or property group is an **organization** in the platform.

- One owner can have multiple properties under one organization.
- Users log in with their email and password.
- Platform admin can enable/disable modules per organization from `app.cloudit.lk/dashboard/admin/modules`.

### Module gating

Each Hospitality OS module can be turned on or off per customer:

- `properties`
- `room-types`
- `rooms`
- `guests`
- `reservations`
- `invoices`
- `taxes`
- `reports`
- `housekeeping`
- `payments`
- `communications`
- `public-booking`
- `self-service`

This lets you sell different pricing tiers:

| Tier | Modules included | Target |
|---|---|---|
| **Free / Trial** | Properties, Room Types, Rooms, Guests, Reservations | Very small homestays |
| **Basic** | + Invoices, Taxes | Guest houses |
| **Standard** | + Reports, Housekeeping | Small hotels |
| **Professional** | + Payments, Communications, Public Booking, Self-Service | Medium hotels |

---

## 6. Pricing ideas for Sri Lanka

These are starting ideas. Final prices should be decided based on customer interviews.

| Plan | Monthly price (LKR) | Approx. USD | Best for |
|---|---|---|---|
| Free | LKR 0 | $0 | 1 property, up to 5 rooms |
| Basic | LKR 4,900 | ~$16 | 1 property, up to 15 rooms |
| Standard | LKR 9,900 | ~$33 | 1–3 properties, up to 50 rooms |
| Professional | LKR 19,900+ | ~$66+ | Multiple properties, guest portal, online payments |

Optional add-ons:

- SMS/WhatsApp message credits
- Channel manager (Booking.com, Agoda, Airbnb)
- POS integration
- Priority support

---

## 7. Roadmap / Build Phases

### Phase 0 — Foundation and module gating
- Add `ProductModulesModule`, `ModuleGuard`, and `@RequireModule()` to `apps/hospitality-api`.
- Gate each controller by module key.
- Ensure existing features (properties, rooms, guests, reservations, invoices, reports) work correctly.
- Add Hospitality modules to platform admin UI.

### Phase 1 — Sri Lankan localization
- Set default currency to LKR.
- Add date format and number format for Sri Lanka.
- Add NIC/passport fields to guest form.
- Add emergency contact and local phone number fields.
- Add property registration / SLTDA number field.

### Phase 2 — Tax engine
- Build configurable tax rules.
- Add default presets: Service Charge 10%, TDL 0.5%/1%, SSCL 2.5%, VAT 18%.
- Apply taxes correctly to invoices.
- Show tax breakdown on invoice preview and print.
- Add TDL report for quarterly SLTDA filing.

### Phase 3 — Reports and dashboards
- Occupancy report.
- Revenue report.
- Guest source report.
- Tax summary report.
- Dashboard with today’s check-ins, check-outs, and available rooms.

### Phase 4 — Communication
- Email invoice to guest.
- SMS booking confirmation.
- WhatsApp checkout summary.
- Daily summary email to owner.

### Phase 5 — Payments
- Cash and bank transfer recording.
- PayHere integration for card payments.
- Stripe integration for international cards.
- Partial payments and deposits.

### Phase 6 — Operations
- Housekeeping module.
- User roles and permissions.
- Multi-property support improvements.
- Seasonal pricing and promotions.

### Phase 7 — Guest-facing booking portal and self-service ✅ COMPLETED

Build Option A: public routes inside `apps/hospitality-web` with secure guest tokens.

**Route groups:**
- `(dashboard)/` — staff-only pages, protected by `middleware.ts`.
- `(public)/` — guest-facing pages, no login required.

**Public pages:**
- `/book/[propertySlug]` — property listing with room search.
- `/book/[propertySlug]/checkout` — guest details + payment.
- `/guest/[token]` — guest portal (booking summary).
- `/guest/[token]/checkin` — self check-in.
- `/guest/[token]/checkout` — self check-out + final bill.

**Public API endpoints:**
- `GET /public/properties/:slug` — public property info.
- `POST /public/availability` — search available rooms by dates.
- `POST /public/bookings` — create a guest booking.
- `GET /public/bookings/:token` — view booking by secure token.
- `POST /public/bookings/:token/checkin` — self check-in.
- `POST /public/bookings/:token/checkout` — self check-out.
- `POST /public/payments/intent` — create PayHere/Stripe payment intent.

**Database changes:**
- Add `publicSlug` to `Property` model.
- Add `guestToken` to `Reservation` model (random, unique, expires).
- Add `guestPortalEnabled` to `Property` settings.

**Security:**
- `middleware.ts` blocks unauthenticated users from `(dashboard)/`.
- Guest portal uses secure token, not login.
- Public API endpoints return only the data linked to the token.
- Self check-out creates invoice and payment records same as staff checkout.

**Notifications:**
- Booking confirmation email/SMS/WhatsApp includes guest portal link.
- Reminder before check-in.
- Thank-you message after check-out.

**Sub-phases for Codex:**
1. Public property page + room availability search.
2. Public booking creation + confirmation.
3. Secure guest portal + token system.
4. Self check-in flow.
5. Self check-out flow + online payment.

### Phase 8 — Growth integrations (NEXT)
- Booking.com / Agoda channel manager.
- Restaurant POS integration.
- Mobile PWA app.
- Advanced revenue management.

---

## 8. Competitive advantage in Sri Lanka

| Other international PMS | Hospitality OS (our plan) |
|---|---|
| Expensive monthly fees | Affordable, Sri Lanka–friendly pricing |
| Complex setup | Simple onboarding for small properties |
| Generic tax rules | Built-in Sri Lankan tax engine |
| English only | Sinhala + Tamil support planned |
| No local payment support | PayHere, bank transfers, cash |
| No local support | Local timezone, local-language support |

---

## 9. Open questions before building

Answer these so the build can be focused:

1. What is the first type of customer you want to target? (villas, guest houses, hotels, homestays)
2. Do you already have a paying customer waiting, or are we building for future sales?
3. Which payment gateway do you prefer first? (PayHere, Stripe, bank transfer only)
4. Do you need WhatsApp/SMS from day one, or can that come later?
5. Do you want multi-language from day one, or English first?
6. Do you want to buy a separate domain now (`hospitalityos.com`) or stay on `hospitality.cloudit.lk`?
7. ✅ Guest-facing booking page + self check-in/check-out portal will be built in Phase 7.

---

## 10. Next step

Phases 0–7 are complete. When you are ready, the next build task is:

> **Phase 8 — Growth integrations (channel manager, POS, mobile PWA)**
