# Admin UI — Font Unification & Settings Page Fix

> Created: 2026-07-08  
> Scope: `apps/touchorbit-admin-web`  
> Goal: Make every admin page use the same font, fix the `/settings` page that is stuck on "Loading Settings…", and ensure no settings sections are missing compared to the original app.

---

## Current State

### Fonts
- `layout.tsx` loads **Plus Jakarta Sans** into the CSS variable `--font-sans`.
- `globals.css` applies it to `body`.
- `tailwind.config.ts` does **not** extend `theme.fontFamily.sans`, so `font-sans` resolves to the browser default stack.
- Some pages hard-code `font-['Plus_Jakarta_Sans']` on a root `div` while the dashboard and most other pages do not.
- Result: visible font differences between dashboard and other pages (see `11-07-06.mp4`).

### Settings page
- Route: `apps/touchorbit-admin-web/src/app/settings/page.tsx` (~2,375 lines).
- It already contains tabs for: **Organization, Branches, Departments, Attendance, Leave Policies, Overtime, Expense Policies, Security Roles, Integrations, Notifications**.
- It shows `Loading Settings…` forever because:
  - `loading` starts as `true`.
  - Data fetches only run when `organizationId` is truthy.
  - If `organizationId` is missing or the first Supabase call fails, the spinner never disappears.
- The original app (`_incoming/touchorbit-old/apps/admin/app/settings/page.tsx`) has the same tabs, so the main gap is that the current page does not render at all.

---

## Plan — Option C, phased 1-by-1

### Phase 1 — Unify fonts across all admin pages
**Goal:** Every page uses Plus Jakarta Sans through the global/Tailwind setup, with no page-level overrides.

Files to change:
1. `apps/touchorbit-admin-web/tailwind.config.ts`
   - Extend `theme.fontFamily.sans` to use `var(--font-sans)` plus a Plus Jakarta Sans fallback.
2. `apps/touchorbit-admin-web/src/app/globals.css`
   - Remove the duplicate `body { font-family: ... }` rule or rely on the Tailwind base layer; keep the font declaration consistent.
3. Remove explicit font overrides from:
   - `src/app/attendance/page.tsx`
   - `src/app/calendar/page.tsx`
   - `src/app/employees/page.tsx`
   - `src/app/employees/[id]/page.tsx`
   - `src/app/geofences/page.tsx`
   - `src/app/leave/page.tsx`
   - `src/app/spoofing-review/page.tsx`
4. Build (`npm run build --workspace=apps/touchorbit-admin-web`) and visually verify dashboard vs. other pages.

### Phase 2 — Fix `/settings` loading
**Goal:** The settings page renders instead of hanging on the spinner.

Files to change:
1. `apps/touchorbit-admin-web/src/app/settings/page.tsx`
   - Add a guard: if auth is loaded and `organizationId` is missing, set `loading = false` and show a useful message.
   - Ensure `setLoading(false)` is called even if `loadSettings()` throws.
   - Add a small `console.error` or `toast.error` for failed loads so we can diagnose RLS/network issues.
2. `apps/touchorbit-admin-web/src/app/api/auth/me/route.ts` / `apps/touchorbit-api/src/auth/auth.controller.ts`
   - Confirm the `/api/auth/me` response includes `organizationId` and that the frontend `useAuth()` hook reads it correctly.
3. Deploy and verify the settings tabs appear.

### Phase 3 — Settings parity & polish
**Goal:** Confirm the settings page has the same capabilities as the original app and fill any gaps.

Steps:
1. Side-by-side comparison of the settings tabs/fields in:
   - Current: `apps/touchorbit-admin-web/src/app/settings/page.tsx`
   - Original: `_incoming/touchorbit-old/apps/admin/app/settings/page.tsx`
2. Port any missing fields or sections (e.g., additional organization fields, leave types, approval chains, notification channels).
3. Test save/update actions on each tab.
4. Build, deploy, and record a short verification video.

---

## Acceptance Criteria

- [ ] Dashboard, Live Attendance, Employees, Calendar, etc. all render with the same font.
- [ ] `/settings` loads and shows all tabs within a few seconds.
- [ ] No console errors on `/settings` load.
- [ ] Settings tabs match the original app; any missing fields are ported.
- [ ] Changes are committed and pushed to `master`.

---

## Hand-off prompt for the next Kimi session

Start the next chat with this prompt:

```
Continue the work documented in docs/ADMIN_UI_FONT_AND_SETTINGS_PLAN.md.

We are doing Option C (all three objectives) but one phase at a time.
Start with Phase 1: unify fonts across apps/touchorbit-admin-web.

1. Configure tailwind.config.ts so theme.fontFamily.sans uses var(--font-sans) / Plus Jakarta Sans.
2. Clean up globals.css font declarations.
3. Remove the redundant font-['Plus_Jakarta_Sans'] classes from attendance, calendar, employees, employees/[id], geofences, leave, and spoofing-review pages.
4. Build the admin web app and verify there are no compile errors.
5. Commit and push with a clear message, then summarize what changed.

Do not start Phase 2 until Phase 1 is complete and pushed.
```
