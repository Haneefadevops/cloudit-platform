# TheReplyte Dashboard UI Modernization Plan

Modernize `apps/whatsapp-agent-web` (the shared staff + client portal
dashboard at app.thereplyte.com) to a clean, modern UI that matches the
thereplyte.com landing page brand. This is a UI-only project: **no API
changes, no behavior changes, no logic changes** — every page must keep
doing exactly what it does today.

## Current state

- Bare Next.js 14 + React, every page styled with ad-hoc inline style
  objects. No design system, no reusable components, no logo, no brand
  colors. Functional but looks like a wireframe.
- Staff and client-portal users share the same pages (role-based nav in
  `dashboard/layout.tsx`, portal lock in pages) — one redesign covers both.

## Brand tokens (from the landing page — use these exactly)

- Primary gradient: **teal `#00d8c7` → indigo `#4a42fc`** (left→right).
  Use for primary buttons, active nav states, headings accents, the login
  backdrop, and the usage bar fill.
- Text: **`#12142b`** (navy) headings/body; `#6b7280` for secondary text.
- Backgrounds: page `#f6f7fd`, cards `#ffffff`, borders `#e6e8f5`.
- Sidebar: deep navy `#12142b` (or `#111827` family) with white text;
  active item = gradient pill or teal left-border + lighter navy bg.
- Font: **Inter** (same as landing; `next/font/google`).
- Corners: 12–16px radius; soft shadows (`0 1px 3px rgba(18,20,43,0.08)`).
- Logo: copy `logo.webp` and `logo-mark.webp` from
  `apps/thereplyte-landing/public/` into `apps/whatsapp-agent-web/public/`.
  Sidebar shows logo-mark + "TheReplyte" wordmark; login page shows the
  full logo. **Never recolor the CloudIT/TheReplyte logo.**

## Tech approach (important constraints)

1. **Use Tailwind CSS**, matching the landing (`tailwindcss@3.4` is already
   installed in the monorepo for `apps/thereplyte-landing`; packages are
   hoisted to the root `node_modules`). Add `tailwind.config.js` +
   `postcss.config.js` to `apps/whatsapp-agent-web`, add the brand tokens
   to the theme (colors, fontFamily, boxShadow), and convert
   `globals.css` to Tailwind directives.
2. **Do NOT add any new npm dependencies.** `npm install` currently crashes
   on this monorepo's lockfile (npm 11 arborist bug, seen in Phase 3).
   Everything must build with what's already in `node_modules`. If the
   build cannot resolve `tailwindcss`/`postcss`/`autoprefixer` from the
   hoisted root, add them to this app's package.json pinned to the exact
   versions already in `apps/thereplyte-landing/package.json` (3.4.15 /
   8.4.49 / 10.4.20) — they will resolve from the hoist without a full
   install. If a full install is truly unavoidable, STOP and report.
3. **Hand-build a tiny component kit** in `src/components/ui/` (no
   component-library dependency): `Card`, `Button` (primary/gradient,
   outline, danger), `Badge` (status chips), `Table`, `Input`, `Select`,
   `Modal`, `Spinner`, `EmptyState`, `Toast`, `StatCard`, `UsageBar`.
   Pages compose these instead of inline styles.
4. Replace inline styles page by page; delete the shared inline-style
   helpers (`inputStyle`, `buttonStyle`, `sectionStyle`) as pages convert.

## Design specs

**Layout shell (`dashboard/layout.tsx`)**
- Left sidebar (navy): logo-mark + TheReplyte at top, nav items with icons
  (inline SVG, no icon library), active = gradient pill; role-based items
  unchanged (staff: full list; portal: Bookings/Orders/Analytics); bottom:
  client name (portal), user name/role, **Logout** button.
- Topbar: page title, date-range context where relevant, user avatar
  initials with dropdown (profile placeholder + logout).
- Content area: `#f6f7fd`, max-width container, generous spacing.
- Mobile: sidebar collapses to an overlay drawer with hamburger (the
  dashboard must be usable on a phone).

**Login page**
- Centered white card on a subtle gradient backdrop (like the landing
  hero), full TheReplyte logo, email/password fields, gradient primary
  button, error state styled. Same page serves staff + portal logins.

**Status color system (map existing statuses, brand-consistent)**
- pending = amber, confirmed = teal/green, completed = navy/green,
  cancelled = gray, no_show = red; orders: draft gray, pending amber,
  confirmed teal, preparing indigo, out_for_delivery blue, completed
  green, cancelled red. Same chips everywhere (bookings, orders, topups,
  conversations).

**Page-by-page notes**
- **Clients** (staff): card list → clean cards with status pills (active/
  Meta/Chatwoot), wallet line with UsageBar, actions as proper buttons;
  Add/Edit client in a Modal or a dedicated form page with sectioned
  fieldsets (keep every field and the Modules section).
- **Bookings**: keep list + calendar views; restyle calendar grid with
  brand tokens (today highlight, status-colored blocks, week nav).
- **Orders**: pipeline as grouped columns or a clean table with status
  chips + advance buttons; itemized cards stay but styled.
- **Analytics**: StatCard grid (conversations, AI resolution rate,
  bookings, orders, CSAT), date-range pills styled, UsageBar prominent at
  top (portal), token/cost cards staff-only (unchanged logic).
- **AI Settings / Knowledge Base / Canned Responses / Services / Catalog /
  Playground / Top-ups**: same conversion — sectioned cards, consistent
  form controls, styled tables/lists, toasts instead of the inline
  message banners.
- Keep **all** logic: guards, role scoping, module-flag gating, action
  JSON viewer in playground, slip viewer in Top-ups, portal locks.

## Sub-phases (deployable increments)

- **UI-1 — Foundation**: Tailwind setup, tokens, font, logo assets,
  component kit, layout shell (sidebar/topbar/logout/mobile drawer),
  login page. Staff + portal navs work exactly as before.
- **UI-2 — Money pages**: Clients, Bookings (+calendar), Orders,
  Analytics (+UsageBar, portal usage card, staff top-ups page).
- **UI-3 — Configuration pages**: AI Settings, Knowledge Base, Canned
  Responses, Services, Catalog, Playground.
- **UI-4 — Polish**: loading/empty states everywhere, toasts, responsive
  pass on all pages, final visual review against thereplyte.com.

## Acceptance criteria

1. `next build` green; zero new runtime dependencies.
2. Every existing flow still works unchanged: login (both roles), client
   CRUD + Chatwoot setup button, module gating, bookings actions, orders
   pipeline, analytics filters, usage card + top-up request flow, slip
   viewer, playground action viewer.
3. Sidebar shows the real logo; colors match the landing tokens; Inter
   everywhere.
4. Usable on a 375px-wide phone (nav drawer, tables scroll or stack).
5. Portal (client login) sees the same styled UI with its restricted nav
   and no staff-only data.
