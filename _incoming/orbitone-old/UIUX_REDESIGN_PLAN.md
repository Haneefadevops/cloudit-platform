# OrbitOne UI/UX Redesign Plan

## Goal
Apply a modern, futuristic, glassmorphism-style UI (inspired by the shared Dribbble shots) to the OrbitOne landing page and dashboard, using the existing OrbitOne brand colors.

## Reference Interpretation
- **Landing page reference:** Dark hero with large gradient headline, abstract glowing orb, minimal nav, social-proof strip, bento feature grid, clear CTAs.
- **Dashboard reference:** Dark command-center with a compact glass sidebar, welcome header, stat tiles, bento-grid widgets, charts/activity lists, and premium card styling.
- **Brand constraint:** OrbitOne colors are `primary #1A2E26`, `secondary #047857`, `accent #D97706`, background `#FFFBF7` / dark `#0C1914`. We will use the **dark theme palette** because it best matches the futuristic reference while keeping the brand emerald/amber accents.

## Recommended Approach
1. **Default to dark mode** using the existing `.dark` CSS variables in `frontend-v2/src/app/globals.css` (already defined). Add `class="dark"` to `frontend-v2/index.html` so every page renders dark by default.
2. **Redesign the landing page** (`frontend-v2/src/app/page.tsx`) with:
   - Glass sticky header (update `frontend-v2/src/components/layout/marketing-header.tsx`).
   - Hero with gradient text, two CTAs, and a CSS-only glowing orb.
   - Logo/social-proof strip.
   - Bento-grid feature cards.
   - 3-step "How it works".
   - Pricing cards.
   - Gradient CTA footer.
3. **Redesign the dashboard home** (`frontend-v2/src/app/dashboard/page.tsx`) with:
   - Welcome header with avatar, name, plan badge, and quick actions.
   - Row of large stat tiles (profile views, bookings, QR scans, usage).
   - Bento grid: profile card, QR card, booking usage, analytics sparkline, upcoming bookings, CRM snapshot, quick actions.
   - Proper loading and empty states.
4. **Update the dashboard sidebar** (`frontend-v2/src/app/dashboard/layout.tsx`) to a compact glass style with active pill indicator and user profile panel.
5. **Create reusable components**:
   - `frontend-v2/src/components/ui/glass-card.tsx` — frosted card wrapper.
   - `frontend-v2/src/components/ui/stat-tile.tsx` — big number + label.
   - `frontend-v2/src/components/ui/gradient-text.tsx` — gradient headline utility.
   - `frontend-v2/src/components/dashboard/quick-actions.tsx` — icon action buttons.
6. **Keep all existing logic** (hooks, API calls, contracts, routing) unchanged. Only the presentation layer changes.
7. **Verify** with `npm run lint`, `npm run build`, and `npx playwright test` in `frontend-v2`.

## Key Files to Change
- `frontend-v2/index.html`
- `frontend-v2/src/app/page.tsx`
- `frontend-v2/src/app/dashboard/page.tsx`
- `frontend-v2/src/app/dashboard/layout.tsx`
- `frontend-v2/src/components/layout/marketing-header.tsx`
- `frontend-v2/src/components/ui/glass-card.tsx` (new)
- `frontend-v2/src/components/ui/stat-tile.tsx` (new)
- `frontend-v2/src/components/ui/gradient-text.tsx` (new)
- `frontend-v2/src/components/dashboard/quick-actions.tsx` (new)

## Out of Scope
- Public profile page (`/p/[slug]`) and booking page (`/book/[slug]`) will inherit dark colors automatically but will not be fully redesigned in this pass.
- Adding a light/dark toggle (we default to dark only).
- Adding real chart libraries (we use CSS sparklines or stat tiles).

## Risks
- Switching the whole app to dark by default changes the public-page look; this is intentional but should be verified visually.
- Some existing components use hardcoded colors (e.g., QR card `bg-white`); these need to be updated to theme-aware classes.

## Verification
- `npm run lint` should pass (existing scheduling availability warning is acceptable).
- `npm run build` should pass.
- `npx playwright test` should still pass (we may update selectors if the DOM changes).
