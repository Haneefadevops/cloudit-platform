# OrbitOne UI/UX v2 Redesign Plan — Island Modern (Sri Lanka)

> This plan will be saved to `docs/uiux-redesign-v2-plan.md` before implementation begins so it becomes a permanent project document.

## Goal
Completely redesign the OrbitOne frontend so it feels uniquely made for the Sri Lankan market: warm, vibrant, mobile-first, trustworthy, and locally relevant. Move away from the generic SaaS look.

## Design Direction: Island Modern

### Brand Palette
| Role | Color | Hex |
|------|-------|-----|
| Primary | Deep Navy | `#0F2E2E` |
| Secondary | Teal | `#0F766E` |
| Accent | Coral | `#F97068` |
| Accent 2 | Sunset Peach | `#FDBA74` |
| Background | Sand | `#FFF7ED` |
| Surface | Cream | `#FFFBF5` |
| Border | Soft Coral | `#FED7AA` |
| Text | Charcoal | `#1F2937` |
| Muted | Warm Gray | `#786B60` |

### Dark Mode Palette
| Role | Color | Hex |
|------|-------|-----|
| Background | Deep Ocean | `#0B1A1A` |
| Surface | Teal Black | `#122525` |
| Border | Muted Teal | `#1F3D3B` |
| Primary | Cream | `#FFF7ED` |
| Secondary | Mint | `#2DD4BF` |
| Accent | Coral | `#F97068` |
| Text | Sand | `#F5E6D3` |
| Muted | Soft Brown | `#A89B8C` |

### Typography
- Primary: `Inter` for Latin/English.
- Sri Lankan scripts: `Noto Sans Sinhala` and `Noto Sans Tamil` via `next/font/google`.
- Use slightly larger tap targets and generous line-height for readability on mobile.

### Visual Language
- Soft sunset gradients (teal → peach → coral).
- Wave/palm-leaf inspired divider shapes (CSS-only).
- Rounded, friendly cards with strong shadows.
- Coral accent for primary CTAs; teal for secondary actions.
- Local trust badge: "Made for Sri Lankan professionals" on landing and public pages.

### Sri Lankan Market Features
1. **Language switcher** — English / සිංහල / தமிழ். Start with UI labels and a lightweight i18n context. Full copy translation can be expanded later.
2. **WhatsApp share** — Prominent "Share on WhatsApp" button on public profile and booking pages.
3. **Local professional categories** — Add common Sri Lankan categories/titles in profile form suggestions.
4. **Mobile-first** — Larger buttons, thumb-friendly slot pickers, bottom-sheet-style public profile actions.
5. **Low-bandwidth friendly** — Keep bundle light; use CSS patterns instead of heavy images; skeleton states.

## Implementation Plan

Because this is a total redesign, work in three passes so every pass keeps `npm run lint` and `npm run build` green.

### Pass A — Foundation + Marketing + Auth
1. **Design tokens**
   - Replace colors in `frontend/app/globals.css` for both light and dark modes.
   - Add `Noto Sans Sinhala` and `Noto Sans Tamil` font variables.
   - Add `@variant dark` and sunset gradient utilities.
2. **Primitives**
   - Update `Button`, `Card`, `Input`, `Badge`, `Dialog`, `Toast`, `Skeleton`, `Avatar` to the new palette and rounded style.
   - Add a `GradientButton` variant.
   - Add a `LanguageSwitcher` component.
3. **Logo**
   - Update `components/brand/logo.tsx` colors to teal/coral.
4. **Landing page (`/`):**
   - New hero with sunset gradient, wave divider, local headline.
   - Add Sri Lankan use cases and testimonials.
   - "Made for Sri Lankan professionals" trust badge.
   - Language switcher in marketing header.
5. **Auth pages (`/login`):**
   - Redesign split-screen with Island Modern gradient panel.
   - Add language switcher.
   - Update `AuthForm` styling.

### Pass B — Dashboard Shell + Pages
1. **Dashboard shell (`app/dashboard/layout.tsx`):**
   - New sidebar/header colors, mobile bottom nav, language toggle, WhatsApp-style quick share.
2. **Dashboard home (`app/dashboard/page.tsx`):**
   - Redesign bento cards with coral/teal gradients.
   - Localize metric labels where relevant.
3. **Profile builder (`app/dashboard/profile/page.tsx` + `components/profile/profile-form.tsx`):**
   - New two-column layout with live preview.
   - Add language-aware placeholder copy.
   - Keep avatar upload UI, polish drag zone.
4. **Connections + relationship pages:**
   - Update cards, status badges, tags, follow-ups to new palette.
5. **Events + Scheduling pages:**
   - Redesign cards, lists, and forms with Island Modern tokens.

### Pass C — Public Pages + Final Polish
1. **Public profile (`app/u/[slug]/page.tsx` + `components/profile/public-profile-card.tsx`):**
   - Centered hero card with sunset gradient header.
   - Primary CTA: "Book a meeting" / "Save contact".
   - Secondary: WhatsApp share, copy link, QR dialog.
2. **Public event (`app/e/[slug]/page.tsx`):**
   - Redesign event header, check-in, attendee list.
3. **Public booking (`app/book/[slug]` + `app/book/[slug]/[meetingTypeSlug]`):**
   - Redesign meeting type cards and slot picker.
   - Add WhatsApp share for booking link.
4. **Empty/error/loading states:**
   - Update `components/empty-states/index.tsx` and `components/loading/dashboard-skeleton.tsx`.
5. **Command palette + theme toggle:**
   - Keep functionality, update styling to match new palette.
6. **Final QA**
   - Run `npm run lint` and `npm run build`.
   - Spot-check mobile widths.

## Out of Scope for This Redesign
- New backend features (e.g., WhatsApp API backend, file upload endpoint).
- Full Sinhala/Tamil translation of every string — UI framework and key strings only.
- New modules outside V1 (CRM pipeline, AI, payments, events CRM).

## Files Expected to Change
- `frontend/app/globals.css`
- `frontend/app/layout.tsx`
- `frontend/components/ui/*`
- `frontend/components/brand/logo.tsx`
- `frontend/components/layout/marketing-header.tsx`
- `frontend/components/theme-toggle.tsx`
- `frontend/components/command-palette.tsx`
- `frontend/components/i18n/language-switcher.tsx` (new)
- `frontend/components/i18n/i18n-provider.tsx` (new)
- `frontend/app/page.tsx`
- `frontend/app/login/page.tsx`
- `frontend/app/login/auth-form.tsx`
- `frontend/app/dashboard/layout.tsx`
- `frontend/app/dashboard/page.tsx`
- `frontend/components/analytics/metrics-cards.tsx`
- `frontend/components/crm/summary-cards.tsx`
- `frontend/app/dashboard/profile/page.tsx`
- `frontend/components/profile/profile-form.tsx`
- `frontend/components/profile/public-profile-card.tsx`
- `frontend/app/u/[slug]/page.tsx`
- `frontend/app/e/[slug]/page.tsx`
- `frontend/app/book/[slug]/page.tsx`
- `frontend/app/book/[slug]/[meetingTypeSlug]/page.tsx`
- `frontend/components/empty-states/index.tsx`
- `frontend/components/loading/dashboard-skeleton.tsx`
- `AGENTS.md` and `frontend/AGENTS.md`

## Verification
- `npm run lint` passes after each pass.
- `npm run build` passes after each pass.
- All 16 routes still prerender.

## Risks & Notes
- Total redesign is high-touch; we will keep commits-by-pass so the user can stop/review between passes.
- Font loading for Sinhala/Tamil may slightly increase initial bundle; use `display=swap` and only load when needed if possible.
- WhatsApp share uses `https://wa.me/?text=...`; no backend needed.
