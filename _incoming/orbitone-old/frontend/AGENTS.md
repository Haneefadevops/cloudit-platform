<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes - APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# OrbitOne Frontend

Kimi owns this app.

## Stack

- Next.js 16 (App Router)
- React 19
- TypeScript 5
- Tailwind CSS 4 (CSS-based config in `app/globals.css`)
- lucide-react
- react-qr-code

## Local Development

```bash
npm install
npm run dev
```

Local URL: `http://localhost:3000`

## Build Checks

```bash
npm run lint
npm run build
```

## API Base URLs

Set via `NEXT_PUBLIC_API_BASE_URL` in `.env.local`:

- Local: `http://localhost:8000/api/v1`
- Test: `https://to1.cloudit.lk/api/v1`
- Production: `https://po1.cloudit.lk/api/v1`

## Routes

- `/` - Landing page
- `/login` - Authentication
- `/dashboard` - Dashboard overview with analytics and CRM snapshot
- `/dashboard/profile` - Profile builder
- `/dashboard/discover` - Discover published profiles
- `/dashboard/connections` - Network tabs
- `/dashboard/connections/[id]` - Relationship + light CRM detail
- `/dashboard/events` - Host event list/create
- `/dashboard/events/[id]` - Event detail/edit/attendees
- `/dashboard/settings` - Account settings
- `/dashboard/scheduling` - Scheduling overview
- `/dashboard/scheduling/calendar` - Connected calendar status
- `/dashboard/scheduling/meeting-types` - Meeting types
- `/dashboard/scheduling/availability` - Weekly availability
- `/dashboard/scheduling/bookings` - Bookings list
- `/u/[slug]` - Public profile
- `/e/[slug]` - Public event page with check-in and attendee networking
- `/book/[slug]` - Unified public booking calendar (meeting type selector + calendar + time slots + booking form)
- `/book/[slug]/[meetingTypeSlug]` - Redirects to `/book/[slug]?type=[meetingTypeSlug]`

## Shared Contracts

Types are re-exported from `../contracts/orbitone.ts` in `lib/contracts.ts`.

## Brand

See `../BRAND_GUIDELINES.md` and `../docs/uiux-redesign-v2-plan.md` for the Island Modern direction.

- Primary: `#0F2E2E`
- Secondary: `#0F766E`
- Accent: `#F97068`
- Accent 2: `#FDBA74`
- Background: `#FFF7ED`
- Surface: `#FFFBF5`
- Border: `#FED7AA`
- Text: `#1F2937`
- Muted: `#786B60`
- Font: Inter / Noto Sans Sinhala / Noto Sans Tamil / system-ui

## UI Primitives

Available in `components/ui/`:

- `Button` — primary, secondary, outline, ghost, danger, link, icon variants with press animation.
- `Input` — with error, helper text, icon left/right, and `aria-describedby` wiring.
- `Textarea` — with character counter and auto-resize.
- `Label` — with optional badge and error state.
- `Badge` — default, success, warning, error, info, outline, soft, dot.
- `Card` — default, interactive, flat, outlined variants with padding options.
- `Switch` — accessible toggle with label.
- `Avatar` — image/initials fallback, size scale, status indicator.
- `Skeleton` — pulse loading placeholder.
- `Toast` + `useToast` — toast notifications (success/error/warning/info).
- `Dialog` — modal with title, description, footer, Escape/click-outside/scroll-lock.

## Feedback Patterns

- Use `useToast()` for transient success/error/warning messages instead of inline banners where possible.
- Use `Dialog` for destructive confirmations instead of `window.confirm()`.
- Use `Skeleton` (in `components/loading/`) for page-level loading states.

## Advanced Patterns

- Dark mode: `ThemeProvider` + `useTheme()` with `light|dark|system` support. Toggle via `ThemeIconButton` or `ThemeToggle`.
- Command palette: `CommandPalette` component, globally available with `Cmd+K` / `Ctrl+K`.
- Avatar upload UI in profile form: drag-and-drop or click; stores a base64 data URL until a backend upload endpoint is added.

## Scope

Phase 1 + Phase 2 + Phase 3 + Phase 4 + Phase 5 UI + UI/UX modernization + Island Modern redesign (v2):

- Landing page (Island Modern hero, language switcher, social proof, feature grid, how-it-works, closing CTA, footer)
- Auth UI (modernized split-screen login/register with password visibility toggle and error alert)
- Dashboard shell, analytics, network summary, and CRM snapshot (Island Modern bento layout)
- Profile builder (Island Modern form with local placeholder copy and avatar upload)
- Public profile page with connection status
- QR, share, save contact, add to network, and WhatsApp share UI
- Discover published profiles
- Connections and network tabs
- Connection relationship detail with status, notes, tags, and follow-ups
- Connection light CRM detail with lifecycle, priority, next step, and activity timeline
- Event host list/create/edit
- Public event page with QR, check-in, and attendee networking
- Scheduling dashboard (overview, calendar status, meeting types, availability, bookings list)
- Public booking pages (`/book/[slug]`, `/book/[slug]/[meetingTypeSlug]`)

Do not build full CRM pipelines, deal objects, forecasts, tickets, payments, event agendas, event CRM, AI, automations, or profile/connection/event booking integration buttons yet.

## Pass C — Public pages + final polish

Owner: Kimi
Area: Public pages + final polish
Status: done
Files changed:

- `frontend/app/u/[slug]/page.tsx`
- `frontend/app/e/[slug]/page.tsx`
- `frontend/app/book/[slug]/page.tsx`
- `frontend/app/book/[slug]/[meetingTypeSlug]/page.tsx`
- `frontend/components/profile/public-profile-card.tsx`
- `frontend/components/booking/booking-calendar.tsx`
- `frontend/components/booking/time-slot-picker.tsx`
- `frontend/components/booking/booking-guest-form.tsx`
- `frontend/components/booking/booking-confirmation.tsx`
- `frontend/components/booking/utils.tsx`
- `frontend/components/command-palette.tsx`
- `frontend/components/layout/public-shell.tsx`

What changed:

- Redesigned public profile, public event, and public booking pages to Island Modern style.
- Created shared `PublicShell` with Logo, language switcher, theme toggle, and Sign in/Dashboard button.
- Restyled `PublicProfileCard` with larger gradient avatar ring, sunset header, pill-shaped meta badges, and contact icon links.
- Added Island Modern action bar on public profile: Book a meeting, WhatsApp share, native share/copy fallback, QR dialog, Save vCard, Add to network.
- Added WhatsApp share button that opens `https://wa.me/?text=...`.
- Updated connection status banner to use `Badge`.
- Redesigned public event page with gradient hero card, date/location meta, publish state badge, check-in CTA, event QR card, and attendee grid.
- Redesigned public booking flow with profile + meeting header, month calendar picker with available-day highlighting, time slot picker, `Textarea` primitive, sticky mobile confirm bar, and success-subtle/success confirmation view with placeholder calendar actions.
- Restyled command palette with glass/surface palette and improved selected-item highlight.

Verification:

- `npm run lint` passed.
- `npm run build` passed.
- Existing logic preserved for QR dialog, copy link, vCard download, add-to-network, check-in, slot selection, and booking submission.
