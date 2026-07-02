# OrbitOne Premium UI Fix Plan

> Focus: make the dashboard SaaS and the public profile feel genuinely premium, not "template-like."  
> Based on the UI walkthrough in `10-18-03.mp4` and the official `BRAND_GUIDELINES.md`.

---

## 1. Goal

Turn the current functional-but-plain UI into a product that feels:

- **Premium** — restrained color, confident spacing, consistent components.
- **Trustworthy** — clear hierarchy, no visual noise, professional empty states.
- **Modern** — subtle depth, refined typography, polished interactions.

The two highest-impact surfaces are:

1. **Dashboard / SaaS backend** — where the user spends daily time.
2. **Public profile** — the shareable digital business card, the product's core deliverable.

We keep the existing official brand palette (`#1A2E26`, `#047857`, `#D97706`, `#FFFBF7`, `#F5F2EE`, `#E7E2DC`, `#1F2937`, `#786B5D`) and the existing `frontend-v2` Vite + React Router stack.

---

## 2. Design Direction: "Restrained Premium"

### Color discipline (light mode)
- Use **Primary `#1A2E26`** for text, sidebar, and strong structure.
- Use **Secondary `#047857`** only for primary CTAs, active toggles, and success states.
- Use **Accent `#D97706`** sparingly for warnings, highlights, and the occasional premium touch (badges, hover accents).
- Background stays warm (`#FFFBF7`), surfaces are `#F5F2EE`, borders are `#E7E2DC`.

### Dark mode palette
- Background: `#0F1A17` (deep forest black)
- Surface: `#1A2E26` (elevated cards, sidebar)
- Surface hover: `#243B32`
- Border: `#2F4A3E`
- Text primary: `#F5F2EE`
- Text secondary: `#A89B8C`
- Primary accent: `#10B981` (muted emerald for CTAs)
- Accent: `#F59E0B` (amber for highlights)
- Shadows are replaced by subtle borders and glows to avoid harsh dark shadows.
- All components must support `dark:` variants via Tailwind or CSS variables.

### Typography
- Inter/system-ui only.
- Strict scale:
  - Page title: `text-2xl font-semibold tracking-tight`
  - Section title: `text-sm font-semibold text-gray-900`
  - Card title: `text-base font-medium`
  - Body: `text-sm text-gray-600`
  - Labels: `text-xs font-medium text-gray-500 uppercase tracking-wide` only where needed.

### Shape and depth
- Cards: `rounded-2xl`, `bg-white`, `border border-[#E7E2DC]`, `shadow-sm`.
- Hover: `shadow-md` + `border-gray-300` transitions.
- Buttons: `rounded-lg`, clear three-tier system (primary solid, secondary outline, tertiary ghost).

### Spacing
- Page padding: `p-6 lg:p-8`.
- Card internal padding: `p-5` or `p-6`.
- Section gap: `gap-6`.
- Resist the urge to fill every pixel; premium needs breathing room.

---

## 3. Dark Mode + Theme System

### 3.1 Theme toggle
- Add a theme toggle in the dashboard header (sun/moon icon).
- Detect system preference on first load (`prefers-color-scheme`).
- Persist user choice in `localStorage`.
- Optional: persist to backend user settings later; for now `localStorage` is enough.

### 3.2 CSS variable approach
- Define colors as CSS variables in `index.css`:
  - `--background`, `--surface`, `--border`, `--text`, `--muted`, `--primary`, `--secondary`, `--accent`.
- Use `data-theme="dark"` on `<html>` and swap variables.
- Tailwind config maps these variables to a custom color scale so `bg-background`, `text-text`, `border-border` work in both modes.

### 3.3 Component coverage
- Every primitive (`Button`, `Card`, `Badge`, `Input`, `Avatar`, `Dialog`) must have dark variants.
- Every dashboard and public page must be audited for hardcoded colors.
- Public profile: default to light mode, respect system preference; add a subtle toggle if desired.

---

## 4. Time-Aware Greeting + Sun/Moon Animation

### 4.1 What it does
- Replace the static greeting with a dynamic greeting that changes by time of day:
  - `05:00–11:59` → "Good morning, {name}"
  - `12:00–16:59` → "Good afternoon, {name}"
  - `17:00–20:59` → "Good evening, {name}"
  - `21:00–04:59` → "Good night, {name}"
- Show an animated celestial icon next to the greeting:
  - Morning: sun rising animation.
  - Afternoon: bright sun.
  - Evening: sun setting animation.
  - Night: moon + subtle stars.

### 4.2 Time source
- Primary: browser local time (`new Date()`).
- Timezone: `Intl.DateTimeFormat().resolvedOptions().timeZone` to display a small timezone-aware clock if wanted.
- Country-specific sunrise/sunset (optional, more accurate):
  - Use browser geolocation (`navigator.geolocation`) with user permission to get lat/long.
  - Use a small library like `suncalc` to compute actual sunrise/sunset for that location.
  - Fallback: if geolocation denied, use time ranges above based on local time.

### 4.3 Clock widget
- Add a small digital clock in the header near the greeting, e.g.:
  - "10:23 AM · Europe/Berlin"
- Update every minute.
- Respect 12h/24h based on locale or user preference.

### 4.4 Animation approach
- Use CSS keyframes or Framer Motion:
  - **Sun rising:** translate-y from below + opacity fade in + subtle glow pulse.
  - **Sun setting:** translate-y downward + color shift to orange/amber.
  - **Moon:** gentle float + twinkling stars (small opacity pulse).
- Keep animations subtle (1–2 seconds, looping gently) so they feel premium, not distracting.

### 4.5 Component
- Create `GreetingHeader.tsx`:
  - Props: `name`, `timezone?`, `useGeolocation?`.
  - Returns: greeting text + animated icon + optional clock.

---

## 5. Dashboard / SaaS Backend Fixes

### 5.1 Sidebar — lighter, more architectural

**Problem:** The bright green active pill dominates the screen and fights the content.

**Fix:**
- Active item: `bg-[#F5F2EE] text-[#1A2E26]` with a `border-l-4 border-[#047857]` accent, **not** a full green fill.
- Inactive item: `text-[#786B5D]` hover to `text-[#1A2E26] bg-[#FFFBF7]`.
- Remove the heavy rounded pill shape; use full-width rows.
- Collapse secondary items where possible: keep `Organization` as a single entry that expands to `Team` / `Accounts`, or merge `Team` into `Organization`.
- Add a subtle divider before `Settings` and `Log out`.

### 5.2 Header — cleaner, action-oriented

**Problem:** The greeting is nice but the top-right plan badge and icon cluster feel tacked on.

**Fix:**
- Keep the greeting left-aligned with a short subline.
- Right side: a single "Share profile" primary button + a compact plan badge (outline style, not filled).
- Move notifications/upgrade nudges into a small dropdown, not permanent icons.

### 5.3 Dashboard metric cards — establish hierarchy

**Problem:** Four equal cards, one of which says "0 Unlimited" and is confusing.

**Fix:**
- **Primary metrics** (Profile views, Bookings): larger cards, big number, small trend/label.
- **Secondary metrics** (QR scans, This week): smaller cards grouped together.
- "This week" becomes a **usage widget** with a clear label:  
  `0 used / unlimited` for Pro, or `0 of 3 used` for Free.
- Remove decorative icons where they add no meaning; keep only meaningful ones.

### 5.4 Profile + QR section — one cohesive "Share" block

**Problem:** Profile card and QR card sit side-by-side as unrelated boxes.

**Fix:**
- Combine into one card: left side shows avatar, name, role, slug, and action buttons; right side shows a compact QR code with "Scan to view" caption.
- Add a visible public URL (`orbitone.com/p/fakrifth`) with a copy button.
- "Edit profile" is primary, "View public page" is secondary, "Copy link" becomes an icon-only copy action next to the URL.

### 5.5 Analytics mini-card — less clutter

**Problem:** A whole card for two numbers and a button.

**Fix:**
- Fold the mini-analytics into the profile card footer, or make it a slim horizontal strip.
- Keep only "Views" and "Bookings" with sparkline placeholders.

### 5.6 Upcoming bookings + CRM snapshot — meaningful empty states

**Problem:** CRM snapshot shows eight zeros. It looks dead.

**Fix:**
- **Empty state:** replace the 8-metric grid with one centered message:  
  "No customers yet. Add your first contact to start tracking deals." + primary CTA.
- **With data:** show 4 metrics max (Customers, Follow-ups, Forecast, Won/Lost) in a 2x2 grid.
- Upcoming bookings: show the next booking as a highlighted row, not a generic list.

### 5.7 Quick actions — move or remove

**Problem:** Four small action tiles at the bottom feel like an afterthought.

**Fix:**
- Move the most important quick action ("Share QR") to the header.
- Remove or demote the others; the dashboard should not duplicate navigation.

### 5.8 Scheduling pages

**Problem:** Meeting type card is stretched and empty; availability rows are repetitive; calendar is bare.

**Fix:**
- Meeting types: grid of cards (1 per row on mobile, 2 per row on desktop) with clear duration/location badges.
- Availability: compact weekly grid. Default Mon-Fri 9-5 shown as one summary row with an "Add exception" option; expand only when editing.
- Calendar: add subtle event chips, a "Today" highlight, and a friendly empty state for blank months.
- Bookings list: richer cards with status badge, guest avatar initial, and actions.

### 5.9 Profile form — grouped, guided

**Problem:** One long vertical list of fields with no hierarchy.

**Fix:**
- Two-column layout on desktop.
- Sections with clear headings:
  - **Profile details** (full name, headline, bio, slug)
  - **Contact** (email, phone, website)
  - **Social** (LinkedIn, X/Twitter)
  - **Visibility** (publish toggle, company, location)
- Add avatar upload block at the top-left, connected to the public profile preview.
- "Save profile" stays sticky at the bottom on mobile.

### 5.10 Settings, Organization, Accounts, Customers

**Problem:** These pages are plain but functional. They need the same card/padding system.

**Fix:**
- Apply the same card style everywhere.
- Organization: make the plan/team card the hero, members list as a clean table.
- Accounts: empty state with a real illustration or icon block.
- Customers: table/list view with hover rows, filters in a secondary toolbar, not giant dropdowns.

---

## 6. Public Profile Fixes

The public profile is the product's main output. It must feel like a polished, shareable digital business card.

### 6.1 Layout — own the screen

**Problem:** A narrow card floating in empty white space on desktop.

**Fix:**
- Add a subtle warm gradient or pattern background (`bg-gradient-to-br from-[#FFFBF7] to-[#F5F2EE]`).
- Center the card with a max-width (`max-w-xl`) and generous padding.
- Use a `rounded-3xl` card with a soft shadow so it lifts off the page.

### 6.2 Header — avatar, name, and primary CTA

**Problem:** Initial avatar looks temporary; name/role lack emphasis.

**Fix:**
- Larger avatar (96px) with a ring or subtle border. If no avatar, use a polished initial badge on a warm gradient background.
- Name: `text-3xl font-semibold`.
- Role + company + location on one clean line with small icons.
- Primary CTA: "Book a meeting" as a full-width dark button (`bg-[#1A2E26] hover:bg-[#2A3E36] text-white`).

### 6.3 Action row — save and share

**Problem:** vCard / Share / Copy link buttons look dated and duplicate each other.

**Fix:**
- Single row of icon buttons with labels:
  - **Save contact** (downloads vCard)
  - **Share** (native share or WhatsApp)
  - **Copy link** (copies public URL)
- Use a subtle surface background for the row.

### 6.4 About + meeting types

**Problem:** Sections blend together.

**Fix:**
- Clear section headings with uppercase `text-xs font-semibold tracking-wide text-[#786B5D]`.
- Meeting type cards: clickable rows with duration and location icon.
- Add a "Book" arrow on hover.

### 6.5 Contact section

**Problem:** Plain email/phone list.

**Fix:**
- Use clickable rows with icons.
- Add `mailto:` and `tel:` links.
- Show only the channels the user has filled in; hide empty ones.

### 6.6 QR code — prominent but elegant

**Problem:** QR is at the bottom, easy to miss.

**Fix:**
- Add a "Scan to connect" block near the top, below the action row.
- Use a smaller QR code (128px) inside a rounded white badge.
- Add a "Download vCard" link below it.

### 6.7 Premium touches

- Add a tiny "Powered by OrbitOne" footer that is subtle.
- Use smooth entrance animations (fade + slight translate-y) on load.
- Ensure the page is fully responsive and thumb-friendly on mobile.

---

## 7. Component System Cleanup

Before touching pages, lock in the primitive components so every page feels consistent.

### Button system
| Variant | Style | Use |
|---|---|---|
| Primary | `bg-[#1A2E26] text-white hover:bg-[#2A3E36]` | Main CTAs (Book, Save, Open pipeline) |
| Secondary | `border border-[#1A2E26] text-[#1A2E26] hover:bg-[#F5F2EE]` | Secondary actions (View public page, Manage) |
| Tertiary | `text-[#786B5D] hover:text-[#1A2E26]` | Low-priority actions (Copy, Cancel) |
| Destructive | `text-red-600 hover:bg-red-50` | Delete/remove |

### Badge system
| Variant | Style | Use |
|---|---|---|
| Success | `bg-green-100 text-green-800` | Active, confirmed, published |
| Warning | `bg-amber-100 text-amber-800` | Approval required, pending |
| Neutral | `bg-[#F5F2EE] text-[#1A2E26]` | Plan, role, default tags |

### Card system
- Base: `bg-white rounded-2xl border border-[#E7E2DC] shadow-sm`.
- Hover: `shadow-md border-gray-300`.
- No mixing of rounded-xl and rounded-2xl across cards.

### Input system
- Consistent focus ring: `focus:ring-2 focus:ring-[#047857]/20 focus:border-[#047857]`.
- Labels: `text-sm font-medium text-[#1A2E26]` above inputs.
- Use the same border color (`#E7E2DC`) everywhere.

---

## 8. Implementation Phases

Work in small, verifiable passes. After each pass: `npm run lint` and `npm run build` in `frontend-v2`.

### Phase A — Design Tokens + Primitives + Dark Mode (1-2 days)
1. Set up CSS variables for light and dark palettes in `index.css`.
2. Update Tailwind config to use the CSS variable colors.
3. Add `ThemeProvider` and a theme toggle component.
4. Standardize `Button`, `Card`, `Badge`, `Input`, `Avatar` with dark variants.
5. Update the logo if needed to use primary dark green; ensure it works on dark backgrounds.

### Phase B — Dashboard Shell + Home + Greeting (1-2 days)
1. Redesign sidebar active/hover states.
2. Redesign dashboard header.
3. Add `GreetingHeader` with time-aware greeting, animated sun/moon icon, and timezone clock.
4. Redesign dashboard metric cards and empty states.
5. Combine profile + QR into one share block.
6. Simplify CRM snapshot.

### Phase C — SaaS Pages (2 days)
1. Profile form: grouped two-column layout + avatar upload.
2. Scheduling: meeting types grid, compact availability, calendar polish, bookings list cards.
3. Customers, Accounts, Organization, Settings: apply card system and empty states.

### Phase D — Public Profile (1-2 days)
1. New premium card layout with gradient background.
2. New header, action row, contact, meeting types, QR block.
3. Responsive polish and load animations.

### Phase E — Final Polish + QA (1 day)
1. Audit every page for inconsistent buttons/badges/cards.
2. Check mobile widths.
3. Run `npm run lint`, `npm run build`, and Playwright e2e if available.

---

## 9. Files Expected to Change

### Design tokens / primitives
- `frontend-v2/src/index.css`
- `frontend-v2/tailwind.config.js` (or `tailwind.config.ts`)
- `frontend-v2/src/components/ui/button.tsx`
- `frontend-v2/src/components/ui/card.tsx`
- `frontend-v2/src/components/ui/badge.tsx`
- `frontend-v2/src/components/ui/input.tsx`
- `frontend-v2/src/components/ui/avatar.tsx`
- `frontend-v2/src/components/brand/logo.tsx`

### Theme + dark mode
- `frontend-v2/src/providers/ThemeProvider.tsx` (new)
- `frontend-v2/src/components/theme/theme-toggle.tsx` (new)
- `frontend-v2/src/index.css`
- `frontend-v2/tailwind.config.js` (or `tailwind.config.ts`)

### Dashboard shell + greeting
- `frontend-v2/src/components/layout/dashboard-shell.tsx`
- `frontend-v2/src/components/layout/sidebar.tsx`
- `frontend-v2/src/components/layout/header.tsx` (if separate)
- `frontend-v2/src/components/dashboard/greeting-header.tsx` (new)
- `frontend-v2/src/components/dashboard/celestial-animation.tsx` (new)

### Dashboard home
- `frontend-v2/src/app/dashboard/page.tsx`
- `frontend-v2/src/components/dashboard/metric-cards.tsx` (or equivalent)
- `frontend-v2/src/components/dashboard/profile-card.tsx`
- `frontend-v2/src/components/dashboard/qr-card.tsx`
- `frontend-v2/src/components/dashboard/crm-snapshot.tsx`
- `frontend-v2/src/components/dashboard/upcoming-bookings.tsx`

### Profile / SaaS pages
- `frontend-v2/src/app/dashboard/profile/page.tsx`
- `frontend-v2/src/components/profile/profile-form.tsx`
- `frontend-v2/src/components/profile/avatar-upload.tsx` (if not existing)

### Scheduling
- `frontend-v2/src/app/dashboard/scheduling/page.tsx`
- `frontend-v2/src/app/dashboard/scheduling/calendar/page.tsx`
- `frontend-v2/src/app/dashboard/scheduling/meeting-types/page.tsx`
- `frontend-v2/src/app/dashboard/scheduling/availability/page.tsx`
- `frontend-v2/src/app/dashboard/scheduling/bookings/page.tsx`
- Related components in `frontend-v2/src/components/scheduling/`

### Customers / Accounts / Organization / Settings
- `frontend-v2/src/app/dashboard/customers/page.tsx`
- `frontend-v2/src/app/dashboard/accounts/page.tsx`
- `frontend-v2/src/app/dashboard/organization/page.tsx`
- `frontend-v2/src/app/dashboard/settings/page.tsx`
- Related components in `frontend-v2/src/components/customers/`, `accounts/`, `organization/`, `settings/`

### Public profile
- `frontend-v2/src/app/p/[slug]/page.tsx` (or `/u/[slug]/page.tsx` if that is the route)
- `frontend-v2/src/components/profile/public-profile-card.tsx`
- `frontend-v2/src/components/profile/share-actions.tsx` (new)
- `frontend-v2/src/components/profile/contact-section.tsx` (new)
- `frontend-v2/src/components/profile/meeting-types-section.tsx` (new)

### Empty / loading states
- `frontend-v2/src/components/empty-states/index.tsx` or equivalent
- `frontend-v2/src/components/loading/skeleton.tsx` or equivalent

### Collaboration docs
- `AGENTS.md` — update Kimi status before/after work.

---

## 10. Verification Checklist

- [ ] `npm run lint` passes in `frontend-v2`.
- [ ] `npm run build` passes in `frontend-v2`.
- [ ] All existing routes still render.
- [ ] Dashboard looks premium at 1280px, 1440px, and mobile widths.
- [ ] Dark mode renders correctly on dashboard and public profile.
- [ ] Theme toggle persists across reloads.
- [ ] Greeting text and animated icon change correctly at morning/afternoon/evening/night boundaries.
- [ ] Public profile looks like a polished shareable card on desktop and mobile.
- [ ] No visual regressions on auth pages.
- [ ] Playwright e2e tests pass (if available).

---

## 11. Out of Scope

To keep this fix focused on UI polish:

- No new backend features.
- No new database migrations.
- Theme preference is stored in `localStorage`; backend persistence is optional and out of scope for this pass.
- Country-specific sunrise/sunset uses browser geolocation as a best-effort enhancement with a simple time-range fallback; IP-geolocation service integration is out of scope.
- No payment integration.
- No full Sinhala/Tamil translation.
- No new modules (events, discovery, AI).

If those are needed, they will be planned separately.

---

## 12. First Step

**Start with Phase A: lock the design tokens and primitive components.**

This creates the foundation for every other page to look consistent. Once the color, button, card, and badge systems are fixed, the rest of the work is composition.
